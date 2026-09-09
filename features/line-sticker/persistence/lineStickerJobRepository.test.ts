import { describe, expect, it } from 'vitest';
import {
  createLineStickerJob,
  createLineStickerJobSheets,
  createLineStickerRunState,
} from '../domain';
import {
  InMemoryLineStickerJobRepository,
  parseLineStickerJobSnapshot,
  type LineStickerJobSnapshot,
} from './lineStickerJobRepository';

function createSnapshot(stickerCount: 40 | 48 = 40): LineStickerJobSnapshot {
  const job = createLineStickerJob({
    id: `job-${stickerCount}`,
    mode: 'set',
    stickerCount,
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: stickerCount === 48
      ? '2026-09-08T02:00:00.000Z'
      : '2026-09-08T01:00:00.000Z',
  });
  return {
    job,
    run: createLineStickerRunState({ sheetIds: job.sheets.map((sheet) => sheet.id) }),
    savedAt: '2026-09-08T01:01:00.000Z',
  };
}

describe('LineStickerJobRepository', () => {
  it('round-trips 40/48 jobs and lists lightweight summaries', async () => {
    const repository = new InMemoryLineStickerJobRepository();
    await repository.save(createSnapshot(40));
    await repository.save(createSnapshot(48));

    expect((await repository.load('job-40'))?.job.sheets).toHaveLength(2);
    expect((await repository.load('job-48'))?.job.sheets).toHaveLength(3);
    expect((await repository.list()).map(({ id, stickerCount }) => ({ id, stickerCount }))).toEqual([
      { id: 'job-48', stickerCount: 48 },
      { id: 'job-40', stickerCount: 40 },
    ]);
  });

  it('stores binary assets outside the JSON job record', async () => {
    const repository = new InMemoryLineStickerJobRepository();
    await repository.putAsset({
      id: 'asset-1',
      mimeType: 'image/webp',
      bytes: new Uint8Array([1, 2, 3]).buffer,
      updatedAt: '2026-09-08T00:00:00.000Z',
    });

    const asset = await repository.getAsset('asset-1');
    expect(asset).not.toBeNull();
    if (!asset) throw new Error('Expected persisted asset.');
    expect(asset?.mimeType).toBe('image/webp');
    expect([...new Uint8Array(asset.bytes)]).toEqual([1, 2, 3]);
  });

  it('rejects credential-shaped fields anywhere in persisted metadata', async () => {
    const repository = new InMemoryLineStickerJobRepository();
    const snapshot = createSnapshot();
    snapshot.job.metadata = { nested: { geminiApiKey: 'must-not-persist' } };

    await expect(repository.save(snapshot)).rejects.toThrow(/Credential field/);
  });

  it('rejects snapshots whose job and run sheet identities diverge', () => {
    const snapshot = createSnapshot(40);
    delete snapshot.run.sheets['sheet-1'];
    expect(() => parseLineStickerJobSnapshot(snapshot)).toThrow(/run state/);
  });

  it('migrates the previous three-sheet schema to the 48-sticker layout', () => {
    const current = createSnapshot(48);
    const legacy = {
      ...current,
      job: {
        ...current.job,
        schemaVersion: 1,
        stickerCount: undefined,
        sheets: createLineStickerJobSheets(48).map(({ cols: _cols, rows: _rows, expectedFrames: _frames, ...sheet }) => sheet),
      },
    };

    const migrated = parseLineStickerJobSnapshot(legacy);
    expect(migrated.job).toMatchObject({ schemaVersion: 2, stickerCount: 48 });
    expect(migrated.job.sheets.map(({ cols, rows, expectedFrames }) => ({ cols, rows, expectedFrames }))).toEqual([
      { cols: 4, rows: 4, expectedFrames: 16 },
      { cols: 4, rows: 4, expectedFrames: 16 },
      { cols: 4, rows: 4, expectedFrames: 16 },
    ]);
  });
});
