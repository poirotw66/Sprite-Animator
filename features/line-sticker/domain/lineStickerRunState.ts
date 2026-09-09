import type { PipelineStage } from './lineStickerJob';

export interface RunError {
  code: string;
  message: string;
}

/** The complete mutable state for one sheet. There are no overlapping busy flags. */
export interface SheetRunState {
  sheetId: string;
  stage: PipelineStage;
  progress: number;
  message: string | null;
  error: RunError | null;
  attempts: number;
}

export interface LineStickerRunState {
  /** Monotonically increments for each start, useful for rejecting stale async work. */
  runId: number;
  stage: PipelineStage;
  /** Human-readable progress detail. Kept serializable for UI/CLI resume. */
  message: string | null;
  sheets: Record<string, SheetRunState>;
  error: RunError | null;
}

export interface CreateLineStickerRunStateOptions {
  sheetIds: readonly string[];
  runId?: number;
}

export type LineStickerRunAction =
  | { type: 'run/start'; runId: number }
  | { type: 'run/finish'; runId: number }
  | { type: 'run/stageChanged'; runId: number; stage: PipelineStage; message?: string | null }
  | { type: 'run/messageChanged'; runId: number; message: string | null }
  | { type: 'run/error'; runId: number; error: RunError }
  | { type: 'run/errorCleared'; runId: number }
  | { type: 'run/cancel'; runId: number }
  | { type: 'run/reset' }
  | { type: 'run/hydrate'; state: LineStickerRunState }
  | {
      type: 'sheet/updated';
      runId: number;
      sheetId: string;
      stage?: PipelineStage;
      progress?: number;
      message?: string | null;
    }
  | { type: 'sheet/error'; runId: number; sheetId: string; error: RunError; message?: string | null };

const ACTIVE_STAGES: readonly PipelineStage[] = [
  'validating', 'queued', 'generating', 'processing', 'slicing', 'qa', 'packaging',
];

const ALLOWED_TRANSITIONS: Readonly<Record<PipelineStage, readonly PipelineStage[]>> = {
  idle: ['validating', 'queued', 'generating', 'failed', 'cancelled'],
  validating: ['queued', 'generating', 'failed', 'cancelled'],
  queued: ['generating', 'failed', 'cancelled'],
  generating: ['processing', 'slicing', 'qa', 'ready', 'failed', 'cancelled'],
  processing: ['slicing', 'qa', 'ready', 'failed', 'cancelled'],
  slicing: ['qa', 'ready', 'failed', 'cancelled'],
  qa: ['packaging', 'ready', 'failed', 'cancelled'],
  packaging: ['ready', 'failed', 'cancelled'],
  ready: ['queued', 'generating'],
  failed: ['queued', 'generating', 'cancelled'],
  cancelled: ['queued', 'generating'],
};

function createSheetRunState(sheetId: string): SheetRunState {
  return { sheetId, stage: 'idle', progress: 0, message: null, error: null, attempts: 0 };
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, progress));
}

function canTransition(from: PipelineStage, to: PipelineStage): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

function isTerminal(stage: PipelineStage): boolean {
  return stage === 'ready' || stage === 'failed' || stage === 'cancelled';
}

function deriveStage(sheets: Record<string, SheetRunState>, fallback: PipelineStage): PipelineStage {
  const values = Object.values(sheets);
  if (values.some((sheet) => isActivePipelineStage(sheet.stage))) {
    return values.find((sheet) => sheet.stage === 'generating')?.stage
      ?? values.find((sheet) => sheet.stage === 'processing')?.stage
      ?? values.find((sheet) => sheet.stage === 'slicing')?.stage
      ?? values.find((sheet) => sheet.stage === 'qa')?.stage
      ?? values.find((sheet) => sheet.stage === 'packaging')?.stage
      ?? values.find((sheet) => sheet.stage === 'queued')?.stage
      ?? fallback;
  }
  if (values.length > 0 && values.every((sheet) => sheet.stage === 'ready')) return 'ready';
  if (values.some((sheet) => sheet.stage === 'failed')) return 'failed';
  if (values.length > 0 && values.every((sheet) => sheet.stage === 'cancelled')) return 'cancelled';
  return fallback;
}

export function createLineStickerRunState({ sheetIds, runId = 0 }: CreateLineStickerRunStateOptions): LineStickerRunState {
  return {
    runId,
    stage: 'idle',
    message: null,
    sheets: Object.fromEntries(sheetIds.map((sheetId) => [sheetId, createSheetRunState(sheetId)])),
    error: null,
  };
}

/**
 * A pure reducer deliberately ignores unknown sheet ids and illegal lifecycle
 * jumps. Async adapters can dispatch optimistically without corrupting state.
 */
export function lineStickerRunReducer(
  state: LineStickerRunState,
  action: LineStickerRunAction,
): LineStickerRunState {
  if (
    action.type !== 'run/start'
    && action.type !== 'run/reset'
    && action.type !== 'run/hydrate'
    && action.runId !== state.runId
  ) {
    return state;
  }

  switch (action.type) {
    case 'run/hydrate':
      return action.state;
    case 'run/start': {
      if (!Number.isSafeInteger(action.runId) || action.runId <= state.runId) return state;
      const sheets = Object.fromEntries(Object.entries(state.sheets).map(([id, sheet]) => [
        id,
        isActivePipelineStage(sheet.stage)
          ? { ...createSheetRunState(id), attempts: sheet.attempts }
          : sheet,
      ]));
      return { ...state, runId: action.runId, stage: 'validating', message: null, sheets, error: null };
    }
    case 'run/reset':
      return createLineStickerRunState({ sheetIds: Object.keys(state.sheets), runId: state.runId });
    case 'run/error':
      return { ...state, stage: 'failed', message: action.error.message, error: action.error };
    case 'run/errorCleared':
      return { ...state, error: null };
    case 'run/messageChanged':
      return { ...state, message: action.message };
    case 'run/finish': {
      if (state.stage === 'cancelled') return { ...state, message: null };
      const hasError = state.error !== null
        || Object.values(state.sheets).some((sheet) => sheet.stage === 'failed');
      return { ...state, stage: hasError ? 'failed' : 'ready', message: null };
    }
    case 'run/cancel': {
      const sheets = Object.fromEntries(Object.entries(state.sheets).map(([id, sheet]) => [
        id,
        isActivePipelineStage(sheet.stage)
          ? { ...sheet, stage: 'cancelled' as const, message: null, error: null }
          : sheet,
      ]));
      return { ...state, stage: 'cancelled', message: null, sheets, error: null };
    }
    case 'run/stageChanged':
      return canTransition(state.stage, action.stage)
        ? {
            ...state,
            stage: action.stage,
            ...(action.message === undefined ? {} : { message: action.message }),
            error: action.stage === 'failed' ? state.error : null,
          }
        : state;
    case 'sheet/error': {
      const sheet = state.sheets[action.sheetId];
      if (!sheet || !canTransition(sheet.stage, 'failed')) return state;
      const sheets = {
        ...state.sheets,
        [action.sheetId]: { ...sheet, stage: 'failed' as const, error: action.error, message: action.message ?? action.error.message },
      };
      return { ...state, sheets, stage: deriveStage(sheets, state.stage) };
    }
    case 'sheet/updated': {
      const sheet = state.sheets[action.sheetId];
      const nextStage = action.stage ?? sheet?.stage;
      if (!sheet || !nextStage || !canTransition(sheet.stage, nextStage)) return state;
      const next: SheetRunState = {
        ...sheet,
        stage: nextStage,
        progress: clampProgress(action.progress ?? (nextStage === 'ready' ? 100 : sheet.progress)),
        ...(action.message === undefined ? {} : { message: action.message }),
        error: nextStage === 'failed' ? sheet.error : null,
        attempts: nextStage === 'generating' && sheet.stage !== 'generating'
          ? sheet.attempts + 1
          : sheet.attempts,
      };
      const sheets = { ...state.sheets, [action.sheetId]: next };
      return { ...state, sheets, stage: deriveStage(sheets, state.stage) };
    }
  }
}

export function isActivePipelineStage(stage: PipelineStage): boolean {
  return ACTIVE_STAGES.includes(stage);
}

/** Coerce in-flight stages so a refreshed page never looks mid-generation. */
export function sanitizeLineStickerRunStateForResume(run: LineStickerRunState): LineStickerRunState {
  const sheets = Object.fromEntries(Object.entries(run.sheets).map(([id, sheet]) => [
    id,
    isActivePipelineStage(sheet.stage)
      ? { ...sheet, stage: 'cancelled' as const, message: null, error: null }
      : sheet,
  ]));
  return {
    ...run,
    sheets,
    stage: deriveStage(sheets, isActivePipelineStage(run.stage) ? 'cancelled' : run.stage),
    message: isActivePipelineStage(run.stage) ? null : run.message,
  };
}

export function isRunActive(state: LineStickerRunState): boolean {
  return isActivePipelineStage(state.stage);
}

export function isSheetActive(state: LineStickerRunState, sheetId: string): boolean {
  const sheet = state.sheets[sheetId];
  return sheet ? isActivePipelineStage(sheet.stage) : false;
}

export function hasRunError(state: LineStickerRunState): boolean {
  return state.error !== null || Object.values(state.sheets).some((sheet) => sheet.error !== null);
}

export function getFailedSheetIds(state: LineStickerRunState): string[] {
  return Object.values(state.sheets)
    .filter((sheet) => sheet.stage === 'failed')
    .map((sheet) => sheet.sheetId);
}

export const lineStickerRunActions = {
  start: (runId: number): LineStickerRunAction => ({ type: 'run/start', runId }),
  finish: (runId: number): LineStickerRunAction => ({ type: 'run/finish', runId }),
  reset: (): LineStickerRunAction => ({ type: 'run/reset' }),
  hydrate: (state: LineStickerRunState): LineStickerRunAction => ({ type: 'run/hydrate', state }),
  cancel: (runId: number): LineStickerRunAction => ({ type: 'run/cancel', runId }),
  error: (runId: number, error: RunError): LineStickerRunAction => ({ type: 'run/error', runId, error }),
  clearError: (runId: number): LineStickerRunAction => ({ type: 'run/errorCleared', runId }),
  messageChanged: (runId: number, message: string | null): LineStickerRunAction => ({
    type: 'run/messageChanged', runId, message,
  }),
  stageChanged: (runId: number, stage: PipelineStage, message?: string | null): LineStickerRunAction => ({
    type: 'run/stageChanged', runId, stage, ...(message === undefined ? {} : { message }),
  }),
  sheetStageChanged: (
    runId: number,
    sheetId: string,
    stage: PipelineStage,
    options: { progress?: number; message?: string | null } = {},
  ): LineStickerRunAction => ({ type: 'sheet/updated', runId, sheetId, stage, ...options }),
  sheetUpdated: (
    runId: number,
    sheetId: string,
    options: { stage?: PipelineStage; progress?: number; message?: string | null },
  ): LineStickerRunAction => ({ type: 'sheet/updated', runId, sheetId, ...options }),
  sheetError: (runId: number, sheetId: string, error: RunError, message?: string | null): LineStickerRunAction => ({
    type: 'sheet/error', runId, sheetId, error, ...(message === undefined ? {} : { message }),
  }),
};
