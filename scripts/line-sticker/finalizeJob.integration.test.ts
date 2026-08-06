import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { encodePng, type RgbaImage } from './nodeImage.mts';
import { finalizeStickerJob } from './finalizeJob.mts';
import { validateCompletedStickerSet } from '../../utils/registry/completedStickerSet';

const dirs: string[] = [];

function frame(empty = false): RgbaImage {
  const width = 32;
  const height = 32;
  const data = new Uint8ClampedArray(width * height * 4);
  if (!empty) {
    for (let y = 6; y < 26; y++) {
      for (let x = 6; x < 26; x++) {
        const i = (y * width + x) * 4;
        data[i] = 220;
        data[i + 1] = 100;
        data[i + 2] = 30;
        data[i + 3] = 255;
      }
    }
  }
  return { data, width, height };
}

function makeJob(empty = false): string {
  const outDir = mkdtempSync(join(tmpdir(), 'finalize-integration-'));
  dirs.push(outDir);
  const png = encodePng(frame(empty));
  for (const sheet of ['sheet-1', 'sheet-2']) {
    const sheetDir = join(outDir, sheet);
    mkdirSync(sheetDir);
    writeFileSync(join(sheetDir, '_processed-sheet.png'), png);
    for (let i = 1; i <= 20; i++) {
      writeFileSync(join(sheetDir, `sticker-${String(i).padStart(2, '0')}.png`), png);
    }
  }
  mkdirSync(join(outDir, 'stickers'));
  writeFileSync(join(outDir, 'stickers', 'sticker-01.png'), 'old-sticker');
  writeFileSync(join(outDir, 'line-upload.zip'), 'old-zip');
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({
    completionStatus: 'completed',
    runId: 'old-run',
    config: { stickerCount: 40 },
  }));
  return outDir;
}

function stagingRuns(outDir: string): string[] {
  const staging = join(outDir, '.finalize-staging');
  return existsSync(staging) ? readdirSync(staging) : [];
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('finalizeStickerJob staging publication', () => {
  it('publishes staged stickers/ZIP and commits manifest last', async () => {
    const outDir = makeJob();
    const previousManifestPath = join(outDir, 'manifest.json');
    const previousManifest = JSON.parse(readFileSync(previousManifestPath, 'utf8')) as {
      config: Record<string, unknown>;
    };
    previousManifest.config = {
      stickerCount: 40,
      requestedChromaKeyColor: 'auto',
      resolvedChromaKeyColor: 'magenta',
      chromaKeyColor: 'magenta',
    };
    writeFileSync(previousManifestPath, JSON.stringify(previousManifest));
    const result = await finalizeStickerJob({
      outDir,
      sheetDirs: ['sheet-1', 'sheet-2'],
      config: {
        stickerCount: 40,
        lineUpload: false,
        minGridAlignmentScore: -2,
        qaMode: 'block',
        chromaKeyColor: 'auto',
        requestedChromaKeyColor: 'auto',
      },
    });
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      completionStatus: string;
      runId: string;
      uploadZipSha256: string;
      config: { requestedChromaKeyColor: string; resolvedChromaKeyColor: string };
    };
    expect(result.stickerCount).toBe(40);
    expect(manifest.completionStatus).toBe('completed');
    expect(manifest.runId).not.toBe('old-run');
    expect(manifest.config).toMatchObject({
      requestedChromaKeyColor: 'auto',
      resolvedChromaKeyColor: 'magenta',
    });
    expect(readFileSync(join(outDir, 'stickers', 'sticker-01.png')).toString()).not.toBe(
      'old-sticker'
    );
    expect(readFileSync(join(outDir, 'line-upload.zip')).toString()).not.toBe('old-zip');
    // The manifest checksum must describe the ZIP actually on disk. Finalize
    // hashes the ZIP once and must publish those same bytes; re-encoding drifts
    // via JSZip timestamps and used to fail this run intermittently.
    const publishedZipSha256 = createHash('sha256')
      .update(readFileSync(join(outDir, 'line-upload.zip')))
      .digest('hex');
    expect(manifest.uploadZipSha256).toBe(publishedZipSha256);
    expect(validateCompletedStickerSet(outDir)).toMatchObject({ complete: true, reasons: [] });
    expect(stagingRuns(outDir)).toEqual([]);
  });

  it('publishes the ZIP it checksummed even when the clock moves between builds', async () => {
    // The checksum mismatch this guards against was a 1-in-5 flake: JSZip stamps
    // every entry with `new Date()` and the ZIP DOS timestamp has 2-second
    // resolution, so a second encode of the same frames only diverges when the
    // two builds straddle a boundary. Force every `new Date()` 5s further ahead
    // so ANY re-encode diverges, making the regression deterministic.
    const RealDate = Date;
    let tick = 0;
    // Proxy rather than a subclass: the construct trap can see a zero-arg call,
    // and Date.now/parse keep forwarding to the real implementation.
    vi.stubGlobal(
      'Date',
      new Proxy(RealDate, {
        construct(target, args: unknown[]) {
          if (args.length === 0) {
            tick += 1;
            return new target(RealDate.now() + tick * 5000);
          }
          return new target(...(args as ConstructorParameters<typeof RealDate>));
        },
      })
    );

    try {
      const outDir = makeJob();
      await finalizeStickerJob({
        outDir,
        sheetDirs: ['sheet-1', 'sheet-2'],
        config: {
          stickerCount: 40,
          lineUpload: false,
          minGridAlignmentScore: -2,
          qaMode: 'block',
          resolvedChromaKeyColor: 'green',
        },
      });
      const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
        uploadZipSha256: string;
      };
      const publishedZipSha256 = createHash('sha256')
        .update(readFileSync(join(outDir, 'line-upload.zip')))
        .digest('hex');
      expect(manifest.uploadZipSha256).toBe(publishedZipSha256);
      expect(validateCompletedStickerSet(outDir)).toMatchObject({ complete: true, reasons: [] });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps previously published artifacts when blocking QA fails', async () => {
    const outDir = makeJob(true);
    await expect(
      finalizeStickerJob({
        outDir,
        sheetDirs: ['sheet-1', 'sheet-2'],
        config: {
          stickerCount: 40,
          lineUpload: false,
          minGridAlignmentScore: -2,
          qaMode: 'block',
          requestedChromaKeyColor: 'auto',
          resolvedChromaKeyColor: 'green',
        },
      })
    ).rejects.toThrow(/QA blocked packaging/i);
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      completionStatus: string;
    };
    expect(manifest.completionStatus).toBe('qa_failed');
    expect(readFileSync(join(outDir, 'stickers', 'sticker-01.png'), 'utf8')).toBe('old-sticker');
    expect(readFileSync(join(outDir, 'line-upload.zip'), 'utf8')).toBe('old-zip');
    expect(stagingRuns(outDir)).toEqual([]);
  });

  it('records grid_failed without publishing staged artifacts', async () => {
    const outDir = makeJob();
    await expect(
      finalizeStickerJob({
        outDir,
        sheetDirs: ['sheet-1', 'sheet-2'],
        config: {
          stickerCount: 40,
          lineUpload: false,
          minGridAlignmentScore: 2,
          qaMode: 'block',
          resolvedChromaKeyColor: 'green',
        },
      })
    ).rejects.toThrow(/grid/i);
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      completionStatus: string;
    };
    expect(manifest.completionStatus).toBe('grid_failed');
    expect(readFileSync(join(outDir, 'stickers', 'sticker-01.png'), 'utf8')).toBe('old-sticker');
    expect(readFileSync(join(outDir, 'line-upload.zip'), 'utf8')).toBe('old-zip');
    expect(stagingRuns(outDir)).toEqual([]);
  });

  it('stages and validates the named repository-local upload pack', async () => {
    const outDir = makeJob();
    await finalizeStickerJob({
      outDir,
      sheetDirs: ['sheet-1', 'sheet-2'],
      config: {
        stickerCount: 40,
        lineUpload: true,
        scope: 'set',
        minGridAlignmentScore: -2,
        qaMode: 'block',
        resolvedChromaKeyColor: 'green',
        upload: {
          setName: 'Staged Test Set',
          titleZh: '測試貼圖',
          descZh: '測試流程',
          titleEn: 'Staged Test Set',
          descEn: 'Finalize staging test',
          syncToUploadRoot: false,
        },
      },
    });
    expect(existsSync(join(outDir, 'Staged Test Set.zip'))).toBe(true);
    expect(existsSync(join(outDir, 'Staged Test Set.md'))).toBe(true);
    expect(existsSync(join(outDir, 'sprite_sheets', 'sprite_sheet_1_transparent.png'))).toBe(
      true
    );
    expect(validateCompletedStickerSet(outDir).complete).toBe(true);
    expect(stagingRuns(outDir)).toEqual([]);
  });

  it('records packaging_failed, preserves published artifacts, and cleans abandoned staging on retry', async () => {
    const outDir = makeJob();
    await expect(
      finalizeStickerJob({
        outDir,
        sheetDirs: ['sheet-1', 'sheet-2'],
        config: {
          stickerCount: 40,
          lineUpload: true,
          scope: 'set',
          minGridAlignmentScore: -2,
          qaMode: 'block',
          resolvedChromaKeyColor: 'green',
          upload: {
            setName: 'Broken\u0000Pack',
            titleZh: '故障注入',
            descZh: '測試',
            titleEn: 'Broken Pack',
            descEn: 'test',
            syncToUploadRoot: false,
          },
        },
      })
    ).rejects.toThrow();
    const failed = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      completionStatus: string;
      finalizeStage: string;
      finalizeError: string;
    };
    expect(failed).toMatchObject({
      completionStatus: 'packaging_failed',
      finalizeStage: 'packaging',
    });
    expect(failed.finalizeError.length).toBeGreaterThan(0);
    expect(readFileSync(join(outDir, 'stickers', 'sticker-01.png'), 'utf8')).toBe('old-sticker');
    expect(readFileSync(join(outDir, 'line-upload.zip'), 'utf8')).toBe('old-zip');
    expect(stagingRuns(outDir).length).toBe(1);

    await finalizeStickerJob({
      outDir,
      sheetDirs: ['sheet-1', 'sheet-2'],
      config: {
        stickerCount: 40,
        lineUpload: false,
        minGridAlignmentScore: -2,
        qaMode: 'block',
        resolvedChromaKeyColor: 'green',
      },
    });
    expect(stagingRuns(outDir)).toEqual([]);
  });

  it('publishes explicit external upload roots through a sibling staging directory', async () => {
    const outDir = makeJob();
    const externalRoot = mkdtempSync(join(tmpdir(), 'finalize-external-'));
    dirs.push(externalRoot);
    const target = join(externalRoot, 'input', '706', 'External Atomic Set');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'old-marker.txt'), 'old');

    await finalizeStickerJob({
      outDir,
      sheetDirs: ['sheet-1', 'sheet-2'],
      config: {
        stickerCount: 40,
        lineUpload: true,
        scope: 'set',
        minGridAlignmentScore: -2,
        qaMode: 'block',
        resolvedChromaKeyColor: 'green',
        upload: {
          root: externalRoot,
          setName: 'External Atomic Set',
          titleZh: '外部原子發布',
          descZh: '測試外部目錄',
          titleEn: 'External Atomic Set',
          descEn: 'Atomic external publishing',
          syncToUploadRoot: false,
        },
      },
    });

    expect(existsSync(join(target, 'External Atomic Set.zip'))).toBe(true);
    expect(existsSync(join(target, 'old-marker.txt'))).toBe(false);
    expect(readdirSync(join(externalRoot, 'input', '706')).some((name) => name.includes('.staging-'))).toBe(false);
  });

  it('marks report-mode QA warnings as completed_with_warnings', async () => {
    const outDir = makeJob(true);
    await finalizeStickerJob({
      outDir,
      sheetDirs: ['sheet-1', 'sheet-2'],
      config: {
        stickerCount: 40,
        lineUpload: false,
        minGridAlignmentScore: -2,
        qaMode: 'report',
        resolvedChromaKeyColor: 'green',
      },
    });
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      completionStatus: string;
    };
    expect(manifest.completionStatus).toBe('completed_with_warnings');
    expect(validateCompletedStickerSet(outDir).complete).toBe(true);
  });
});
