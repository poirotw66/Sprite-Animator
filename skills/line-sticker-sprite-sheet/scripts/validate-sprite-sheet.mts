/** Inspect the sprite-sheet contract without changing image pixels. */
import sharp from 'sharp';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export async function validateSpriteSheet(input: string | Buffer, workingMargin = 30) {
  if (!Number.isInteger(workingMargin) || workingMargin < 20 || workingMargin > 30) {
    throw new Error('Working margin must be an integer between 20 and 30 pixels.');
  }
  const metadata = await sharp(input).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const errors: string[] = [];
  if (metadata.format !== 'png') errors.push('The original file must be PNG.');
  if ((metadata.pages ?? 1) > 1) errors.push('The sheet must be a single static image.');
  if (width === 0 || height === 0) errors.push('Image dimensions are unavailable.');
  if (width * 40 !== height * 37) errors.push('The sheet aspect ratio must be exactly 37:40.');
  const equalCells = width > 0 && height > 0 && width % 4 === 0 && height % 5 === 0;
  if (!equalCells) errors.push('Dimensions must divide into 4 columns and 5 rows of equal pixel cells.');
  if (!metadata.hasAlpha) errors.push('The PNG has no alpha transparency data.');

  const cellWidth = equalCells ? width / 4 : null;
  const cellHeight = equalCells ? height / 5 : null;
  const marginX = Math.ceil(workingMargin * width / 2960);
  const marginY = Math.ceil(workingMargin * height / 3200);
  const cells: Array<{
    row: number;
    column: number;
    foregroundPixels: number;
    unsafePixels: number;
  }> = [];
  let transparentPixels: number | null = null;

  if (metadata.hasAlpha) {
    const { data, info } = await sharp(input).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
    if (info.width !== width || info.height !== height || info.channels !== 1) {
      throw new Error('Decoded alpha dimensions do not match the image metadata.');
    }
    transparentPixels = 0;
    for (const alpha of data) {
      if (alpha === 0) transparentPixels++;
    }
    if (transparentPixels === 0) errors.push('The alpha data is fully opaque; the background is not transparent.');
    if (transparentPixels === width * height) errors.push('The entire image is transparent; all stickers are missing.');

    if (cellWidth !== null && cellHeight !== null) {
      for (let row = 0; row < 5; row++) {
        for (let column = 0; column < 4; column++) {
          let foregroundPixels = 0;
          let unsafePixels = 0;
          for (let y = 0; y < cellHeight; y++) {
            const offset = (row * cellHeight + y) * width + column * cellWidth;
            for (let x = 0; x < cellWidth; x++) {
              if (data[offset + x] === 0) continue;
              foregroundPixels++;
              if (x < marginX || x >= cellWidth - marginX || y < marginY || y >= cellHeight - marginY) {
                unsafePixels++;
              }
            }
          }
          cells.push({ row: row + 1, column: column + 1, foregroundPixels, unsafePixels });
          if (foregroundPixels === 0) errors.push(`Cell ${row + 1},${column + 1} is empty.`);
          if (unsafePixels > 0) errors.push(`Cell ${row + 1},${column + 1} has ${unsafePixels} nontransparent pixels in its safety border.`);
        }
      }
    }
  }

  return {
    structuralPass: errors.length === 0,
    visualReview: 'required',
    format: metadata.format ?? null,
    actualDimensions: { width, height },
    recommendedDimensions: { width: 2960, height: 3200 },
    recommendedResolutionMet: width === 2960 && height === 3200,
    grid: { columns: 4, rows: 5, cellWidth, cellHeight },
    safetyMargin: { workingPixels: workingMargin, actualX: marginX, actualY: marginY },
    hasAlpha: metadata.hasAlpha ?? false,
    transparentPixels,
    cells,
    errors,
  };
}

async function main(): Promise<void> {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { margin: { type: 'string', default: '30' } },
    });
    if (positionals.length !== 1) {
      throw new Error('Usage: validate-sprite-sheet.mts <sheet.png> [--margin 20..30]');
    }
    const report = await validateSpriteSheet(resolve(positionals[0]), Number(values.margin));
    console.log(JSON.stringify(report, null, 2));
    if (!report.structuralPass) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ structuralPass: false, errors: [error instanceof Error ? error.message : String(error)] }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
