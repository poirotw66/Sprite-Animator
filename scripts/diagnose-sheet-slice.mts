/**
 * Diagnose grid boundaries and per-cell bleed on a processed sticker sheet.
 * Usage: npx tsx scripts/diagnose-sheet-slice.mts <sheet-dir> [cols] [rows]
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeImage } from '../.claude/skills/line-sticker-maker/scripts/nodeImage.mts';
import { detectSheetGridBoundaries } from '../utils/sheetBoundaryDetection.ts';
import { isSliceBackgroundPixel } from '../utils/imageContentAnalysis.ts';
import { scoreGridLayoutFromRgba } from '../utils/sheetGridValidation.ts';

const sheetDir = resolve(process.argv[2] ?? '');
const cols = Number(process.argv[3] ?? 4);
const rows = Number(process.argv[4] ?? 5);

function equalBounds(size: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, i) => Math.round((i * size) / count));
}

function bleedRatio(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  marginPx: number
): { top: number; bottom: number; left: number; right: number } {
  const m = Math.max(2, marginPx);
  let top = 0,
    bottom = 0,
    left = 0,
    right = 0;
  let topN = 0,
    bottomN = 0,
    leftN = 0,
    rightN = 0;

  for (let x = x0; x < x1; x++) {
    for (let y = y0; y < y0 + m; y++) {
      const o = (y * width + x) * 4;
      if (!isSliceBackgroundPixel(data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!)) top++;
      topN++;
    }
    for (let y = y1 - m; y < y1; y++) {
      const o = (y * width + x) * 4;
      if (!isSliceBackgroundPixel(data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!)) bottom++;
      bottomN++;
    }
  }
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x0 + m; x++) {
      const o = (y * width + x) * 4;
      if (!isSliceBackgroundPixel(data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!)) left++;
      leftN++;
    }
    for (let x = x1 - m; x < x1; x++) {
      const o = (y * width + x) * 4;
      if (!isSliceBackgroundPixel(data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!)) right++;
      rightN++;
    }
  }
  return {
    top: topN ? top / topN : 0,
    bottom: bottomN ? bottom / bottomN : 0,
    left: leftN ? left / leftN : 0,
    right: rightN ? right / rightN : 0,
  };
}

async function loadProcessed(sheetDir: string) {
  const path = resolve(sheetDir, '_processed-sheet.png');
  const bytes = new Uint8Array(await readFile(path));
  return decodeImage(bytes);
}

const img = await loadProcessed(sheetDir);
const { data, width, height } = img;
const detected = detectSheetGridBoundaries(data, width, height, cols, rows);
const equalX = equalBounds(width, cols);
const equalY = equalBounds(height, rows);
const score = scoreGridLayoutFromRgba(data, width, height, cols, rows);

function bleedForBounds(
  name: string,
  x: number[],
  y: number[] | null,
  yPerCol?: number[][]
) {
  let totalBleed = 0;
  let worst = { idx: 0, edge: 'top', v: 0 };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c + 1;
      const x0 = x[c]!;
      const x1 = x[c + 1]!;
      const colY = yPerCol?.[c] ?? y!;
      const y0 = colY[r]!;
      const y1 = colY[r + 1]!;
      const b = bleedRatio(data, width, x0, y0, x1, y1, 8);
      const maxEdge = Object.entries(b).reduce(
        (best, [edge, v]) => (v > best.v ? { edge, v } : best),
        { edge: 'top', v: 0 }
      );
      totalBleed += b.top + b.bottom + b.left + b.right;
      if (maxEdge.v > worst.v) worst = { idx, edge: maxEdge.edge, v: maxEdge.v };
    }
  }
  console.log(
    `[${name}] avg edge bleed=${(totalBleed / (cols * rows * 4)).toFixed(3)}  worst=sticker-${String(worst.idx).padStart(2, '0')} ${worst.edge}=${worst.v.toFixed(3)}`
  );
}

console.log(`\n${sheetDir}`);
console.log(`Size ${width}×${height}  grid ${cols}×${rows}  score=${score.toFixed(3)}`);
console.log(`Detected x: ${detected.xBounds.join(', ')}`);
console.log(`Equal    x: ${equalX.join(', ')}`);
console.log(`Detected y (median): ${detected.yBounds.join(', ')}`);
console.log(`Equal    y: ${equalY.join(', ')}`);

bleedForBounds('detected-median-y', detected.xBounds, detected.yBounds);
bleedForBounds('detected-per-col-y', detected.xBounds, null, detected.yBoundsPerColumn);
bleedForBounds('equal', equalX, equalY);
