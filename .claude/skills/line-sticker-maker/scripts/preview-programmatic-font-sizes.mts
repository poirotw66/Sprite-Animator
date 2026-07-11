/**
 * Export one sticker cell with multiple programmatic fontSizePercent values.
 *
 *   npx tsx preview-programmatic-font-sizes.mts <sheet-dir> <sticker#> [cols] [rows] \
 *     --phrase "補眠中" --sizes 10,11,12,13,14,15,16,18
 *
 * Output: <sheet-dir>/sticker-NN-fontSize-XXpct.png
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

import {
  mergeProgrammaticTextTuning,
  type ProgrammaticTextOverlayTuning,
} from '../../../../utils/lineStickerTextOverlayTypes.ts';
import { buildEqualGridBounds } from '../../../../utils/gridSheetTemplate.ts';
import { trimFrameToContent } from '../../../../utils/sheetComponentSlicer.ts';
import { overlayPhraseOnRgbaFrame } from './programmaticTextOverlay.mts';
import { decodeImage, encodePng, sliceSheet } from './nodeImage.mts';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token?.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      }
    } else if (token) {
      positionals.push(token);
    }
  }
  args._positionals = positionals.join('\0');
  return args;
}

const args = parseArgs(process.argv.slice(2));
const positionals = (args._positionals ?? '').split('\0').filter(Boolean);
const sheetDir = resolve(positionals[0] ?? '');
const stickerNum = Number(positionals[1] ?? 0);
const cols = Number(positionals[2] ?? 4);
const rows = Number(positionals[3] ?? 5);
const phrase = args.phrase ?? '';
const sizesRaw = args.sizes ?? '10,11,12,13,14,15,16,18';

if (!sheetDir || !stickerNum || !phrase.trim()) {
  console.error(
    'Usage: preview-programmatic-font-sizes.mts <sheet-dir> <sticker#> [cols] [rows] --phrase "text" [--sizes 10,11,14]'
  );
  process.exit(1);
}

const cellIndex = stickerNum - 1;
if (cellIndex < 0 || cellIndex >= cols * rows) {
  throw new Error(`sticker# ${stickerNum} out of range for ${cols}×${rows}`);
}

const sizes = sizesRaw
  .split(/[,;]/)
  .map((s) => Number.parseFloat(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

const processedPath = resolve(sheetDir, '_processed-sheet.png');
if (!existsSync(processedPath)) {
  throw new Error(`Missing ${processedPath}`);
}

async function loadBaseTuning(): Promise<ProgrammaticTextOverlayTuning> {
  const configPath = resolve(sheetDir, '..', 'job.config.json');
  if (!existsSync(configPath)) {
    return mergeProgrammaticTextTuning();
  }
  const config = JSON.parse(await readFile(configPath, 'utf8')) as {
    programmaticTextTuning?: Partial<ProgrammaticTextOverlayTuning>;
  };
  return mergeProgrammaticTextTuning(config.programmaticTextTuning);
}

const image = decodeImage(new Uint8Array(await readFile(processedPath)));
const useGuided = existsSync(resolve(sheetDir, '_grid-template-guided.png'));
const templateBounds = buildEqualGridBounds(image.width, cols, rows);
const frames = sliceSheet(image, cols, rows, {
  sliceMode: useGuided ? 'template' : 'divider',
  guidedContentCrop: useGuided,
  templateBounds: useGuided ? templateBounds : undefined,
});
const baseFrame = frames[cellIndex];
if (!baseFrame) {
  throw new Error(`Missing cell ${stickerNum}`);
}

const baseTuning = await loadBaseTuning();
const outDir = resolve(sheetDir, `_font-size-preview-sticker-${String(stickerNum).padStart(2, '0')}`);
await mkdir(outDir, { recursive: true });

const pad = String(stickerNum).padStart(2, '0');

for (const fontSizePercent of sizes) {
  const tuning = mergeProgrammaticTextTuning({
    ...baseTuning,
    fontSizePercent,
    fontSizeMode: 'fixed',
  });
  let frame = overlayPhraseOnRgbaFrame(baseFrame, phrase, {
    frameIndex: cellIndex,
    tuning,
  });
  frame = trimFrameToContent(frame);

  const label = `${fontSizePercent}`.replace('.', '_');
  const outName = `sticker-${pad}-fontSize-${label}pct.png`;
  const outPath = resolve(outDir, outName);
  await writeFile(outPath, encodePng(frame));

  const canvas = createCanvas(frame.width, frame.height);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(frame.width, frame.height);
    imgData.data.set(frame.data);
    ctx.putImageData(imgData, 0, 0);
    const badge = `${fontSizePercent}%`;
    ctx.font = 'bold 14px sans-serif';
    const metrics = ctx.measureText(badge);
    const padX = 6;
    const padY = 4;
    const boxW = metrics.width + padX * 2;
    const boxH = 18;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(4, 4, boxW, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(badge, 4 + padX, 4 + 14);
    const labeled = decodeImage(encodePng({
      data: new Uint8ClampedArray(ctx.getImageData(0, 0, frame.width, frame.height).data),
      width: frame.width,
      height: frame.height,
    }));
    await writeFile(
      resolve(outDir, `sticker-${pad}-fontSize-${label}pct-labeled.png`),
      encodePng(labeled)
    );
  }

  console.log(`  ✓ ${outName} (${frame.width}×${frame.height})`);
}

console.log(`\nWrote ${sizes.length} previews → ${outDir}`);
