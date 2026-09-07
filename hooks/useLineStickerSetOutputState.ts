import { useCallback, useState } from 'react';
import type { FrameOverride, SliceSettings } from '../utils/imageUtils';
import {
  createEmptySetModeFrameList,
  createEmptySetModeImageList,
  createEmptySetModeOverrideList,
  createEmptySetModeSelectionList,
  createSetModeSliceSettingsList,
} from '../utils/lineStickerSetModeFactories';
import {
  DEFAULT_LINE_STICKER_SHEET_INDEX,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';

/** Owns generated artifacts and slicing state for the three-sheet sticker-set flow. */
export function useLineStickerSetOutputState() {
  const [sheetSliceSettings, setSheetSliceSettings] = useState<SliceSettings[]>(
    () => createSetModeSliceSettingsList(),
  );
  const [sheetDimensions, setSheetDimensions] = useState({ width: 0, height: 0 });
  const [frameOverrides, setFrameOverrides] = useState<FrameOverride[]>([]);
  const [chromaKeyProgress, setChromaKeyProgress] = useState(0);
  const [isProcessingChromaKey, setIsProcessingChromaKey] = useState(false);
  const [sheetImages, setSheetImages] = useState<(string | null)[]>(
    () => createEmptySetModeImageList(),
  );
  const [processedSheetImages, setProcessedSheetImages] = useState<(string | null)[]>(
    () => createEmptySetModeImageList(),
  );
  const [sheetFrames, setSheetFrames] = useState<string[][]>(
    () => createEmptySetModeFrameList(),
  );
  const [sheetFrameOverrides, setSheetFrameOverrides] = useState<FrameOverride[][]>(
    () => createEmptySetModeOverrideList(),
  );
  const [selectedFramesBySheet, setSelectedFramesBySheet] = useState<boolean[][]>(
    () => createEmptySetModeSelectionList(),
  );
  const [currentSheetIndex, setCurrentSheetIndex] = useState<LineStickerSheetIndex>(
    DEFAULT_LINE_STICKER_SHEET_INDEX,
  );
  const [spriteSheetImage, setSpriteSheetImage] = useState<string | null>(null);
  const [processedSpriteSheet, setProcessedSpriteSheet] = useState<string | null>(null);
  const [stickerFrames, setStickerFrames] = useState<string[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<boolean[]>([]);

  const resetSetOutputState = useCallback(() => {
    setCurrentSheetIndex(DEFAULT_LINE_STICKER_SHEET_INDEX);
    setSheetImages(createEmptySetModeImageList());
    setProcessedSheetImages(createEmptySetModeImageList());
    setSheetFrames(createEmptySetModeFrameList());
    setSheetFrameOverrides(createEmptySetModeOverrideList());
    setSelectedFramesBySheet(createEmptySetModeSelectionList());
    setSpriteSheetImage(null);
    setProcessedSpriteSheet(null);
    setStickerFrames([]);
    setSelectedFrames([]);
    setFrameOverrides([]);
    setSheetDimensions({ width: 0, height: 0 });
    setChromaKeyProgress(0);
    setIsProcessingChromaKey(false);
  }, []);

  return {
    sheetSliceSettings, setSheetSliceSettings,
    sheetDimensions, setSheetDimensions,
    frameOverrides, setFrameOverrides,
    chromaKeyProgress, setChromaKeyProgress,
    isProcessingChromaKey, setIsProcessingChromaKey,
    sheetImages, setSheetImages,
    processedSheetImages, setProcessedSheetImages,
    sheetFrames, setSheetFrames,
    sheetFrameOverrides, setSheetFrameOverrides,
    selectedFramesBySheet, setSelectedFramesBySheet,
    currentSheetIndex, setCurrentSheetIndex,
    spriteSheetImage, setSpriteSheetImage,
    processedSpriteSheet, setProcessedSpriteSheet,
    stickerFrames, setStickerFrames,
    selectedFrames, setSelectedFrames,
    resetSetOutputState,
  };
}
