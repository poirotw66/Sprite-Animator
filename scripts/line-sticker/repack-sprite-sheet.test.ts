import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repackSpriteSheet } from '../../skills/line-sticker-sprite-sheet/scripts/repack-sprite-sheet.mts';

async function slice(index: number, options: { empty?: boolean; opaque?: boolean } = {}) {
  const width = index % 2 === 0 ? 48 : 24;
  const height = 24;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = 20 + index * 8;
      data[offset + 1] = 60;
      data[offset + 2] = 180;
      const foreground = options.opaque || (x >= 4 && x < width - 4 && y >= 4 && y < height - 4);
      data[offset + 3] = !options.empty && foreground ? 255 : 0;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

describe('reviewed slice repacking', () => {
  it('builds exact geometry with transparent borders while preserving order and proportions', async () => {
    const inputs = await Promise.all(Array.from({ length: 20 }, (_, i) => slice(i)));
    const { png, report } = await repackSpriteSheet(inputs);
    expect(report.structural.structuralPass).toBe(true);
    expect(report.structural.actualDimensions).toEqual({ width: 2960, height: 3200 });
    expect(report.structural.cells).toHaveLength(20);
    expect(report.structural.cells.every(c => c.unsafePixels === 0)).toBe(true);
    expect(report.contentApproval).toBe('not-established-by-repacking');
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    for (const [index, source] of report.sources.entries()) {
      const x = (index % 4) * 740 + 370;
      const y = Math.floor(index / 4) * 640 + 320;
      expect(data[(y * info.width + x) * 4]).toBe(20 + index * 8);
      const expectedHeight = source.fittedDimensions.width * source.contentDimensions.height / source.contentDimensions.width;
      expect(Math.abs(expectedHeight - source.fittedDimensions.height)).toBeLessThanOrEqual(1);
      expect(source.upscaled).toBe(true);
    }
  });

  it('rejects wrong counts and missing or opaque content', async () => {
    const valid = await slice(0);
    await expect(repackSpriteSheet([valid])).rejects.toThrow('Exactly 20');
    for (const invalid of [await slice(0, { empty: true }), await slice(0, { opaque: true })]) {
      await expect(repackSpriteSheet([invalid, ...Array<Buffer>(19).fill(valid)])).rejects.toThrow('empty or fully opaque');
    }
    const jpeg = await sharp(valid).jpeg().toBuffer();
    await expect(repackSpriteSheet([jpeg, ...Array<Buffer>(19).fill(valid)])).rejects.toThrow('static PNG with alpha');
  });

  // Spawns npx + sharp twice; under full-suite CI load the default 5s is tight.
  it(
    'resolves ordered paths relative to the list and refuses to overwrite existing artwork',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'sprite-repack-'));
      try {
        const names = Array.from({ length: 20 }, (_, i) => `${i + 1}.png`);
        await Promise.all(names.map(async (name, i) => writeFile(join(directory, name), await slice(i))));
        const list = join(directory, 'inputs.json');
        const output = join(directory, 'final.png');
        await writeFile(list, JSON.stringify(names));
        const entry = resolve('skills/line-sticker-sprite-sheet/scripts/repack-sprite-sheet.mts');
        const args = ['tsx', entry, '--inputs', list, '--out', output];
        const result = JSON.parse(execFileSync('npx', args, { encoding: 'utf8' }));
        expect(result.structural.structuralPass).toBe(true);
        const before = await readFile(output);
        expect(() => execFileSync('npx', args, { stdio: 'pipe' })).toThrow();
        expect(await readFile(output)).toEqual(before);
        await writeFile(list, JSON.stringify(Array<string>(20).fill(names[0]!)));
        expect(() => execFileSync('npx', args, { stdio: 'pipe' })).toThrow();
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    20_000,
  );
});
