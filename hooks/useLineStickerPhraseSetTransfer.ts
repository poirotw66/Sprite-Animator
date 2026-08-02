import { useCallback, useRef } from 'react';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SliceSettings } from '../utils/imageUtils';
import { buildPhraseSetExport, parsePhraseSetJson } from '../utils/lineStickerPhraseSetFormat';
import { planLineStickerPhraseSetImport } from '../utils/lineStickerPhraseSetImport';
import {
  createSetModeSliceSettingsList,
} from '../utils/lineStickerSetModeFactories';
import {
  DEFAULT_LINE_STICKER_SHEET_INDEX,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';

interface UseLineStickerPhraseSetTransferParams {
  stickerSetMode: boolean;
  gridCols: number;
  gridRows: number;
  phrases: string[];
  actionDescs: string[];
  onStickerSetModeChange: (nextMode: boolean) => void;
  setGridCols: Dispatch<SetStateAction<number>>;
  setGridRows: Dispatch<SetStateAction<number>>;
  setSingleSheetSliceSettings: Dispatch<SetStateAction<SliceSettings>>;
  setSinglePhrasesList: Dispatch<SetStateAction<string[]>>;
  setSetPhrasesList: Dispatch<SetStateAction<string[]>>;
  setActionDescsList: Dispatch<SetStateAction<string[]>>;
  setSheetSliceSettings: Dispatch<SetStateAction<SliceSettings[]>>;
  setCurrentSheetIndex: Dispatch<SetStateAction<LineStickerSheetIndex>>;
  setError: Dispatch<SetStateAction<string | null>>;
  invalidFileMessage: string;
}

/**
 * Owns the phrase-set JSON file boundary: download, validation, and state import.
 * The page stays responsible for generation state and mode-reset behavior.
 */
export function useLineStickerPhraseSetTransfer({
  stickerSetMode,
  gridCols,
  gridRows,
  phrases,
  actionDescs,
  onStickerSetModeChange,
  setGridCols,
  setGridRows,
  setSingleSheetSliceSettings,
  setSinglePhrasesList,
  setSetPhrasesList,
  setActionDescsList,
  setSheetSliceSettings,
  setCurrentSheetIndex,
  setError,
  invalidFileMessage,
}: UseLineStickerPhraseSetTransferParams) {
  const phraseSetFileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadPhraseSet = useCallback(() => {
    const payload = buildPhraseSetExport({
      mode: stickerSetMode ? 'set' : 'single',
      gridCols,
      gridRows,
      phrases,
      actionDescs,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `line-sticker-phrase-set-${payload.mode}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [actionDescs, gridCols, gridRows, phrases, stickerSetMode]);

  const handleUploadPhraseSet = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const data = parsePhraseSetJson(reader.result as string);
        if (!data) {
          setError(invalidFileMessage);
          return;
        }

        const plan = planLineStickerPhraseSetImport(data);
        setError(null);

        if (plan.mode === 'single') {
          onStickerSetModeChange(false);
          setGridCols(plan.gridCols);
          setGridRows(plan.gridRows);
          setSingleSheetSliceSettings((previous) => ({
            ...previous,
            cols: plan.gridCols,
            rows: plan.gridRows,
          }));
          setSinglePhrasesList(plan.phrases);
          setActionDescsList(plan.actionDescs);
        } else {
          onStickerSetModeChange(true);
          setSheetSliceSettings(createSetModeSliceSettingsList());
          setSetPhrasesList(plan.phrases);
          setActionDescsList(plan.actionDescs);
          setCurrentSheetIndex(DEFAULT_LINE_STICKER_SHEET_INDEX);
        }
      };
      reader.readAsText(file, 'UTF-8');
      event.target.value = '';
    },
    [
      invalidFileMessage,
      onStickerSetModeChange,
      setActionDescsList,
      setCurrentSheetIndex,
      setError,
      setGridCols,
      setGridRows,
      setSetPhrasesList,
      setSheetSliceSettings,
      setSinglePhrasesList,
      setSingleSheetSliceSettings,
    ]
  );

  return {
    phraseSetFileInputRef,
    handleDownloadPhraseSet,
    handleUploadPhraseSet,
  };
}
