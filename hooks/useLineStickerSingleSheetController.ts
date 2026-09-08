import { useCallback } from 'react';
import type { ChromaKeyColorType, BgRemovalMethod } from '../types';
import { DEFAULT_SLICE_SETTINGS, LINE_STICKER_CELL_INSET_RATIO } from '../utils/constants';
import type { SliceSettings } from '../utils/imageUtils';
import { LINE_STICKER_SET_COLS, LINE_STICKER_SET_ROWS } from '../utils/lineStickerSetSchema';
import { useSpriteSheetFlow } from './useSpriteSheetFlow';

/** Owns the shared upload/slice/chroma lifecycle used by one-sheet mode. */
export function useLineStickerSingleSheetController({
  bgRemovalMethod,
  chromaKeyColor,
  mapFramesAfterSlice,
}: {
  bgRemovalMethod: BgRemovalMethod;
  chromaKeyColor: ChromaKeyColorType;
  mapFramesAfterSlice?: (frames: string[]) => Promise<string[]>;
}) {
  const flow = useSpriteSheetFlow({
    runChromaAutomatically: bgRemovalMethod === 'chroma',
    chromaKeyColor,
    autoOptimizeSlice: true,
    initialSliceSettings: {
      ...DEFAULT_SLICE_SETTINGS,
      cols: LINE_STICKER_SET_COLS,
      rows: LINE_STICKER_SET_ROWS,
    } as SliceSettings,
    mapFramesAfterSlice,
    cellInsetRatio: LINE_STICKER_CELL_INSET_RATIO,
  });
  const {
    setImage,
    setProcessedImage,
    setFrames,
    setFrameIncluded,
    setFrameOverrides,
    setChromaKeyProgress,
    setIsProcessingChromaKey,
  } = flow;

  const resetGeneratedOutputs = useCallback(() => {
    setImage(null);
    setProcessedImage(null);
    setFrames([]);
    setFrameIncluded([]);
    setFrameOverrides([]);
    setChromaKeyProgress(0);
    setIsProcessingChromaKey(false);
  }, [
    setChromaKeyProgress,
    setFrameIncluded,
    setFrameOverrides,
    setFrames,
    setImage,
    setIsProcessingChromaKey,
    setProcessedImage,
  ]);

  return { ...flow, resetGeneratedOutputs };
}
