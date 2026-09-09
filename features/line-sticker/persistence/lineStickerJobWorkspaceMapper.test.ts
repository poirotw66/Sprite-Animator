import { describe, expect, it } from 'vitest';
import {
  createLineStickerRunState,
  lineStickerRunActions,
  lineStickerRunReducer,
  sanitizeLineStickerRunStateForResume,
} from '../domain';
import { InMemoryLineStickerJobRepository } from './lineStickerJobRepository';
import {
  dataUrlToStoredBytes,
  hasPersistableWorkspaceArtifacts,
  loadLineStickerWorkspaceSnapshot,
  saveLineStickerWorkspaceSnapshot,
  storedBytesToDataUrl,
} from './lineStickerJobWorkspaceMapper';
import { createLineStickerJobImageState } from '../domain/lineStickerJobImageState';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('lineStickerJobWorkspaceMapper', () => {
  it('round-trips data URLs through binary asset storage', () => {
    const stored = dataUrlToStoredBytes(TINY_PNG);
    expect(stored.mimeType).toBe('image/png');
    expect(storedBytesToDataUrl(stored.mimeType, stored.bytes)).toBe(TINY_PNG);
  });

  it('persists and restores set-mode sheet images without credential fields', async () => {
    const repository = new InMemoryLineStickerJobRepository();
    const run = lineStickerRunReducer(
      createLineStickerRunState({ sheetIds: ['sheet-0', 'sheet-1', 'sheet-2'] }),
      lineStickerRunActions.start(3),
    );
    const ready = lineStickerRunReducer(
      run,
      lineStickerRunActions.sheetStageChanged(3, 'sheet-0', 'generating'),
    );
    const completed = lineStickerRunReducer(
      ready,
      lineStickerRunActions.sheetStageChanged(3, 'sheet-0', 'ready'),
    );

    await saveLineStickerWorkspaceSnapshot({
      repository,
      jobId: 'job-restore',
      createdAt: '2026-09-09T00:00:00.000Z',
      run: completed,
      artifacts: {
        mode: 'set',
        sourceImage: TINY_PNG,
        setPhrasesList: Array.from({ length: 48 }, (_, index) => `p${index}`),
        actionDescsList: Array.from({ length: 48 }, () => ''),
        sheetImages: [TINY_PNG, null, null],
        processedSheetImages: [TINY_PNG, null, null],
        sheetFrames: [[TINY_PNG], [], []],
      },
    });

    const loaded = await loadLineStickerWorkspaceSnapshot({
      repository,
      jobId: 'job-restore',
    });
    expect(loaded).not.toBeNull();
    if (!loaded) throw new Error('Expected restored workspace.');
    expect(loaded.artifacts.sourceImage).toBe(TINY_PNG);
    expect(loaded.artifacts.sheetImages[0]).toBe(TINY_PNG);
    expect(loaded.artifacts.processedSheetImages[0]).toBe(TINY_PNG);
    expect(loaded.artifacts.sheetFrames[0]).toEqual([TINY_PNG]);
    expect(loaded.artifacts.setPhrasesList.slice(0, 3)).toEqual(['p0', 'p1', 'p2']);
    expect(loaded.artifacts.jobImageState?.[0]).toMatchObject({
      generated: TINY_PNG,
      processed: TINY_PNG,
      frames: [TINY_PNG],
    });
    expect(loaded.snapshot.run.runId).toBe(3);
    expect(loaded.snapshot.run.sheets['sheet-0'].stage).toBe('ready');
    expect(loaded.wasInterrupted).toBe(false);
    expect(JSON.stringify(loaded.snapshot)).not.toMatch(/apiKey|hfToken|authorization/i);
  });

  it('flags interrupted runs that were mid-generation when saved', async () => {
    const repository = new InMemoryLineStickerJobRepository();
    const started = lineStickerRunReducer(
      createLineStickerRunState({ sheetIds: ['sheet-0', 'sheet-1', 'sheet-2'] }),
      lineStickerRunActions.start(9),
    );
    const generating = lineStickerRunReducer(
      started,
      lineStickerRunActions.sheetStageChanged(9, 'sheet-1', 'generating'),
    );
    // Bypass sanitize on save by writing through repository after constructing snapshot manually.
    const snapshot = await saveLineStickerWorkspaceSnapshot({
      repository,
      jobId: 'job-interrupted',
      createdAt: '2026-09-09T00:00:00.000Z',
      run: generating,
      artifacts: {
        mode: 'set',
        sourceImage: TINY_PNG,
        setPhrasesList: [],
        actionDescsList: [],
        sheetImages: [null, null, null],
        processedSheetImages: [null, null, null],
        sheetFrames: [[], [], []],
      },
    });
    // save sanitizes before persist — re-save an active run directly for the load flag test.
    await repository.save({
      ...snapshot,
      run: generating,
    });

    const loaded = await loadLineStickerWorkspaceSnapshot({
      repository,
      jobId: 'job-interrupted',
    });
    expect(loaded?.wasInterrupted).toBe(true);
    expect(loaded?.snapshot.run.sheets['sheet-1'].stage).toBe('cancelled');
  });

  it('sanitizes in-flight stages before resume', () => {
    const active = lineStickerRunReducer(
      createLineStickerRunState({ sheetIds: ['sheet-0'] }),
      lineStickerRunActions.start(1),
    );
    const generating = lineStickerRunReducer(
      active,
      lineStickerRunActions.sheetStageChanged(1, 'sheet-0', 'generating'),
    );
    expect(sanitizeLineStickerRunStateForResume(generating)).toMatchObject({
      runId: 1,
      stage: 'cancelled',
      sheets: { 'sheet-0': { stage: 'cancelled' } },
    });
  });

  it('detects empty drafts as non-persistable', () => {
    expect(hasPersistableWorkspaceArtifacts({
      mode: 'set',
      sourceImage: null,
      setPhrasesList: ['', ''],
      actionDescsList: [],
      sheetImages: [null, null, null],
      processedSheetImages: [null, null, null],
      sheetFrames: [[], [], []],
    })).toBe(false);
  });

  it('persists preferred jobImageState over flat image arrays', async () => {
    const repository = new InMemoryLineStickerJobRepository();
    const jobImageState = createLineStickerJobImageState();
    jobImageState[1] = {
      generated: TINY_PNG,
      processed: TINY_PNG,
      frames: [TINY_PNG, TINY_PNG],
    };
    const run = createLineStickerRunState({ sheetIds: ['sheet-0', 'sheet-1', 'sheet-2'] });

    await saveLineStickerWorkspaceSnapshot({
      repository,
      jobId: 'job-image-sot',
      createdAt: '2026-09-09T00:00:00.000Z',
      run,
      artifacts: {
        mode: 'set',
        sourceImage: null,
        setPhrasesList: [],
        actionDescsList: [],
        jobImageState,
        // Flat arrays intentionally diverge; SoT wins.
        sheetImages: [TINY_PNG, null, null],
        processedSheetImages: [null, null, null],
        sheetFrames: [[], [], []],
      },
    });

    const loaded = await loadLineStickerWorkspaceSnapshot({
      repository,
      jobId: 'job-image-sot',
    });
    expect(loaded?.artifacts.sheetImages).toEqual([null, TINY_PNG, null]);
    expect(loaded?.artifacts.processedSheetImages).toEqual([null, TINY_PNG, null]);
    expect(loaded?.artifacts.sheetFrames[1]).toEqual([TINY_PNG, TINY_PNG]);
    expect(hasPersistableWorkspaceArtifacts({
      mode: 'set',
      sourceImage: null,
      setPhrasesList: [],
      actionDescsList: [],
      jobImageState,
      sheetImages: [null, null, null],
      processedSheetImages: [null, null, null],
      sheetFrames: [[], [], []],
    })).toBe(true);
  });
});
