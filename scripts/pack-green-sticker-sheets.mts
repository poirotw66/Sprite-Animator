/**
 * Convert two already-generated 4x5 green-screen sticker sheets into a
 * transparent 40-sticker LINE set without calling an image model.
 *
 * The raw sheets may have different dimensions. Grid boundaries are detected
 * per sheet after chroma removal, then connected-component ownership prevents
 * neighbouring stickers from leaking across a divider.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import JSZip from 'jszip';
import sharp from 'sharp';

import {
  decodeImage,
  encodePng,
  type RgbaImage,
} from './line-sticker/nodeImage.mts';
import { detectSheetGridBoundaries } from '../utils/sheetBoundaryDetection.ts';
import {
  sliceSheetByComponentOwnership,
} from '../utils/sheetComponentSlicer.ts';
import { clearEdgeConnectedResidue, clearThinEdgeBleedFragments } from '../utils/frameEdgeCleanup.ts';
import { addExteriorWhiteStroke } from '../utils/paperBackgroundMatte.ts';
import { featherAlphaEdge } from '../utils/alphaEdgeFeather.ts';

const DEFAULT_COLS = 4;
const DEFAULT_ROWS = 5;

function parseArgs(argv: string[]): {
  sheets: [string, string];
  out: string;
  cols: number;
  rows: number;
  bg: 'green' | 'white';
} {
  const sheets: string[] = [];
  let out = '';
  let cols = DEFAULT_COLS;
  let rows = DEFAULT_ROWS;
  let bg: 'green' | 'white' = 'green';
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === '--out' && argv[i + 1]) out = resolve(argv[++i]!);
    else if (token === '--cols' && argv[i + 1]) cols = Math.max(1, Number(argv[++i]));
    else if (token === '--rows' && argv[i + 1]) rows = Math.max(1, Number(argv[++i]));
    else if (token === '--bg' && argv[i + 1]) {
      const value = String(argv[++i]).toLowerCase();
      if (value !== 'green' && value !== 'white') {
        throw new Error(`Invalid --bg: ${value} (use green|white)`);
      }
      bg = value;
    } else if (!token.startsWith('--')) sheets.push(resolve(token));
  }
  if (sheets.length !== 2 || !out) {
    throw new Error(
      'Usage: npx tsx scripts/pack-green-sticker-sheets.mts <sheet1.png> <sheet2.png> --out <folder> [--cols 4] [--rows 5] [--bg green|white]'
    );
  }
  return { sheets: [sheets[0]!, sheets[1]!], out, cols, rows, bg };
}

function alphaStats(image: RgbaImage): { transparent: number; soft: number; opaque: number } {
  let transparent = 0;
  let soft = 0;
  let opaque = 0;
  for (let i = 3; i < image.data.length; i += 4) {
    const alpha = image.data[i]!;
    if (alpha === 0) transparent++;
    else if (alpha === 255) opaque++;
    else soft++;
  }
  return { transparent, soft, opaque };
}

/**
 * Recover a soft matte from a saturated green screen.
 *
 * Green-screen edge pixels are mixtures of foreground and green, so a binary
 * threshold destroys the original antialiasing. Green dominance provides a
 * stable coverage estimate for this character because its palette has no
 * green: neutral white/black and orange/brown all have low or negative values.
 */
function applySoftGreenMatte(image: RgbaImage): { keyDominance: number; softStart: number; hardKey: number } {
  const samples: number[] = [];
  for (let p = 0; p < image.width * image.height; p++) {
    const i = p * 4;
    const r = image.data[i]!;
    const g = image.data[i + 1]!;
    const b = image.data[i + 2]!;
    if (g > 120 && g > r * 1.35 && g > b * 1.35) samples.push(g - Math.max(r, b));
  }
  samples.sort((a, b) => a - b);
  const keyDominance = samples[Math.floor(samples.length * 0.5)] ?? 180;
  const softStart = 5;
  const hardKey = Math.max(65, keyDominance * 0.82);
  const range = hardKey - softStart;

  for (let p = 0; p < image.width * image.height; p++) {
    const i = p * 4;
    const r = image.data[i]!;
    const g = image.data[i + 1]!;
    const b = image.data[i + 2]!;
    const dominance = g - Math.max(r, b);
    let alpha = 255;
    if (dominance >= hardKey) alpha = 0;
    else if (dominance > softStart) {
      const coverage = (hardKey - dominance) / range;
      // Smoothstep avoids a visible alpha kink at both ends of the transition.
      const smooth = coverage * coverage * (3 - 2 * coverage);
      alpha = Math.round(255 * smooth);
    }

    if (alpha <= 6) {
      image.data[i] = 0;
      image.data[i + 1] = 0;
      image.data[i + 2] = 0;
      image.data[i + 3] = 0;
      continue;
    }

    image.data[i + 3] = alpha;
    if (dominance > softStart) {
      // Remove the green contribution from RGB. Alpha already carries coverage;
      // keeping green here would create a neon fringe on dark chat themes.
      image.data[i + 1] = Math.min(g, Math.max(r, b));
    }
  }
  return { keyDominance, softStart, hardKey };
}

/** Edge-connected near-white paper removal (preserves enclosed white fills). */
function applyWhitePaperMatte(image: RgbaImage): { cleared: number; maxDist: number } {
  const maxDist = 18;
  const { data, width, height } = image;
  const nearWhite = (r: number, g: number, b: number): boolean => {
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    return min >= 235 && max - min <= 18;
  };

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  let cleared = 0;

  const trySeed = (x: number, y: number): void => {
    const p = y * width + x;
    if (visited[p]) return;
    const i = p * 4;
    if (data[i + 3]! < 8) {
      visited[p] = 1;
      queue.push(p);
      return;
    }
    if (!nearWhite(data[i]!, data[i + 1]!, data[i + 2]!)) return;
    visited[p] = 1;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
    cleared++;
    queue.push(p);
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const p = queue[head++]!;
    const x = p % width;
    const y = (p - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const np = ny * width + nx;
        if (visited[np]) continue;
        const i = np * 4;
        if (data[i + 3]! < 8) {
          visited[np] = 1;
          queue.push(np);
          continue;
        }
        if (!nearWhite(data[i]!, data[i + 1]!, data[i + 2]!)) {
          visited[np] = 1;
          continue;
        }
        visited[np] = 1;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
        cleared++;
        queue.push(np);
      }
    }
  }

  return { cleared, maxDist };
}

function trimWithoutDroppingDetails(frame: RgbaImage, marginRatio = 0.06): RgbaImage {
  const { data, width, height } = frame;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return frame;
  const margin = Math.max(8, Math.round(Math.min(width, height) * marginRatio));
  const x0 = Math.max(0, minX - margin);
  const y0 = Math.max(0, minY - margin);
  const x1 = Math.min(width, maxX + margin + 1);
  const y1 = Math.min(height, maxY + margin + 1);
  const outWidth = x1 - x0;
  const outHeight = y1 - y0;
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = y0; y < y1; y++) {
    const source = (y * width + x0) * 4;
    out.set(data.subarray(source, source + outWidth * 4), (y - y0) * outWidth * 4);
  }
  return { data: out, width: outWidth, height: outHeight };
}

function addLineSafeStroke(frame: RgbaImage, radius = 3): void {
  addExteriorWhiteStroke(frame.data, frame.width, frame.height, radius);
  featherAlphaEdge(frame.data, frame.width, frame.height, { erodePx: 0, blurRadiusPx: 1 });
  for (let p = 0; p < frame.width * frame.height; p++) {
    const i = p * 4;
    if (frame.data[i + 3]! !== 0) continue;
    frame.data[i] = 0;
    frame.data[i + 1] = 0;
    frame.data[i + 2] = 0;
  }
}

async function makeContactSheet(
  frames: RgbaImage[],
  outputPath: string,
  background: { r: number; g: number; b: number },
  cols: number,
  rows: number,
): Promise<void> {
  const cellWidth = 370;
  const cellHeight = 320;
  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const png = Buffer.from(encodePng(frame));
    const fitted = await sharp(png)
      .resize({ width: cellWidth - 20, height: cellHeight - 20, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const meta = await sharp(fitted).metadata();
    composites.push({
      input: fitted,
      left: (i % cols) * cellWidth + Math.floor((cellWidth - (meta.width ?? 0)) / 2),
      top: Math.floor(i / cols) * cellHeight + Math.floor((cellHeight - (meta.height ?? 0)) / 2),
    });
  }
  await sharp({
    create: {
      width: cols * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: { ...background, alpha: 1 },
    },
  }).composite(composites).png().toFile(outputPath);
}

async function makeLineSticker(frame: RgbaImage): Promise<Buffer> {
  const source = Buffer.from(encodePng(frame));
  const fitted = await sharp(source)
    .resize({ width: 350, height: 300, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
  const meta = await sharp(fitted).metadata();
  return sharp({
    create: {
      width: 370,
      height: 320,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: fitted,
      left: Math.floor((370 - (meta.width ?? 0)) / 2),
      top: Math.floor((320 - (meta.height ?? 0)) / 2),
    }])
    .png()
    .toBuffer();
}

async function processSheet(
  path: string,
  outputDir: string,
  cols: number,
  rows: number,
  bg: 'green' | 'white',
): Promise<RgbaImage[]> {
  await mkdir(outputDir, { recursive: true });
  const rawBytes = new Uint8Array(await readFile(path));
  const image = decodeImage(rawBytes);

  if (bg === 'white') {
    const matte = applyWhitePaperMatte(image);
    console.log(`${basename(path)} ${image.width}x${image.height} grid=${cols}x${rows} bg=white`);
    console.log(`  white matte cleared=${matte.cleared} maxDist=${matte.maxDist}`);
  } else {
    const matte = applySoftGreenMatte(image);
    console.log(`${basename(path)} ${image.width}x${image.height} grid=${cols}x${rows} bg=green`);
    console.log(`  green matte key=${matte.keyDominance.toFixed(1)} soft=${matte.softStart} hard=${matte.hardKey.toFixed(1)}`);
  }

  const bounds = detectSheetGridBoundaries(
    image.data,
    image.width,
    image.height,
    cols,
    rows,
    { searchRadiusRatio: 0.14, rowSearchRadiusRatio: 0.16 },
  );
  const cells = sliceSheetByComponentOwnership(
    image.data,
    image.width,
    image.height,
    bounds.xBounds,
    bounds.yBounds,
    // Captions are often disconnected from the cat; keep in-cell alpha.
    // Thin top/bottom crumbs from the neighboring row are scrubbed after slice.
    { minComponentArea: 12, overflowPaddingPx: 2, preserveCellAlphaThreshold: 8 },
  );

  const frames = cells.map((cell) => {
    clearThinEdgeBleedFragments(cell.data, cell.width, cell.height, {
      maxFragmentHeight: 16,
      maxFragmentArea: 200,
      alphaThreshold: 12,
    });
    clearEdgeConnectedResidue(cell.data, cell.width, cell.height, { maxDepthPx: 4 });
    const trimmed = trimWithoutDroppingDetails(cell, 0.07);
    clearThinEdgeBleedFragments(trimmed.data, trimmed.width, trimmed.height, {
      maxFragmentHeight: 16,
      maxFragmentArea: 200,
      alphaThreshold: 12,
    });
    addLineSafeStroke(trimmed, 3);
    clearThinEdgeBleedFragments(trimmed.data, trimmed.width, trimmed.height, {
      maxFragmentHeight: 10,
      maxFragmentArea: 120,
      alphaThreshold: 12,
    });
    return trimmed;
  });

  await copyFile(path, join(outputDir, `_raw-${basename(path)}`));
  await writeFile(join(outputDir, '_processed-sheet.png'), Buffer.from(encodePng(image)));
  for (let i = 0; i < frames.length; i++) {
    await writeFile(
      join(outputDir, `sticker-${String(i + 1).padStart(2, '0')}.png`),
      Buffer.from(encodePng(frames[i]!)),
    );
  }
  await makeContactSheet(frames, join(outputDir, '_contact-dark.png'), { r: 32, g: 34, b: 36 }, cols, rows);
  await makeContactSheet(frames, join(outputDir, '_contact-light.png'), { r: 238, g: 238, b: 238 }, cols, rows);

  console.log(`  x=${bounds.xBounds.join(',')} y=${bounds.yBounds.join(',')}`);
  console.log(`  alpha=${JSON.stringify(alphaStats(image))}`);
  return frames;
}

async function main(): Promise<void> {
  const { sheets, out, cols, rows, bg } = parseArgs(process.argv.slice(2));
  await mkdir(join(out, 'stickers'), { recursive: true });
  const first = await processSheet(sheets[0], join(out, 'sheet-1'), cols, rows, bg);
  const second = await processSheet(sheets[1], join(out, 'sheet-2'), cols, rows, bg);
  const all = [...first, ...second];
  for (let i = 0; i < all.length; i++) {
    const png = Buffer.from(encodePng(all[i]!));
    await writeFile(
      join(out, 'stickers', `sticker-${String(i + 1).padStart(2, '0')}.png`),
      png,
    );
  }

  const lineDir = join(out, 'line-stickers');
  await mkdir(lineDir, { recursive: true });
  const zip = new JSZip();
  for (let i = 0; i < all.length; i++) {
    const fitted = await makeLineSticker(all[i]!);
    const name = `sticker-${String(i + 1).padStart(2, '0')}.png`;
    await writeFile(join(lineDir, name), fitted);
    zip.file(name, fitted);
  }
  await writeFile(join(out, 'LINE_Stickers_40_GreenKey_V2.zip'), await zip.generateAsync({ type: 'nodebuffer' }));

  await makeContactSheet(all.slice(0, 20), join(out, 'preview-sheet-1-dark.png'), { r: 32, g: 34, b: 36 }, cols, rows);
  await makeContactSheet(all.slice(20), join(out, 'preview-sheet-2-dark.png'), { r: 32, g: 34, b: 36 }, cols, rows);
  await makeContactSheet(all.slice(0, 20), join(out, 'preview-sheet-1-light.png'), { r: 238, g: 238, b: 238 }, cols, rows);
  await makeContactSheet(all.slice(20), join(out, 'preview-sheet-2-light.png'), { r: 238, g: 238, b: 238 }, cols, rows);
  console.log(`Wrote ${all.length} transparent stickers to ${out}`);
}

await main();
