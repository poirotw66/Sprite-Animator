/**
 * Re-slice a processed sheet and re-apply programmatic text overlay (no Gemini).
 *
 *   npx tsx reoverlay-sheet.mts <sheet-dir> [cols] [rows] [--phrases path.json] [--offset N]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { parsePhraseSetJson } from '../../../../utils/lineStickerPhraseSetFormat.ts';
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
for (let i = 3; i < argv.length; i++) {
  if (argv[i] === '--phrases' && argv[i + 1]) {
    phrasesPath = argv[++i]!;
  } else if (argv[i] === '--offset' && argv[i + 1]) {
    phraseOffset = Number.parseInt(argv[++i]!, 10);
  }
}

if (!sheetDir) {
  console.error(
    'Usage: reoverlay-sheet.mts <sheet-dir> [cols] [rows] [--phrases phrases.json] [--offset N]'
  );
  process.exit(1);
}

const processedPath = resolve(sheetDir, '_processed-sheet.png');
if (!existsSync(processedPath)) {
  throw new Error(`Missing ${processedPath}`);
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
    overlayPhraseOnRgbaFrame(frame, phrases[i] ?? '', { frameIndex: phraseOffset + i })
  )
);

for (let i = 0; i < frames.length; i++) {
  const name = `sticker-${String(i + 1).padStart(2, '0')}.png`;
  await writeFile(resolve(sheetDir, name), encodePng(frames[i]!));
  console.log(`  ✓ ${name}`);
}

console.log(`Re-overlaid ${frames.length} stickers in ${sheetDir}`);
