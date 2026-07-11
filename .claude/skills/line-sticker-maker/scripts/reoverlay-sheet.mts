/**
 * Re-slice a processed sheet and re-apply programmatic text overlay (no Gemini).
 *
 *   npx tsx reoverlay-sheet.mts <sheet-dir> [cols] [rows] [--phrases path.json] [--offset N]
 *   npx tsx reoverlay-sheet.mts <sheet-dir> 4 5 --font-size 14
 *
 * Tuning: reads ../job.config.json programmaticTextTuning; --font-size overrides fontSizePercent.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { parsePhraseSetJson } from '../../../../utils/lineStickerPhraseSetFormat.ts';
import {
  mergeProgrammaticTextTuning,
  type ProgrammaticTextOverlayTuning,
} from '../../../../utils/lineStickerTextOverlayTypes.ts';
import { FONT_PRESETS, TEXT_COLOR_PRESETS } from '../../../../utils/lineStickerPrompt.ts';
import {
  decodeImage,
  encodePng,
  sliceSheet,
} from './nodeImage.mts';
import { buildEqualGridBounds } from '../../../../utils/gridSheetTemplate.ts';
import { overlayPhraseOnRgbaFrame } from './programmaticTextOverlay.mts';
import { trimFrameToContent } from '../../../../utils/sheetComponentSlicer.ts';

const argv = process.argv.slice(2);
const sheetDir = resolve(argv[0] ?? '');
const cols = Number(argv[1] ?? 4);
const rows = Number(argv[2] ?? 5);
let phrasesPath = '';
let phraseOffset = 0;
let fontSizePercent: number | undefined;
let jobConfigPath = '';

for (let i = 3; i < argv.length; i++) {
  if (argv[i] === '--phrases' && argv[i + 1]) {
    phrasesPath = argv[++i]!;
  } else if (argv[i] === '--offset' && argv[i + 1]) {
    phraseOffset = Number.parseInt(argv[++i]!, 10);
  } else if (argv[i] === '--font-size' && argv[i + 1]) {
    fontSizePercent = Number.parseFloat(argv[++i]!);
  } else if (argv[i] === '--job-config' && argv[i + 1]) {
    jobConfigPath = argv[++i]!;
  }
}

if (!sheetDir) {
  console.error(
    'Usage: reoverlay-sheet.mts <sheet-dir> [cols] [rows] [--phrases phrases.json] [--offset N] [--font-size N] [--job-config path]'
  );
  process.exit(1);
}

const processedPath = resolve(sheetDir, '_processed-sheet.png');
if (!existsSync(processedPath)) {
  throw new Error(`Missing ${processedPath}`);
}

async function loadOverlayTuning(): Promise<ProgrammaticTextOverlayTuning> {
  const configPath = jobConfigPath
    ? resolve(jobConfigPath)
    : resolve(sheetDir, '..', 'job.config.json');
  let partial: Partial<ProgrammaticTextOverlayTuning> | undefined;
  if (existsSync(configPath)) {
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      programmaticTextTuning?: Partial<ProgrammaticTextOverlayTuning>;
      fontKey?: keyof typeof FONT_PRESETS;
      textColorKey?: keyof typeof TEXT_COLOR_PRESETS;
    };
    partial = config.programmaticTextTuning;
    if (fontSizePercent != null) {
      partial = { ...partial, fontSizePercent };
    }
    return mergeProgrammaticTextTuning(partial);
  }
  return mergeProgrammaticTextTuning(
    fontSizePercent != null ? { fontSizePercent } : undefined
  );
}

let phrases: string[] = [];
if (phrasesPath) {
  const parsed = parsePhraseSetJson(await readFile(resolve(phrasesPath), 'utf8'));
  if (!parsed) throw new Error(`Invalid phrase-set: ${phrasesPath}`);
  phrases = parsed.phrases.slice(phraseOffset, phraseOffset + cols * rows);
} else {
  const manifestPath = resolve(sheetDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      stickers?: Array<{ phrase?: string }>;
    };
    phrases = (manifest.stickers ?? []).map((s) => s.phrase ?? '');
  }
}

const tuning = await loadOverlayTuning();
console.log(`Programmatic tuning: fontSizePercent=${tuning.fontSizePercent}`);

const image = decodeImage(new Uint8Array(await readFile(processedPath)));
const useGuided = existsSync(resolve(sheetDir, '_grid-template-guided.png'));
const templateBounds = buildEqualGridBounds(image.width, cols, rows);

let frames = sliceSheet(image, cols, rows, {
  sliceMode: useGuided ? 'template' : 'divider',
  guidedContentCrop: useGuided,
  templateBounds: useGuided ? templateBounds : undefined,
});

frames = frames.map((frame, i) =>
  trimFrameToContent(
    overlayPhraseOnRgbaFrame(frame, phrases[i] ?? '', {
      frameIndex: phraseOffset + i,
      tuning,
    })
  )
);

for (let i = 0; i < frames.length; i++) {
  const name = `sticker-${String(i + 1).padStart(2, '0')}.png`;
  await writeFile(resolve(sheetDir, name), encodePng(frames[i]!));
  console.log(`  ✓ ${name}`);
}

console.log(`Re-overlaid ${frames.length} stickers in ${sheetDir}`);
