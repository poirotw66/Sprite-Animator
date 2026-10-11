/** Arrange 20 reviewed transparent slices without changing their content. */
import sharp from 'sharp';
import { realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateSpriteSheet } from './validate-sprite-sheet.mts';

export async function repackSpriteSheet(inputs: Array<string | Buffer>) {
  if (inputs.length !== 20) throw new Error('Exactly 20 ordered slices are required.');
  const overlays: Array<{ input: Buffer; left: number; top: number }> = [];
  const sources = [];
  for (const [index, input] of inputs.entries()) {
    const bytes = typeof input === 'string' ? await readFile(input) : input;
    const metadata = await sharp(bytes).metadata();
    if (metadata.format !== 'png' || (metadata.pages ?? 1) !== 1 || !metadata.hasAlpha) {
      throw new Error(`Slice ${index + 1} must be a static PNG with alpha.`);
    }
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;
    let transparent = false;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * info.channels + info.channels - 1] === 0) {
          transparent = true;
          continue;
        }
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < 0 || !transparent) throw new Error(`Slice ${index + 1} is empty or fully opaque.`);
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    // Trim only fully transparent pixels. Never erase or stretch foreground.
    const fitted = await sharp(bytes)
      .extract({ left: minX, top: minY, width, height })
      .resize({ width: 680, height: 580, fit: 'inside' })
      .png().toBuffer({ resolveWithObject: true });
    overlays.push({
      input: fitted.data,
      left: (index % 4) * 740 + Math.floor((740 - fitted.info.width) / 2),
      top: Math.floor(index / 4) * 640 + Math.floor((640 - fitted.info.height) / 2),
    });
    sources.push({
      index: index + 1,
      source: typeof input === 'string' ? input : null,
      originalDimensions: { width: info.width, height: info.height },
      contentDimensions: { width, height },
      fittedDimensions: { width: fitted.info.width, height: fitted.info.height },
      upscaled: fitted.info.width > width || fitted.info.height > height,
    });
  }
  const png = await sharp({ create: {
    width: 2960, height: 3200, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  } }).composite(overlays).png().toBuffer();
  const structural = await validateSpriteSheet(png);
  if (!structural.structuralPass) throw new Error(`Repack failed: ${structural.errors.join(' ')}`);
  return { png, report: { sources, structural, visualReview: 'required', contentApproval: 'not-established-by-repacking' } };
}

async function main(): Promise<void> {
  try {
    const { values } = parseArgs({ options: { inputs: { type: 'string' }, out: { type: 'string' } } });
    if (!values.inputs || !values.out || extname(values.out).toLowerCase() !== '.png') {
      throw new Error('Usage: repack-sprite-sheet.mts --inputs <ordered-paths.json> --out <new.png>');
    }
    const listPath = resolve(values.inputs);
    const list: unknown = JSON.parse(await readFile(listPath, 'utf8'));
    if (!Array.isArray(list) || list.length !== 20 || list.some(p => typeof p !== 'string' || !p.trim())) {
      throw new Error('Input JSON must be an array of exactly 20 nonempty PNG paths.');
    }
    const paths = (list as string[]).map(p => realpathSync(resolve(dirname(listPath), p)));
    if (new Set(paths).size !== 20) throw new Error('Each input path must identify a distinct slice.');
    const { png, report } = await repackSpriteSheet(paths);
    await writeFile(resolve(values.out), png, { flag: 'wx' });
    console.log(JSON.stringify({ output: resolve(values.out), ...report }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ errors: [error instanceof Error ? error.message : String(error)] }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
