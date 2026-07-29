import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildLineUploadZipBytes } from '../../scripts/line-sticker/lineUploadPack.mts';
import { encodePng, type RgbaImage } from '../../scripts/line-sticker/nodeImage.mts';
import { validateCompletedStickerSet } from './completedStickerSet';

const dirs: string[] = [];

function rgbaFrame(width = 32, height = 32): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 4; y < height - 4; y++) {
    for (let x = 4; x < width - 4; x++) {
      const i = (y * width + x) * 4;
      data[i] = 240;
      data[i + 1] = 120;
      data[i + 2] = 40;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

function opaqueFrame(width = 32, height = 32): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 240;
    data[i + 1] = 120;
    data[i + 2] = 40;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

async function fixture(qaPass = true): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'sticker-complete-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'stickers'));
  mkdirSync(join(dir, 'sheet-1'));
  mkdirSync(join(dir, 'sheet-2'));
  const frames = Array.from({ length: 40 }, () => rgbaFrame());
  const png = encodePng(frames[0]!);
  writeFileSync(join(dir, 'sheet-1', '_processed-sheet.png'), png);
  writeFileSync(join(dir, 'sheet-2', '_processed-sheet.png'), png);
  for (let i = 1; i <= 40; i++) {
    writeFileSync(join(dir, 'stickers', `sticker-${String(i).padStart(2, '0')}.png`), png);
  }
  const { zipBytes } = await buildLineUploadZipBytes(frames);
  writeFileSync(join(dir, 'line-upload.zip'), zipBytes);
  const uploadZipSha256 = createHash('sha256').update(zipBytes).digest('hex');
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
    completionStatus: qaPass ? 'completed' : 'qa_failed',
    runId: 'test-run',
    config: { stickerCount: 40, minGridAlignmentScore: 0.8 },
    activeSheets: ['sheet-1', 'sheet-2'],
    gridScores: { 'sheet-1': 0.9, 'sheet-2': 0.9 },
    qaReport: { pass: qaPass, gridPass: true },
    uploadZipFile: 'line-upload.zip',
    uploadZipSha256,
    stickers: Array.from({ length: 40 }, (_, index) => ({
      globalIndex: index + 1,
      uploadFile: `stickers/sticker-${String(index + 1).padStart(2, '0')}.png`,
    })),
  }));
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('validateCompletedStickerSet', () => {
  it('accepts only a fully packaged, QA-passing set', async () => {
    expect(validateCompletedStickerSet(await fixture()).complete).toBe(true);
  });

  it('rejects QA failures', async () => {
    const result = validateCompletedStickerSet(await fixture(false));
    expect(result.complete).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/qa|completionStatus/i);
  });

  it('rejects a partial sticker directory', async () => {
    const dir = await fixture();
    rmSync(join(dir, 'stickers', 'sticker-02.png'));
    expect(validateCompletedStickerSet(dir).reasons.join(' ')).toContain('sticker-02.png');
  });

  it('rejects a stale or malformed ZIP', async () => {
    const dir = await fixture();
    writeFileSync(join(dir, 'line-upload.zip'), 'not-a-zip');
    expect(validateCompletedStickerSet(dir).reasons.join(' ')).toMatch(/invalid upload ZIP/i);
  });

  it('rejects a ZIP whose entry data no longer matches its CRC', async () => {
    const dir = await fixture();
    const zipPath = join(dir, 'line-upload.zip');
    const zip = Buffer.from(readFileSync(zipPath));
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const compressedSize = zip.readUInt32LE(18);
    const nameLength = zip.readUInt16LE(26);
    const extraLength = zip.readUInt16LE(28);
    const dataStart = 30 + nameLength + extraLength;
    zip[dataStart + Math.max(0, Math.floor(compressedSize / 2))] ^= 0x01;
    writeFileSync(zipPath, zip);
    const manifestPath = join(dir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      uploadZipSha256: string;
    };
    manifest.uploadZipSha256 = createHash('sha256').update(zip).digest('hex');
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(validateCompletedStickerSet(dir).reasons.join(' ')).toMatch(/invalid upload ZIP/i);
  });

  it('requires completed status and a run id', async () => {
    const dir = await fixture();
    const manifestPath = join(dir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    delete manifest.runId;
    manifest.completionStatus = 'finalizing';
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(validateCompletedStickerSet(dir).reasons.join(' ')).toMatch(/runId|completionStatus/i);
  });

  it('rejects PNGs that declare alpha but contain no transparent pixels', async () => {
    const dir = await fixture();
    writeFileSync(
      join(dir, 'stickers', 'sticker-01.png'),
      encodePng(opaqueFrame())
    );
    expect(validateCompletedStickerSet(dir).reasons.join(' ')).toMatch(/no transparent pixels/i);
  });

  it('accepts completed_with_warnings only for explicit report mode', async () => {
    const dir = await fixture(false);
    const manifestPath = join(dir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      completionStatus: string;
      config: Record<string, unknown>;
    };
    manifest.completionStatus = 'completed_with_warnings';
    manifest.config.qaMode = 'report';
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(validateCompletedStickerSet(dir).complete).toBe(true);

    manifest.config.qaMode = 'block';
    writeFileSync(manifestPath, JSON.stringify(manifest));
    expect(validateCompletedStickerSet(dir).reasons.join(' ')).toMatch(/completionStatus/i);
  });
});
