import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSpriteSheet } from '../../skills/line-sticker-sprite-sheet/scripts/validate-sprite-sheet.mts';

/** Small, exact-ratio fixtures keep these tests offline and inexpensive. */
async function fixture(options: {
  width?: number;
  height?: number;
  channels?: 3 | 4;
  opaque?: boolean;
  empty?: boolean;
  missingCell?: boolean;
  unsafePixel?: boolean;
  minimumMarginOnly?: boolean;
  jpeg?: boolean;
} = {}): Promise<Buffer> {
  const width = options.width ?? 296;
  const height = options.height ?? 320;
  const channels = options.channels ?? 4;
  const data = Buffer.alloc(width * height * channels, options.opaque ? 255 : 0);
  function pixel(x: number, y: number, alpha = 255): void {
    const offset = (y * width + x) * channels;
    data[offset] = 240;
    data[offset + 1] = 180;
    data[offset + 2] = 100;
    if (channels === 4) data[offset + 3] = alpha;
  }
  if (!options.empty) {
    const cellWidth = Math.floor(width / 4);
    const cellHeight = Math.floor(height / 5);
    for (let row = 0; row < 5; row++) {
      for (let column = 0; column < 4; column++) {
        if (options.missingCell && row === 4 && column === 3) continue;
        for (let y = 10; y < 20; y++) {
          for (let x = 10; x < 20; x++) pixel(column * cellWidth + x, row * cellHeight + y);
        }
      }
    }
  }
  // Even a faint antialiased fragment must stay clear of the safety border.
  if (options.unsafePixel) pixel(73, 15, 1);
  if (options.minimumMarginOnly) pixel(2, 15);
  const image = sharp(data, { raw: { width, height, channels } });
  return options.jpeg ? image.jpeg().toBuffer() : image.png().toBuffer();
}

describe('transparent 4 by 5 sprite sheet inspection', () => {
  it('accepts a clean alpha sheet and reports measured size rather than the requested size', async () => {
    const result = await validateSpriteSheet(await fixture());
    expect(result.structuralPass).toBe(true);
    expect(result.actualDimensions).toEqual({ width: 296, height: 320 });
    expect(result.recommendedResolutionMet).toBe(false);
    expect(result.grid.cellWidth).toBe(74);
    expect(result.grid.cellHeight).toBe(64);
    expect(result.cells).toHaveLength(20);
    expect(result.safetyMargin.actualX).toBe(3);
    expect(result.visualReview).toBe('required');
  });

  it.each([
    ['opaque RGB PNG', { channels: 3 as const, opaque: true }],
    ['opaque RGBA PNG', { opaque: true }],
    ['blank alpha PNG', { empty: true }],
    ['missing final cell', { missingCell: true }],
    ['foreground touching an adjacent cell', { unsafePixel: true }],
    ['wrong ratio', { width: 300 }],
    ['ratio correct but indivisible cells', { width: 37, height: 40 }],
    ['JPEG data', { jpeg: true }],
  ])('rejects %s', async (_label, options) => {
    const result = await validateSpriteSheet(await fixture(options));
    expect(result.structuralPass).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('distinguishes the allowed 20 px minimum from the recommended 30 px margin', async () => {
    const image = await fixture({ minimumMarginOnly: true });
    expect((await validateSpriteSheet(image)).structuralPass).toBe(false);
    expect((await validateSpriteSheet(image, 20)).structuralPass).toBe(true);
  });

  it('rejects margins outside the contract and unreadable input', async () => {
    await expect(validateSpriteSheet(await fixture(), 0)).rejects.toThrow('Working margin');
    await expect(validateSpriteSheet(await fixture(), 20.5)).rejects.toThrow('Working margin');
    await expect(validateSpriteSheet(Buffer.from('not an image'))).rejects.toThrow();
  });

  it('prints a report when the installed CLI path is a symbolic link', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sprite-cli-'));
    try {
      const image = join(directory, 'fixture.png');
      const entry = join(directory, 'inspect.mts');
      await writeFile(image, await fixture());
      await symlink(resolve('skills/line-sticker-sprite-sheet/scripts/validate-sprite-sheet.mts'), entry);
      const output = execFileSync('npx', ['tsx', entry, image], { encoding: 'utf8' });
      expect(JSON.parse(output).structuralPass).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
