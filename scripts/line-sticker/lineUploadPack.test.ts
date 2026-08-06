import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { RgbaImage } from './nodeImage.mts';
import {
  buildLineUploadZipBytes,
  pickRandomShopStickerIndices,
  resolveShopStickerIndices,
  writeLineUploadPackBytes,
} from './lineUploadPack.mts';

describe('pickRandomShopStickerIndices', () => {
  it('returns the only sticker when count is 1', () => {
    expect(pickRandomShopStickerIndices(1)).toEqual({ mainIndex: 0, tabIndex: 0 });
  });

  it('picks two distinct indices for a 40-sticker set', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const { mainIndex, tabIndex } = pickRandomShopStickerIndices(40);
      expect(mainIndex).toBeGreaterThanOrEqual(0);
      expect(mainIndex).toBeLessThan(40);
      expect(tabIndex).toBeGreaterThanOrEqual(0);
      expect(tabIndex).toBeLessThan(40);
      expect(mainIndex).not.toBe(tabIndex);
    }
  });

  it('uses injected rng for deterministic picks', () => {
    const values = [0, 0, 0.5];
    const rng = () => values.shift() ?? 0;
    expect(pickRandomShopStickerIndices(40, rng)).toEqual({ mainIndex: 0, tabIndex: 20 });
  });
});

describe('resolveShopStickerIndices', () => {
  it('randomizes when indices are omitted', () => {
    const { mainIndex, tabIndex } = resolveShopStickerIndices(40, {});
    expect(mainIndex).not.toBe(tabIndex);
  });

  it('honors explicit 0-based overrides', () => {
    expect(
      resolveShopStickerIndices(40, { mainStickerIndex: 4, tabStickerIndex: 9 })
    ).toEqual({ mainIndex: 4, tabIndex: 9 });
  });
});

describe('writeLineUploadPackBytes', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function frames(count: number): RgbaImage[] {
    return Array.from({ length: count }, () => {
      const width = 16;
      const height = 16;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 200;
        data[i + 1] = 90;
        data[i + 2] = 40;
        data[i + 3] = 255;
      }
      return { data, width, height };
    });
  }

  it('writes the exact ZIP bytes it was given', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'upload-pack-bytes-'));
    dirs.push(outDir);
    const { pack, zipBytes } = await buildLineUploadZipBytes(frames(8), { stickerCount: 8 });

    await writeLineUploadPackBytes(outDir, pack, zipBytes);

    // Byte equality, not "a valid ZIP": a caller that checksums zipBytes must
    // find those same bytes on disk. Re-encoding would drift via JSZip's
    // per-entry `new Date()` and the 2-second DOS timestamp resolution.
    const onDisk = new Uint8Array(readFileSync(join(outDir, 'line-upload.zip')));
    expect(Array.from(onDisk)).toEqual(Array.from(zipBytes));
  });
});
