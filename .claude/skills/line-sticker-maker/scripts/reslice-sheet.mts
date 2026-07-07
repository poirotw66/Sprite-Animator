/**
 * Re-slice an existing sheet folder without calling Gemini again.
 * Usage: npx tsx .claude/skills/line-sticker-maker/scripts/reslice-sheet.mts <sheet-dir> [cols] [rows]
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  decodeImage,
  encodePng,
  processSheetChromaKey,
  sliceSheet,
} from './nodeImage.mts';
import {
  buildGridCandidates,
  detectBestGridLayoutFromRgba,
  validateSheetGrid,
} from '../../../../utils/sheetGridValidation.ts';

const sheetDir = resolve(process.argv[2] ?? '');
const cols = Number(process.argv[3] ?? 4);
const rows = Number(process.argv[4] ?? 5);
const chromaKeyColor = 'green' as const;

if (!sheetDir) {
  console.error('Usage: reslice-sheet.mts <sheet-dir> [cols] [rows]');
  process.exit(1);
}

async function findRawSheet(): Promise<string> {
  const entries = await readdir(sheetDir);
  const raw = entries.find((name) => name.startsWith('_raw-sheet.'));
  if (!raw) throw new Error(`No _raw-sheet.* in ${sheetDir}`);
  return resolve(sheetDir, raw);
}

const rawPath = await findRawSheet();
const rawBytes = new Uint8Array(await readFile(rawPath));
const image = decodeImage(rawBytes);
processSheetChromaKey(image, chromaKeyColor);
await writeFile(resolve(sheetDir, '_processed-sheet.png'), encodePng(image));

const expected = validateSheetGrid(image.data, image.width, image.height, cols, rows, {
  minScore: 0,
  ...buildGridCandidates(cols, rows),
});
const detected = detectBestGridLayoutFromRgba(
  image.data,
  image.width,
  image.height,
  [3, 4, 5],
  [4, 5, 6]
);
console.log(`Sheet ${image.width}×${image.height}`);
console.log(`Expected ${cols}×${rows} score=${expected.expected.score.toFixed(3)}`);
console.log(`Best fit ${detected.cols}×${detected.rows} score=${detected.score.toFixed(3)}`);
if (!expected.ok) {
  console.warn(
    `⚠ Grid mismatch — stickers may still look wrong until you re-generate the sheet with a corrected layout.`
  );
}

const frames = sliceSheet(image, cols, rows);
for (let i = 0; i < frames.length; i++) {
  const name = `sticker-${String(i + 1).padStart(2, '0')}.png`;
  await writeFile(resolve(sheetDir, name), encodePng(frames[i]!));
  console.log(`  ✓ ${name} (${frames[i]!.width}×${frames[i]!.height})`);
}
