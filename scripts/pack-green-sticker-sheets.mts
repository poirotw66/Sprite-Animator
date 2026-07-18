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
import { clearEdgeConnectedResidue } from '../utils/frameEdgeCleanup.ts';
import { addExteriorWhiteStroke } from '../utils/paperBackgroundMatte.ts';
import { featherAlphaEdge } from '../utils/alphaEdgeFeather.ts';

const COLS = 4;
const ROWS = 5;

function parseArgs(argv: string[]): { sheets: [string, string]; out: string } {
  const sheets: string[] = [];
  let out = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) out = resolve(argv[++i]!);
    else if (!argv[i]!.startsWith('--')) sheets.push(resolve(argv[i]!));
  }
  if (sheets.length !== 2 || !out) {
    throw new Error('Usage: npx tsx scripts/pack-green-sticker-sheets.mts <sheet1.png> <sheet2.png> --out <folder>');
  }
  return { sheets: [sheets[0]!, sheets[1]!], out };
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
      left: (i % COLS) * cellWidth + Math.floor((cellWidth - (meta.width ?? 0)) / 2),
      top: Math.floor(i / COLS) * cellHeight + Math.floor((cellHeight - (meta.height ?? 0)) / 2),
    });
  }
  await sharp({
    create: {
      width: COLS * cellWidth,
      height: ROWS * cellHeight,
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

async function processSheet(path: string, outputDir: string): Promise<RgbaImage[]> {
  await mkdir(outputDir, { recursive: true });
  const rawBytes = new Uint8Array(await readFile(path));
  const image = decodeImage(rawBytes);

  const matte = applySoftGreenMatte(image);
  const bounds = detectSheetGridBoundaries(
    image.data,
    image.width,
    image.height,
    COLS,
    ROWS,
    { searchRadiusRatio: 0.14, rowSearchRadiusRatio: 0.16 },
  );
  const cells = sliceSheetByComponentOwnership(
    image.data,
    image.width,
    image.height,
    bounds.xBounds,
    bounds.yBounds,
    // Model-drawn captions are disconnected from the cat and often contain
    // tiny strokes. Preserve all alpha inside the strict cell while ownership
    // masking still prevents large neighbouring components from bleeding in.
    { minComponentArea: 8, overflowPaddingPx: 5, preserveCellAlphaThreshold: 8 },
  );

  const frames = cells.map((cell) => {
    clearEdgeConnectedResidue(cell.data, cell.width, cell.height, { maxDepthPx: 3 });
    const trimmed = trimWithoutDroppingDetails(cell, 0.07);
    addLineSafeStroke(trimmed, 3);
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
  await makeContactSheet(frames, join(outputDir, '_contact-dark.png'), { r: 32, g: 34, b: 36 });
  await makeContactSheet(frames, join(outputDir, '_contact-light.png'), { r: 238, g: 238, b: 238 });

  console.log(`${basename(path)} ${image.width}x${image.height}`);
  console.log(`  green matte key=${matte.keyDominance.toFixed(1)} soft=${matte.softStart} hard=${matte.hardKey.toFixed(1)}`);
  console.log(`  x=${bounds.xBounds.join(',')} y=${bounds.yBounds.join(',')}`);
  console.log(`  alpha=${JSON.stringify(alphaStats(image))}`);
  return frames;
}

async function main(): Promise<void> {
  const { sheets, out } = parseArgs(process.argv.slice(2));
  await mkdir(join(out, 'stickers'), { recursive: true });
  const first = await processSheet(sheets[0], join(out, 'sheet-1'));
  const second = await processSheet(sheets[1], join(out, 'sheet-2'));
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

  await makeContactSheet(all.slice(0, 20), join(out, 'preview-sheet-1-dark.png'), { r: 32, g: 34, b: 36 });
  await makeContactSheet(all.slice(20), join(out, 'preview-sheet-2-dark.png'), { r: 32, g: 34, b: 36 });
  await makeContactSheet(all.slice(0, 20), join(out, 'preview-sheet-1-light.png'), { r: 238, g: 238, b: 238 });
  await makeContactSheet(all.slice(20), join(out, 'preview-sheet-2-light.png'), { r: 238, g: 238, b: 238 });
  console.log(`Wrote ${all.length} transparent stickers to ${out}`);
}

await main();
