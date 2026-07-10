/**
 * Dump each sticker-processing stage as PNG for edge-quality debugging.
 *
 * Usage:
 *   npx tsx .claude/skills/line-sticker-maker/scripts/debug-sticker-pipeline.mts <sheet-dir> [sticker-index] [cols] [rows]
 *
 * Example:
 *   npx tsx .../debug-sticker-pipeline.mts output/foo/sheet-1 1 4 5
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decodeImage,
  encodePng,
  normalizeChromaBackground,
  removeChromaKey,
  sliceSheet,
  type RgbaImage,
} from './nodeImage.mts';
import { buildEqualGridBounds } from '../../../../utils/gridSheetTemplate.ts';
import { clearSmallOpaqueIslands } from '../../../../utils/frameEdgeCleanup.ts';
import { featherAlphaEdge } from '../../../../utils/alphaEdgeFeather.ts';
import { repairExteriorStrokeHalo, clearDetachedStrokeCrumbs } from '../../../../utils/solidifyStrokeWhite.ts';

const sheetDir = resolve(process.argv[2] ?? '');
const stickerIndex = Math.max(1, Number(process.argv[3] ?? 1));
const cols = Number(process.argv[4] ?? 4);
const rows = Number(process.argv[5] ?? 5);
const chromaKeyColor = 'green' as const;
const cellIndex = stickerIndex - 1;

if (!sheetDir) {
  console.error(
    'Usage: debug-sticker-pipeline.mts <sheet-dir> [sticker-index] [cols] [rows]'
  );
  process.exit(1);
}

function cloneImage(image: RgbaImage): RgbaImage {
  return {
    data: new Uint8ClampedArray(image.data),
    width: image.width,
    height: image.height,
  };
}

async function saveStage(
  outDir: string,
  name: string,
  image: RgbaImage,
  note?: string
): Promise<void> {
  const path = resolve(outDir, `${name}.png`);
  await writeFile(path, encodePng(image));
  console.log(`  ✓ ${name}.png (${image.width}×${image.height})${note ? ` — ${note}` : ''}`);
}

function compositeOnBlack(image: RgbaImage): RgbaImage {
  const out = cloneImage(image);
  const { data, width, height } = out;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    data[i] = Math.round(data[i]! * a);
    data[i + 1] = Math.round(data[i + 1]! * a);
    data[i + 2] = Math.round(data[i + 2]! * a);
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function alphaVisualization(image: RgbaImage): RgbaImage {
  const { width, height } = image;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const a = image.data[p * 4 + 3]!;
    const i = p * 4;
    data[i] = a;
    data[i + 1] = a;
    data[i + 2] = a;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function cropOpaqueBounds(image: RgbaImage, marginRatio = 0.05): RgbaImage {
  const { data, width, height } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return cloneImage(image);

  const margin = Math.max(6, Math.round(Math.min(width, height) * marginRatio));
  const x0 = Math.max(0, minX - margin);
  const y0 = Math.max(0, minY - margin);
  const x1 = Math.min(width, maxX + 1 + margin);
  const y1 = Math.min(height, maxY + 1 + margin);
  const outW = x1 - x0;
  const outH = y1 - y0;
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = y0; y < y1; y++) {
    const srcRow = (y * width + x0) * 4;
    const dstRow = (y - y0) * outW * 4;
    out.set(data.subarray(srcRow, srcRow + outW * 4), dstRow);
  }
  return { data: out, width: outW, height: outH };
}

/** 3× zoom of top-left opaque corner for edge inspection. */
function edgeZoom(image: RgbaImage, scale = 3): RgbaImage {
  const onBlack = compositeOnBlack(image);
  const { data, width, height } = onBlack;
  let minX = width;
  let minY = height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i]! < 250 || data[i + 1]! < 250 || data[i + 2]! < 250) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
      }
    }
  }
  const cropW = Math.min(48, width - minX);
  const cropH = Math.min(48, height - minY);
  if (cropW <= 0 || cropH <= 0) return onBlack;

  const outW = cropW * scale;
  const outH = cropH * scale;
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const sx = minX + Math.floor(dx / scale);
      const sy = minY + Math.floor(dy / scale);
      const src = (sy * width + sx) * 4;
      const dst = (dy * outW + dx) * 4;
      out[dst] = data[src]!;
      out[dst + 1] = data[src + 1]!;
      out[dst + 2] = data[src + 2]!;
      out[dst + 3] = 255;
    }
  }
  return { data: out, width: outW, height: outH };
}

async function findRawSheet(): Promise<string> {
  const entries = await readdir(sheetDir);
  const raw = entries.find((name) => name.startsWith('_raw-sheet.'));
  if (!raw) throw new Error(`No _raw-sheet.* in ${sheetDir}`);
  return resolve(sheetDir, raw);
}

const useGuidedTemplate = existsSync(resolve(sheetDir, '_grid-template-guided.png'));
const templateBounds = buildEqualGridBounds(1024, cols, rows);
const outDir = resolve(sheetDir, `_debug-pipeline-sticker-${String(stickerIndex).padStart(2, '0')}`);
await mkdir(outDir, { recursive: true });

const rawBytes = new Uint8Array(await readFile(await findRawSheet()));
const decoded = decodeImage(rawBytes);

console.log(`Debug pipeline → ${outDir}`);
console.log(`Sticker index: ${stickerIndex} (${cols}×${rows}, guided=${useGuidedTemplate})`);

await saveStage(outDir, '00-decode-raw-full', decoded, 'JPEG/PNG decode only');

const rawCellFrames = sliceSheet(decoded, cols, rows, {
  sliceMode: useGuidedTemplate ? 'template' : 'detect',
  guidedContentCrop: useGuidedTemplate,
  templateBounds: useGuidedTemplate ? templateBounds : undefined,
});
const rawCell = rawCellFrames[cellIndex];
if (!rawCell) throw new Error(`Cell ${stickerIndex} missing from raw slice`);
await saveStage(outDir, '01-raw-cell-before-chroma', rawCell, 'sliced from decode, no chroma key');
await saveStage(outDir, '01-edge-raw-cell', edgeZoom(rawCell), '3× zoom top-left edge');

const normalized = cloneImage(decoded);
normalizeChromaBackground(normalized, chromaKeyColor);
await saveStage(outDir, '02-normalize-chroma-full', normalized, 'snap green variants to target');

const chromaKeyed = cloneImage(normalized);
removeChromaKey(chromaKeyed, chromaKeyColor, { guided: useGuidedTemplate });
await saveStage(outDir, '03-chroma-key-full', chromaKeyed, 'after processChromaKey');
await saveStage(outDir, '03-alpha-chroma-key-full', alphaVisualization(chromaKeyed), 'alpha channel');

const slicedFrames = sliceSheet(chromaKeyed, cols, rows, {
  sliceMode: useGuidedTemplate ? 'template' : 'detect',
  guidedContentCrop: useGuidedTemplate,
  templateBounds: useGuidedTemplate ? templateBounds : undefined,
});
const cell = slicedFrames[cellIndex];
if (!cell) throw new Error(`Cell ${stickerIndex} missing after chroma slice`);
await saveStage(outDir, '04-sliced-cell', cell, 'cell extract after chroma key');
await saveStage(outDir, '04-edge-sliced-cell', edgeZoom(cell), '3× zoom — chroma key culprit check');
await saveStage(outDir, '04-alpha-sliced-cell', alphaVisualization(cell), 'alpha after slice');

const afterIslands = cloneImage(cell);
clearSmallOpaqueIslands(afterIslands.data, afterIslands.width, afterIslands.height, {
  maxIslandSize: 80,
});
await saveStage(outDir, '05-after-island-clear', afterIslands, 'clearSmallOpaqueIslands');

const cropped = cropOpaqueBounds(afterIslands);
await saveStage(outDir, '06-after-crop', cropped, 'bounding box + margin');
await saveStage(outDir, '06-edge-after-crop', edgeZoom(cropped));

const afterRepair = cloneImage(cropped);
repairExteriorStrokeHalo(afterRepair.data, afterRepair.width, afterRepair.height, 2);
await saveStage(outDir, '07-after-repair-halo', afterRepair, 'repairExteriorStrokeHalo expandPx=2');
await saveStage(outDir, '07-edge-after-repair', edgeZoom(afterRepair));

const afterFeather = cloneImage(afterRepair);
featherAlphaEdge(afterFeather.data, afterFeather.width, afterFeather.height);
await saveStage(outDir, '08-after-feather', afterFeather, 'featherAlphaEdge');
await saveStage(outDir, '08-alpha-after-feather', alphaVisualization(afterFeather));
await saveStage(outDir, '08-edge-after-feather', edgeZoom(afterFeather));

const final = cloneImage(afterFeather);
clearDetachedStrokeCrumbs(final.data, final.width, final.height);
await saveStage(outDir, '09-final', final, 'clearDetachedStrokeCrumbs');
await saveStage(outDir, '09-edge-final', edgeZoom(final), 'compare to 04-edge');

await writeFile(
  resolve(outDir, 'README.txt'),
  [
    'Sticker pipeline debug dumps (sticker-' + String(stickerIndex).padStart(2, '0') + ')',
    '',
    'Full frames:',
    '  00 decode raw (no processing)',
    '  01 raw cell before chroma key',
    '  02 normalize chroma background (full sheet)',
    '  03 chroma key removal (full sheet) — main suspect if 04-edge is already rough',
    '  04 sliced cell after chroma',
    '  05 after clearSmallOpaqueIslands',
    '  06 after crop to content bounds',
    '  07 after repairExteriorStrokeHalo',
    '  08 after featherAlphaEdge',
    '  09 final after clearDetachedStrokeCrumbs',
    '',
    'Edge zoom (3×, top-left corner, on black):',
    '  01-edge-raw-cell vs 04-edge-sliced-cell vs 09-edge-final',
    '',
    'Alpha visualizations (grayscale = alpha):',
    '  03-alpha-chroma-key-full, 04-alpha-sliced-cell, 08-alpha-after-feather',
  ].join('\n'),
  'utf8'
);

console.log(`\nDone. Open ${outDir}`);
