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
    expect(loaded.snapshot.run.runId).toBe(3);
    expect(loaded.snapshot.run.sheets['sheet-0'].stage).toBe('ready');
    expect(JSON.stringify(loaded.snapshot)).not.toMatch(/apiKey|hfToken|authorization/i);
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
});
