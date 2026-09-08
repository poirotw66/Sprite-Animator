import { useCallback, useMemo } from 'react';
import { LineStickerProgrammaticStyleControls } from '../components/LineSticker/LineStickerProgrammaticStyleControls';
import type { LineStickerResultSidePhraseEdit } from '../components/LineSticker/LineStickerResultPanel';
import type { Translations } from '../i18n/types';
import type { LineStickerSheetIndex } from '../utils/lineStickerSetSchema';
import type { FONT_PRESETS, TEXT_COLOR_PRESETS, LineStickerTextRendering } from '../utils/lineStickerPrompt';
import {
  DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
  type ProgrammaticTextOverlayTuning,
} from '../utils/lineStickerTextOverlay';

/** Owns the optional per-frame text-edit surface used by programmatic single sheets. */
export function useLineStickerFrameEditController({
  t,
  stickerSetMode,
  textRendering,
  includeText,
  phraseGridList,
  actionDescGridList,
  phraseGridCols,
  phraseMaxLength,
  updatePhraseAt,
  updateActionDescAt,
  currentSheetIndex,
  gridCellCount,
  selectedFont,
  setSelectedFont,
  selectedTextColor,
  setSelectedTextColor,
  programmaticTextTuning,
  setProgrammaticTextTuning,
}: {
  t: Translations;
  stickerSetMode: boolean;
  textRendering: LineStickerTextRendering;
  includeText: boolean;
  phraseGridList: string[];
  actionDescGridList: string[];
  phraseGridCols: number;
  phraseMaxLength: number;
  updatePhraseAt: (index: number, value: string) => void;
  updateActionDescAt: (index: number, value: string) => void;
  currentSheetIndex: LineStickerSheetIndex;
  gridCellCount: number;
  selectedFont: keyof typeof FONT_PRESETS;
  setSelectedFont: React.Dispatch<React.SetStateAction<keyof typeof FONT_PRESETS>>;
  selectedTextColor: keyof typeof TEXT_COLOR_PRESETS;
  setSelectedTextColor: React.Dispatch<React.SetStateAction<keyof typeof TEXT_COLOR_PRESETS>>;
  programmaticTextTuning: ProgrammaticTextOverlayTuning;
  setProgrammaticTextTuning: React.Dispatch<React.SetStateAction<ProgrammaticTextOverlayTuning>>;
}) {
  const isEnabled = !stickerSetMode && textRendering === 'programmatic' && includeText;
  const resetProgrammaticTextTuning = useCallback(() => {
    setProgrammaticTextTuning({ ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING });
  }, [setProgrammaticTextTuning]);

  const resultSidePhraseEdit = useMemo((): LineStickerResultSidePhraseEdit | null => {
    if (!isEnabled) return null;
    return {
      phraseGridList,
      actionDescGridList,
      phraseGridCols,
      phraseMaxLength,
      updatePhraseAt,
      updateActionDescAt,
      currentSheetIndex,
    };
  }, [
    actionDescGridList,
    currentSheetIndex,
    isEnabled,
    phraseGridCols,
    phraseGridList,
    phraseMaxLength,
    updateActionDescAt,
    updatePhraseAt,
  ]);

  const frameEditProgrammaticStyleSlot = useMemo(() => {
    if (!isEnabled) return null;
    return (
      <LineStickerProgrammaticStyleControls
        t={t}
        radioNameSuffix="_frameEditPortal"
        frameEditSubtitle={t.lineStickerFrameEditProgrammaticStyleSubtitle}
        stickerCellCount={gridCellCount}
        selectedFont={selectedFont}
        setSelectedFont={setSelectedFont}
        selectedTextColor={selectedTextColor}
        setSelectedTextColor={setSelectedTextColor}
        programmaticTextTuning={programmaticTextTuning}
        setProgrammaticTextTuning={setProgrammaticTextTuning}
        onResetProgrammaticTextTuning={resetProgrammaticTextTuning}
      />
    );
  }, [
    gridCellCount,
    isEnabled,
    programmaticTextTuning,
    resetProgrammaticTextTuning,
    selectedFont,
    selectedTextColor,
    setProgrammaticTextTuning,
    setSelectedFont,
    setSelectedTextColor,
    t,
  ]);

  return {
    resultSidePhraseEdit,
    frameEditProgrammaticStyleSlot,
    resetProgrammaticTextTuning,
  };
}
