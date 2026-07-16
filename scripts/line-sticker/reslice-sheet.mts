/**
 * Re-slice an existing sheet folder without calling Gemini again.
 *
 *   npx tsx reslice-sheet.mts <sheet-dir> [cols] [rows] [template|detect|divider]
 *     [--algorithm core|forge|legacy] [--out-dir <path>]
 *
 * --out-dir writes stickers + _processed-sheet.png to a separate folder (does not overwrite source stickers).
 */

import { copyFile, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
} from '../../utils/sheetGridValidation.ts';
import { buildEqualGridBounds } from '../../utils/gridSheetTemplate.ts';
import { resolveSliceTemplateBounds } from '../../utils/lineStickerGridTemplate.ts';
import { trimFrameToContent } from '../../utils/sheetComponentSlicer.ts';
import { clearDetectedSheetGridDividers } from '../../utils/sheetWhiteDividerDetection.ts';
import { DEFAULT_CHROMA_KEY_ALGORITHM } from '../../utils/constants.ts';
import type { ChromaKeyAlgorithm } from '../../types.ts';

function parseArgs(argv: string[]): {
  sheetDir: string;
  cols: number;
  rows: number;
  sliceModeArg: string;
  algorithm: ChromaKeyAlgorithm;
  outDir?: string;
} {
  const positional: string[] = [];
  let algorithm: ChromaKeyAlgorithm = DEFAULT_CHROMA_KEY_ALGORITHM;
  let outDir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === '--algorithm' && argv[i + 1]) {
      algorithm = argv[++i]! as ChromaKeyAlgorithm;
    } else if (token === '--out-dir' && argv[i + 1]) {
      outDir = resolve(argv[++i]!);
    } else if (!token.startsWith('--')) {
      positional.push(token);
    }
  }

  return {
    sheetDir: resolve(positional[0] ?? ''),
    cols: Number(positional[1] ?? 4),
    rows: Number(positional[2] ?? 5),
    sliceModeArg: positional[3] ?? '',
    algorithm,
    outDir,
  };
}

const { sheetDir, cols, rows, sliceModeArg, algorithm, outDir } = parseArgs(process.argv.slice(2));
const chromaKeyColor = 'green' as const;
const writeDir = outDir ?? sheetDir;

if (!sheetDir) {
  console.error(
    'Usage: reslice-sheet.mts <sheet-dir> [cols] [rows] [template] [--algorithm core|forge|legacy] [--out-dir <path>]'
  );
  process.exit(1);
}

async function findRawSheet(): Promise<string> {
  const entries = await readdir(sheetDir);
  const raw = entries.find((name) => name.startsWith('_raw-sheet.'));
  if (!raw) throw new Error(`No _raw-sheet.* in ${sheetDir}`);
  return resolve(sheetDir, raw);
}

const hasGuidedTemplateFile = existsSync(resolve(sheetDir, '_grid-template-guided.png'));
const useGuidedTemplate =
  sliceModeArg === 'template' ||
  (sliceModeArg !== 'detect' &&
    sliceModeArg !== 'divider' &&
    hasGuidedTemplateFile);
const useDetect = sliceModeArg === 'detect';

const rawPath = await findRawSheet();
const rawBytes = new Uint8Array(await readFile(rawPath));
const image = decodeImage(rawBytes);

const jobConfigPath = resolve(sheetDir, '..', 'job.config.json');
const config = existsSync(jobConfigPath)
  ? (JSON.parse(await readFile(jobConfigPath, 'utf8')) as { textRendering?: 'model' | 'programmatic' })
  : {};
const preserveCellAlphaThreshold = config.textRendering === 'model' ? 8 : undefined;

await mkdir(writeDir, { recursive: true });

processSheetChromaKey(image, chromaKeyColor, { guided: useGuidedTemplate, algorithm });
const dividerCleanup = clearDetectedSheetGridDividers(
  image.data,
  image.width,
  image.height,
  cols,
  rows
);
if (dividerCleanup.applied) {
  console.log(
    `Cleared ${dividerCleanup.cleared} vertical grid divider pixels (${dividerCleanup.verticalBands} band(s))`
  );
}
await writeFile(resolve(writeDir, '_processed-sheet.png'), encodePng(image));
console.log(`Chroma algorithm: ${algorithm}${useGuidedTemplate ? ' + guided' : ''}`);
if (outDir) {
  console.log(`Output dir: ${writeDir} (source stickers untouched)`);
}

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

const guidedTemplateBounds = hasGuidedTemplateFile
  ? buildEqualGridBounds(image.width, cols, rows)
  : null;
const sliceBounds = resolveSliceTemplateBounds(
  image.data,
  image.width,
  image.height,
  cols,
  rows,
  guidedTemplateBounds
);
const useTemplateSlice = useDetect ? false : useGuidedTemplate || sliceBounds.source === 'detected';
console.log(
  useDetect
    ? 'Slice mode: detect (per-cell content crop)'
    : useTemplateSlice
      ? `Slice mode: template + ownership (${
          sliceBounds.source === 'guided-template' ? 'guided grid' : 'detected grid'
        }${preserveCellAlphaThreshold ? ', preserve cell alpha' : ''})`
      : 'Slice mode: divider (white grid lines excluded when detected)'
);

// ponytail: reslice writes final stickers with no overlay step after it, so trim here.
const frames = sliceSheet(image, cols, rows, {
  sliceMode: useDetect ? 'detect' : useTemplateSlice ? 'template' : 'divider',
  preserveCellAlphaThreshold,
  guidedContentCrop: useGuidedTemplate,
  templateBounds: useTemplateSlice ? sliceBounds : undefined,
  detectBoundaries: useDetect,
}).map((frame) => trimFrameToContent(frame));
for (let i = 0; i < frames.length; i++) {
  const name = `sticker-${String(i + 1).padStart(2, '0')}.png`;
  await writeFile(resolve(writeDir, name), encodePng(frames[i]!));
  console.log(`  ✓ ${name} (${frames[i]!.width}×${frames[i]!.height})`);
}

if (outDir) {
  const rawName = rawPath.split(/[/\\]/).pop()!;
  await copyFile(rawPath, resolve(writeDir, rawName));
  for (const gridName of ['_grid-template-guided.png', '_grid-template.png']) {
    const src = resolve(sheetDir, gridName);
    if (existsSync(src)) {
      await copyFile(src, resolve(writeDir, gridName));
    }
  }
}
