import { useCallback, useMemo, useReducer } from 'react';
import {
  createLineStickerRunState,
  getFailedSheetIds,
  isRunActive,
  lineStickerRunActions,
  lineStickerRunReducer,
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
    || stage === 'slicing' || stage === 'failed') return stage;
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
  cancelRun: () => void;
  resetRun: () => void;
  updateSheetStatus: (
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

  const setIsGenerating = useCallback((value: boolean) => {
    dispatch(value ? lineStickerRunActions.start() : lineStickerRunActions.finish());
  }, []);
  const setStatusText = useCallback((value: string) => {
    dispatch(lineStickerRunActions.messageChanged(value || null));
  }, []);
  const setError = useCallback((value: string | null) => {
    dispatch(value
      ? lineStickerRunActions.error({ code: 'ui_error', message: value })
      : lineStickerRunActions.clearError());
  }, []);
  const cancelRun = useCallback(() => dispatch(lineStickerRunActions.cancel()), []);
  const resetRun = useCallback(() => dispatch(lineStickerRunActions.reset()), []);
  const setStage = useCallback((stage: PipelineStage, message?: string | null) => {
    dispatch(lineStickerRunActions.stageChanged(stage, message));
  }, []);

  const updateSheetStatus = useCallback((
    index: LineStickerSheetIndex,
    patch: Partial<LineStickerSheetStatus>,
  ) => {
    const id = sheetId(index);
    if (patch.stage === 'failed') {
      const message = patch.error ?? patch.message ?? 'Sheet generation failed';
      dispatch(lineStickerRunActions.sheetError(
        id,
        { code: 'sheet_failed', message },
        patch.message,
      ));
      return;
    }
    dispatch(lineStickerRunActions.sheetUpdated(id, {
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
    error: state.error?.message ?? null,
    sheetStatuses,
    failedSheetIndices,
    setIsGenerating,
    setStatusText,
    setError,
    setStage,
    cancelRun,
    resetRun,
    updateSheetStatus,
  };
}
