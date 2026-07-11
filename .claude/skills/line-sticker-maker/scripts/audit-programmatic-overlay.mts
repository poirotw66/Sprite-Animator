/**
 * Audit programmatic text overlay on a completed sticker job.
 *
 *   npx tsx audit-programmatic-overlay.mts output/twice-1-school-daily
 *
 * Heuristic: caption-band pixels that look like overlay text (high-alpha black/white).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { parsePhraseSetJson } from '../../../../utils/lineStickerPhraseSetFormat.ts';
import { isVisualOnlyStickerPhrase } from '../../../../utils/lineStickerPhraseQuality.ts';
import { decodeImage } from './nodeImage.mts';

const outDir = resolve(process.argv[2] ?? '');
if (!outDir) {
  console.error('Usage: audit-programmatic-overlay.mts <job-out-dir>');
  process.exit(1);
}

const phrasePath = resolve(outDir, 'phrase-set.json');
const configPath = resolve(outDir, 'job.config.json');
if (!existsSync(phrasePath)) {
  throw new Error(`Missing ${phrasePath}`);
}

const phraseSet = parsePhraseSetJson(await readFile(phrasePath, 'utf8'));
if (!phraseSet) {
  throw new Error('Invalid phrase-set.json');
}

const config = existsSync(configPath)
  ? (JSON.parse(await readFile(configPath, 'utf8')) as {
      textRendering?: string;
      includeText?: boolean;
    })
  : {};

interface BandSample {
  top: number;
  bottom: number;
  middle: number;
}

function isTextLikePixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 180) return false;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 48 || lum > 215;
}

function sampleCaptionBands(data: Uint8ClampedArray, width: number, height: number): BandSample {
  const topH = Math.max(1, Math.floor(height * 0.28));
  const bottomH = Math.max(1, Math.floor(height * 0.28));
  const bottomStart = height - bottomH;
  const midStart = Math.floor(height * 0.38);
  const midEnd = Math.floor(height * 0.62);

  let top = 0;
  let bottom = 0;
  let middle = 0;
  let topTotal = 0;
  let bottomTotal = 0;
  let midTotal = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (a < 12) continue;
      const hit = isTextLikePixel(r, g, b, a) ? 1 : 0;
      if (y < topH) {
        topTotal++;
        top += hit;
      } else if (y >= bottomStart) {
        bottomTotal++;
        bottom += hit;
      } else if (y >= midStart && y < midEnd) {
        midTotal++;
        middle += hit;
      }
    }
  }

  return {
    top: topTotal ? top / topTotal : 0,
    bottom: bottomTotal ? bottom / bottomTotal : 0,
    middle: midTotal ? middle / midTotal : 0,
  };
}

function captionScore(bands: BandSample): number {
  return Math.max(bands.top, bands.bottom);
}

interface AuditEntry {
  globalIndex: number;
  phrase: string;
  visualOnly: boolean;
  stickerPath: string;
  captionScore: number;
  bands: BandSample;
  status: 'ok' | 'missing_text' | 'unexpected_text';
}

const entries: AuditEntry[] = [];
const phrases = phraseSet.phrases;

for (let i = 0; i < phrases.length; i++) {
  const globalIndex = i + 1;
  const phrase = phrases[i] ?? '';
  const visualOnly = isVisualOnlyStickerPhrase(phrase);
  const stickerPath = resolve(outDir, `stickers/sticker-${String(globalIndex).padStart(2, '0')}.png`);
  const sheetSticker = resolve(
    outDir,
    globalIndex <= 20 ? 'sheet-1' : 'sheet-2',
    `sticker-${String(globalIndex <= 20 ? globalIndex : globalIndex - 20).padStart(2, '0')}.png`
  );
  const path = existsSync(stickerPath) ? stickerPath : sheetSticker;
  if (!existsSync(path)) {
    entries.push({
      globalIndex,
      phrase,
      visualOnly,
      stickerPath: path,
      captionScore: 0,
      bands: { top: 0, bottom: 0, middle: 0 },
      status: visualOnly ? 'ok' : 'missing_text',
    });
    continue;
  }

  const img = decodeImage(new Uint8Array(await readFile(path)));
  const bands = sampleCaptionBands(img.data, img.width, img.height);
  const score = captionScore(bands);

  const TEXT_PRESENT = 0.012;

  let status: AuditEntry['status'] = 'ok';
  if (!visualOnly && score < TEXT_PRESENT) {
    status = 'missing_text';
  } else if (visualOnly && score > 0.92) {
    // High band density on visual-only slots — may be mis-overlay; heuristic only.
    status = 'unexpected_text';
  }

  entries.push({
    globalIndex,
    phrase,
    visualOnly,
    stickerPath: path,
    captionScore: score,
    bands,
    status,
  });
}

const missing = entries.filter((e) => e.status === 'missing_text');
const unexpected = entries.filter((e) => e.status === 'unexpected_text');
const withText = entries.filter((e) => !e.visualOnly);
const pass = missing.length === 0;

const report = {
  jobDir: outDir,
  textRendering: config.textRendering ?? '(unknown)',
  includeText: config.includeText ?? '(unknown)',
  auditedAt: new Date().toISOString(),
  phraseCount: phrases.length,
  textSlots: withText.length,
  visualOnlySlots: entries.length - withText.length,
  pass,
  missingTextCount: missing.length,
  unexpectedTextCount: unexpected.length,
  entries,
};

const reportPath = resolve(outDir, 'programmatic-overlay-audit.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Programmatic overlay audit: ${outDir}`);
console.log(`  textRendering=${report.textRendering} includeText=${report.includeText}`);
console.log(`  text slots: ${withText.length} / visual-only: ${report.visualOnlySlots}`);
console.log(`  missing text: ${missing.length}  unexpected text: ${unexpected.length}`);
console.log(`  → ${reportPath}`);

if (missing.length > 0) {
  console.log('\nMissing text:');
  for (const e of missing) {
    console.log(`  #${e.globalIndex} "${e.phrase}" score=${e.captionScore.toFixed(4)}`);
  }
}
if (unexpected.length > 0) {
  console.log('\nUnexpected text on visual-only:');
  for (const e of unexpected) {
    console.log(`  #${e.globalIndex} score=${e.captionScore.toFixed(4)}`);
  }
}

console.log(pass ? '\n✓ PASS' : '\n✗ FAIL');
process.exit(pass ? 0 : 1);
