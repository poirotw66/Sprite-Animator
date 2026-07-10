/**
 * Compare agent-sprite-forge remove_bg_magenta vs chromaKeyCore on a raw sheet.
 *
 * Usage:
 *   npx tsx compare-chroma-forge.mts <sheet-dir> [sticker-index] [cols] [rows]
 *
 * Example:
 *   npx tsx .../compare-chroma-forge.mts output/twice-1-school-daily-non-word/sheet-1 1 4 5
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHROMA_KEY_COLORS } from '../../../../utils/constants.ts';
import { decodeImage, encodePng, processSheetChromaKey, type RgbaImage } from './nodeImage.mts';

const sheetDir = resolve(process.argv[2] ?? '');
const stickerIndex = Math.max(1, Number(process.argv[3] ?? 1));
const cols = Number(process.argv[4] ?? 4);
const rows = Number(process.argv[5] ?? 5);
const chromaKeyColor = 'green' as const;
const cellIndex = stickerIndex - 1;

if (!sheetDir) {
  console.error('Usage: compare-chroma-forge.mts <sheet-dir> [sticker-index] [cols] [rows]');
  process.exit(1);
}

function cloneImage(image: RgbaImage): RgbaImage {
  return { data: new Uint8ClampedArray(image.data), width: image.width, height: image.height };
}

function compositeOnBlack(image: RgbaImage): RgbaImage {
  const out = cloneImage(image);
  const { data } = out;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    data[i] = Math.round(data[i]! * a);
    data[i + 1] = Math.round(data[i + 1]! * a);
    data[i + 2] = Math.round(data[i + 2]! * a);
    data[i + 3] = 255;
  }
  return out;
}

function alphaVisualization(image: RgbaImage): RgbaImage {
  const { width, height, data: src } = image;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const a = src[p * 4 + 3]!;
    const i = p * 4;
    data[i] = a;
    data[i + 1] = a;
    data[i + 2] = a;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function cropCell(image: RgbaImage, col: number, row: number, gridCols: number, gridRows: number): RgbaImage {
  const cellW = Math.floor(image.width / gridCols);
  const cellH = Math.floor(image.height / gridRows);
  const x0 = col * cellW;
  const y0 = row * cellH;
  const w = cellW;
  const h = cellH;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * image.width + (x0 + x)) * 4;
      const di = (y * w + x) * 4;
      data[di] = image.data[si]!;
      data[di + 1] = image.data[si + 1]!;
      data[di + 2] = image.data[si + 2]!;
      data[di + 3] = image.data[si + 3]!;
    }
  }
  return { data, width: w, height: h };
}

function cropZoom(image: RgbaImage, cx: number, cy: number, radius: number): RgbaImage {
  const x0 = Math.max(0, cx - radius);
  const y0 = Math.max(0, cy - radius);
  const x1 = Math.min(image.width, cx + radius);
  const y1 = Math.min(image.height, cy + radius);
  const w = x1 - x0;
  const h = y1 - y0;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * image.width + (x0 + x)) * 4;
      const di = (y * w + x) * 4;
      data[di] = image.data[si]!;
      data[di + 1] = image.data[si + 1]!;
      data[di + 2] = image.data[si + 2]!;
      data[di + 3] = image.data[si + 3]!;
    }
  }
  return { data, width: w, height: h };
}

function sideBySide(left: RgbaImage, right: RgbaImage, gap = 8): RgbaImage {
  const h = Math.max(left.height, right.height);
  const w = left.width + gap + right.width;
  const data = new Uint8ClampedArray(w * h * 4);
  const blit = (src: RgbaImage, dx: number): void => {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = (y * src.width + x) * 4;
        const di = (y * w + (dx + x)) * 4;
        data[di] = src.data[si]!;
        data[di + 1] = src.data[si + 1]!;
        data[di + 2] = src.data[si + 2]!;
        data[di + 3] = src.data[si + 3]!;
      }
    }
  };
  blit(left, 0);
  blit(right, left.width + gap);
  return { data, width: w, height: h };
}

async function findRawSheet(dir: string): Promise<string> {
  for (const name of ['_raw-sheet.jpg', '_raw-sheet.png', '_raw-sheet.jpeg']) {
    const p = resolve(dir, name);
    if (existsSync(p)) return p;
  }
  const entries = await readdir(dir);
  const hit = entries.find((n) => n.startsWith('_raw-sheet.'));
  if (!hit) throw new Error(`No _raw-sheet.* in ${dir}`);
  return resolve(dir, hit);
}

async function main(): Promise<void> {
  const rawPath = await findRawSheet(sheetDir);
  const outDir = resolve(sheetDir, '_compare-chroma-forge');
  await mkdir(outDir, { recursive: true });

  const rawBytes = new Uint8Array(await readFile(rawPath));
  const decoded = decodeImage(rawBytes);
  const key = CHROMA_KEY_COLORS[chromaKeyColor];

  console.log(`▶ raw: ${rawPath} (${decoded.width}×${decoded.height})`);
  console.log(`▶ key: green RGB(${key.r},${key.g},${key.b})`);
  console.log(`▶ forge params: threshold=100, edge_threshold=150 (agent-sprite-forge defaults)`);

  const forgeImage = processSheetChromaKey(cloneImage(decoded), chromaKeyColor, {
    guided: true,
    algorithm: 'forge',
  });
  const coreImage = processSheetChromaKey(cloneImage(decoded), chromaKeyColor, {
    guided: true,
    algorithm: 'core',
  });

  const row = Math.floor(cellIndex / cols);
  const col = cellIndex % cols;
  const forgeCell = cropCell(forgeImage, col, row, cols, rows);
  const coreCell = cropCell(coreImage, col, row, cols, rows);

  const saves: Array<[string, RgbaImage]> = [
    ['00-input-raw', decoded],
    ['01-forge-full-black', compositeOnBlack(forgeImage)],
    ['02-core-full-black', compositeOnBlack(coreImage)],
    ['03-side-by-side-full-black', sideBySide(compositeOnBlack(forgeImage), compositeOnBlack(coreImage))],
    ['04-side-by-side-full-alpha', sideBySide(alphaVisualization(forgeImage), alphaVisualization(coreImage))],
    [`05-forge-sticker-${String(stickerIndex).padStart(2, '0')}-black`, compositeOnBlack(forgeCell)],
    [`06-core-sticker-${String(stickerIndex).padStart(2, '0')}-black`, compositeOnBlack(coreCell)],
    [
      `07-side-by-side-sticker-${String(stickerIndex).padStart(2, '0')}-black`,
      sideBySide(compositeOnBlack(forgeCell), compositeOnBlack(coreCell)),
    ],
    [
      `08-side-by-side-sticker-${String(stickerIndex).padStart(2, '0')}-alpha`,
      sideBySide(alphaVisualization(forgeCell), alphaVisualization(coreCell)),
    ],
  ];

  const zoomR = Math.min(forgeCell.width, forgeCell.height) / 3;
  const zoomCx = Math.floor(forgeCell.width / 2);
  const zoomCy = Math.floor(forgeCell.height * 0.85);
  saves.push([
    `09-edge-zoom-sticker-${String(stickerIndex).padStart(2, '0')}-black`,
    sideBySide(
      compositeOnBlack(cropZoom(forgeCell, zoomCx, zoomCy, zoomR)),
      compositeOnBlack(cropZoom(coreCell, zoomCx, zoomCy, zoomR)),
      4
    ),
  ]);

  for (const [name, img] of saves) {
    await writeFile(resolve(outDir, `${name}.png`), encodePng(img));
    console.log(`  ✓ ${name}.png`);
  }

  const meta = {
    rawSheet: rawPath,
    chromaKeyColor,
    forge: { algorithm: 'agent-sprite-forge remove_bg_magenta (ported)', threshold: 100, edgeThreshold: 150 },
    core: { algorithm: 'chromaKeyCore + normalizeChromaBackground', guided: true },
    stickerIndex,
    grid: { cols, rows },
    outputs: saves.map(([name]) => `${name}.png`),
    notes: [
      'Left column in side-by-side images = forge (RGB distance + border flood).',
      'Right column = chromaKeyCore (HSL similarity + multi-pass despill).',
      'Forge algorithm originally targets #FF00FF; here key RGB is adapted to job green.',
    ],
  };
  await writeFile(resolve(outDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`\n✓ Done → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
