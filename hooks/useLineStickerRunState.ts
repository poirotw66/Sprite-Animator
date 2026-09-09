import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import {
  createLineStickerRunState,
  getFailedSheetIds,
  isRunActive,
  lineStickerRunActions,
  lineStickerRunReducer,
  sanitizeLineStickerRunStateForResume,
  type LineStickerRunState,
} from '../features/line-sticker/domain/lineStickerRunState';
import type { PipelineStage } from '../features/line-sticker/domain/lineStickerJob';
import {
  LINE_STICKER_SHEET_INDICES,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';
import type {
  LineStickerSheetStage,
  LineStickerSheetStatus,
} from './lineStickerSheetGenerationTypes';

const sheetId = (index: LineStickerSheetIndex) => `sheet-${index}`;
const SHEET_IDS = LINE_STICKER_SHEET_INDICES.map(sheetId);

const toDomainStage = (stage: LineStickerSheetStage): PipelineStage =>
  stage === 'completed' ? 'ready' : stage;

const toViewStage = (stage: PipelineStage): LineStickerSheetStage => {
  if (stage === 'ready') return 'completed';
  if (stage === 'queued' || stage === 'generating' || stage === 'processing'
    || stage === 'slicing' || stage === 'failed' || stage === 'cancelled') return stage;
  return 'idle';
};

export interface LineStickerRunController {
  state: LineStickerRunState;
  isGenerating: boolean;
  statusText: string;
  error: string | null;
  sheetStatuses: LineStickerSheetStatus[];
  failedSheetIndices: LineStickerSheetIndex[];
  setIsGenerating: (value: boolean) => void;
  setStatusText: (value: string) => void;
  setError: (value: string | null) => void;
  setStage: (stage: PipelineStage, message?: string | null) => void;
  startRun: () => number;
  finishRun: (runId: number) => void;
  setRunMessage: (runId: number, value: string) => void;
  setRunError: (runId: number, value: string) => void;
  setRunStage: (runId: number, stage: PipelineStage, message?: string | null) => void;
  cancelRun: (runId: number) => void;
  resetRun: () => void;
  hydrateRun: (next: LineStickerRunState) => void;
  updateSheetStatus: (
    runId: number,
    sheetIndex: LineStickerSheetIndex,
    patch: Partial<LineStickerSheetStatus>,
  ) => void;
}

/** React adapter for the serializable reducer shared with CLI/persistence. */
export function useLineStickerRunState(): LineStickerRunController {
  const [state, dispatch] = useReducer(
    lineStickerRunReducer,
    undefined,
    () => createLineStickerRunState({ sheetIds: SHEET_IDS }),
  );
  const latestRunIdRef = useRef(0);
  const activeRunIdRef = useRef(0);
  const [uiError, setUiError] = useState<string | null>(null);

  const startRun = useCallback(() => {
    const runId = latestRunIdRef.current + 1;
    latestRunIdRef.current = runId;
    activeRunIdRef.current = runId;
    setUiError(null);
    dispatch(lineStickerRunActions.start(runId));
    return runId;
  }, []);
  const finishRun = useCallback((runId: number) => {
    dispatch(lineStickerRunActions.finish(runId));
  }, []);
  const setRunMessage = useCallback((runId: number, value: string) => {
    dispatch(lineStickerRunActions.messageChanged(runId, value || null));
  }, []);
  const setRunError = useCallback((runId: number, value: string) => {
    dispatch(lineStickerRunActions.error(runId, { code: 'generation_failed', message: value }));
  }, []);
  const setRunStage = useCallback((runId: number, stage: PipelineStage, message?: string | null) => {
    dispatch(lineStickerRunActions.stageChanged(runId, stage, message));
  }, []);

  const setIsGenerating = useCallback((value: boolean) => {
    if (value) {
      startRun();
      return;
    }
    finishRun(activeRunIdRef.current);
  }, [finishRun, startRun]);
  const setStatusText = useCallback((value: string) => {
    setRunMessage(activeRunIdRef.current, value);
  }, [setRunMessage]);
  const setError = useCallback((value: string | null) => {
    setUiError(value);
  }, []);
  const cancelRun = useCallback((runId: number) => dispatch(lineStickerRunActions.cancel(runId)), []);
  const resetRun = useCallback(() => {
    setUiError(null);
    dispatch(lineStickerRunActions.reset());
  }, []);
  const hydrateRun = useCallback((next: LineStickerRunState) => {
    const sanitized = sanitizeLineStickerRunStateForResume(next);
    latestRunIdRef.current = sanitized.runId;
    activeRunIdRef.current = isRunActive(sanitized) ? sanitized.runId : 0;
    setUiError(null);
    dispatch(lineStickerRunActions.hydrate(sanitized));
  }, []);
  const setStage = useCallback((stage: PipelineStage, message?: string | null) => {
    setRunStage(activeRunIdRef.current, stage, message);
  }, [setRunStage]);

  const updateSheetStatus = useCallback((
    runId: number,
    index: LineStickerSheetIndex,
    patch: Partial<LineStickerSheetStatus>,
  ) => {
    const id = sheetId(index);
    if (patch.stage === 'failed') {
      const message = patch.error ?? patch.message ?? 'Sheet generation failed';
      dispatch(lineStickerRunActions.sheetError(
        runId,
        id,
        { code: 'sheet_failed', message },
        patch.message,
      ));
      return;
    }
    dispatch(lineStickerRunActions.sheetUpdated(runId, id, {
      ...(patch.stage === undefined ? {} : { stage: toDomainStage(patch.stage) }),
      ...(patch.progress === undefined ? {} : { progress: patch.progress }),
      ...(patch.message === undefined ? {} : { message: patch.message || null }),
    }));
  }, []);

  const sheetStatuses = useMemo<LineStickerSheetStatus[]>(() =>
    LINE_STICKER_SHEET_INDICES.map((index) => {
      const sheet = state.sheets[sheetId(index)];
      return {
        sheetIndex: index,
        stage: toViewStage(sheet.stage),
        progress: sheet.progress,
        message: sheet.message ?? '',
        error: sheet.error?.message ?? null,
        attempts: sheet.attempts,
      };
    }), [state.sheets]);

  const failedSheetIndices = useMemo(() =>
    getFailedSheetIds(state)
      .map((id) => Number(id.replace('sheet-', '')))
      .filter((index): index is LineStickerSheetIndex =>
        LINE_STICKER_SHEET_INDICES.includes(index as LineStickerSheetIndex)),
  [state]);

  return {
    state,
    isGenerating: isRunActive(state),
    statusText: state.message ?? '',
    error: uiError ?? state.error?.message ?? null,
    sheetStatuses,
    failedSheetIndices,
    setIsGenerating,
    setStatusText,
    setError,
    setStage,
    startRun,
    finishRun,
    setRunMessage,
    setRunError,
    setRunStage,
    cancelRun,
    resetRun,
    hydrateRun,
    updateSheetStatus,
  };
}
