import { describe, expect, it } from 'vitest';
import {
  createLineStickerJob,
  createDefaultLineStickerJobSheets,
  createLineStickerJobSheets,
} from './lineStickerJob';
import {
  createLineStickerRunState,
  getFailedSheetIds,
  hasRunError,
  isRunActive,
  isSheetActive,
  lineStickerRunActions,
  lineStickerRunReducer,
} from './lineStickerRunState';

const reduce = (...actions: Parameters<typeof lineStickerRunReducer>[1][]) =>
  actions.reduce(lineStickerRunReducer, createLineStickerRunState({ sheetIds: ['sheet-0', 'sheet-1', 'sheet-2'] }));
const RUN_ID = 1;

describe('lineStickerRunReducer', () => {
  it('accepts the legal generation to ready transition and records one attempt', () => {
    const state = reduce(
      lineStickerRunActions.start(RUN_ID),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-0', 'queued'),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-0', 'generating', { progress: 15 }),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-0', 'processing', { progress: 50 }),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-0', 'slicing', { progress: 90 }),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-0', 'ready'),
    );
    expect(state.sheets['sheet-0']).toMatchObject({ stage: 'ready', progress: 100, attempts: 1, error: null });
  });

  it('ignores illegal transitions instead of forming an invalid busy state', () => {
    const initial = createLineStickerRunState({ sheetIds: ['sheet-0'] });
    const started = lineStickerRunReducer(initial, lineStickerRunActions.start(RUN_ID));
    const state = lineStickerRunReducer(started, lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-0', 'slicing'));
    expect(state).toBe(started);
    expect(isRunActive(state)).toBe(true);
  });

  it('updates exactly one of the current three sheets', () => {
    const state = reduce(
      lineStickerRunActions.start(RUN_ID),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-1', 'queued'),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-1', 'generating'),
    );
    expect(state.sheets['sheet-1'].stage).toBe('generating');
    expect(state.sheets['sheet-0'].stage).toBe('idle');
    expect(state.sheets['sheet-2'].stage).toBe('idle');
    expect(isSheetActive(state, 'sheet-1')).toBe(true);
  });

  it('keeps completed sheets when a retry run starts and owns the global message', () => {
    const completed = reduce(
      lineStickerRunActions.start(RUN_ID),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-0', 'generating'),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-0', 'ready'),
      lineStickerRunActions.finish(RUN_ID),
    );
    const retried = lineStickerRunReducer(completed, lineStickerRunActions.start(2));
    const withMessage = lineStickerRunReducer(
      retried,
      lineStickerRunActions.messageChanged(2, 'Retrying sheet 2'),
    );
    expect(withMessage).toMatchObject({ stage: 'validating', message: 'Retrying sheet 2' });
    expect(withMessage.sheets['sheet-0'].stage).toBe('ready');
  });

  it('tracks a sheet error, supports retry, and exposes failed sheets', () => {
    const failure = { code: 'generation_failed', message: 'provider failed' };
    const state = reduce(
      lineStickerRunActions.start(RUN_ID),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-2', 'queued'),
      lineStickerRunActions.sheetError(RUN_ID, 'sheet-2', failure),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-2', 'queued'),
    );
    expect(state.sheets['sheet-2']).toMatchObject({ stage: 'queued', error: null });
    expect(getFailedSheetIds(state)).toEqual([]);
  });

  it('cancels only active sheets and reset removes all terminal/error state', () => {
    const failure = { code: 'bad_input', message: 'bad input' };
    const state = reduce(
      lineStickerRunActions.start(RUN_ID),
      lineStickerRunActions.sheetStageChanged(RUN_ID, 'sheet-0', 'queued'),
      lineStickerRunActions.sheetError(RUN_ID, 'sheet-1', failure),
      lineStickerRunActions.cancel(RUN_ID),
    );
    expect(state.stage).toBe('cancelled');
    expect(state.sheets['sheet-0'].stage).toBe('cancelled');
    expect(state.sheets['sheet-1'].stage).toBe('failed');
    expect(hasRunError(state)).toBe(true);
    const reset = lineStickerRunReducer(state, lineStickerRunActions.reset());
    expect(reset).toMatchObject({ runId: RUN_ID, stage: 'idle', error: null });
    expect(Object.values(reset.sheets).every((sheet) => sheet.stage === 'idle' && sheet.error === null)).toBe(true);
  });

  it('rejects late actions from a superseded run', () => {
    const first = reduce(
      lineStickerRunActions.start(1),
      lineStickerRunActions.sheetStageChanged(1, 'sheet-0', 'generating'),
    );
    const second = lineStickerRunReducer(first, lineStickerRunActions.start(2));
    const staleCompletion = lineStickerRunReducer(
      second,
      lineStickerRunActions.sheetStageChanged(1, 'sheet-0', 'ready'),
    );
    const staleFailure = lineStickerRunReducer(
      staleCompletion,
      lineStickerRunActions.error(1, { code: 'late', message: 'old request failed' }),
    );

    expect(staleCompletion).toBe(second);
    expect(staleFailure).toBe(second);
    expect(second).toMatchObject({ runId: 2, stage: 'validating', error: null });
  });
});

describe('LineStickerJob', () => {
  it('is JSON-serializable and defaults to the browser three-sheet layout', () => {
    const job = createLineStickerJob({
      id: 'job-1', mode: 'set', createdAt: '2026-09-08T00:00:00.000Z',
      metadata: { preset: 'daily', retries: 0, approved: false },
    });
    expect(job.sheets).toEqual(createDefaultLineStickerJobSheets());
    expect(JSON.parse(JSON.stringify(job))).toEqual(job);
  });

  it('creates the CLI-compatible 40-sticker layout from the same schema', () => {
    const job = createLineStickerJob({
      id: 'job-40', mode: 'set', stickerCount: 40, createdAt: '2026-09-08T00:00:00.000Z',
    });
    expect(job).toMatchObject({ schemaVersion: 2, stickerCount: 40 });
    expect(job.sheets).toEqual(createLineStickerJobSheets(40));
    expect(job.sheets.map((sheet) => sheet.expectedFrames)).toEqual([20, 20]);
  });
});
