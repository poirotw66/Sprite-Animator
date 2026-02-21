import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction, SyntheticEvent } from 'react';
import { DEFAULT_SLICE_SETTINGS } from '../utils/constants';
import {
  getEffectivePadding,
  sliceSpriteSheet,
  type FrameOverride,
  type PaddingFour,
  type SliceSettings,
} from '../utils/imageUtils';
import type { ChromaKeyColorType } from '../types';
import { logger } from '../utils/logger';

interface UseLineStickerSlicingParams {
  chromaKeyColor: ChromaKeyColorType;
  processedSpriteSheet: string | null;
  sliceSettings: SliceSettings;
  frameOverrides: FrameOverride[];
  gridCols: number;
  gridRows: number;
  sheetDimensions: { width: number; height: number };
  setStickerFrames: (value: string[]) => void;
  setSelectedFrames: (value: boolean[]) => void;
  stickerSetMode: boolean;
  currentSheetIndex: 0 | 1 | 2;
  processedSheetImages: (string | null)[];
  sheetFrameOverrides: FrameOverride[][];
  setSheetFrames: Dispatch<SetStateAction<string[][]>>;
  setSheetDimensions: Dispatch<SetStateAction<{ width: number; height: number }>>;
}

export function useLineStickerSlicing({
  chromaKeyColor,
  processedSpriteSheet,
  sliceSettings,
  frameOverrides,
  gridCols,
  gridRows,
  sheetDimensions,
  setStickerFrames,
  setSelectedFrames,
  stickerSetMode,
  currentSheetIndex,
  processedSheetImages,
  sheetFrameOverrides,
  setSheetFrames,
  setSheetDimensions,
}: UseLineStickerSlicingParams) {
  const sliceProcessedSheetToFrames = useCallback(
    async (processedImage: string): Promise<string[]> => {
      const settings = { ...DEFAULT_SLICE_SETTINGS, cols: 4, rows: 4 };
      const pad: PaddingFour = { left: 10, right: 10, top: 10, bottom: 10 };
      return sliceSpriteSheet(
        processedImage,
        settings.cols,
        settings.rows,
        settings.paddingX,
        settings.paddingY,
        settings.shiftX,
        settings.shiftY,
        false,
        230,
        [],
        chromaKeyColor,
        pad
      );
    },
    [chromaKeyColor]
  );

  useEffect(() => {
    if (!processedSpriteSheet || !sheetDimensions.width || !sheetDimensions.height) return;
    let cancelled = false;
    const run = async () => {
      try {
        const pad: PaddingFour = getEffectivePadding(sliceSettings);
        const frames = await sliceSpriteSheet(
          processedSpriteSheet,
          gridCols,
          gridRows,
          sliceSettings.paddingX,
          sliceSettings.paddingY,
          sliceSettings.shiftX,
          sliceSettings.shiftY,
          false,
          230,
          frameOverrides,
          chromaKeyColor,
          pad
        );
        if (!cancelled) {
          setStickerFrames(frames);
          setSelectedFrames(new Array(frames.length).fill(false));
        }
      } catch (err) {
        if (!cancelled) logger.error('Slice fail:', err);
      }
    };
    const timer = setTimeout(run, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    processedSpriteSheet,
    sliceSettings,
    frameOverrides,
    gridCols,
    gridRows,
    chromaKeyColor,
    sheetDimensions,
    setStickerFrames,
    setSelectedFrames,
  ]);

  useEffect(() => {
    if (!stickerSetMode) return;
    const processed = processedSheetImages[currentSheetIndex];
    if (!processed || !sheetDimensions.width || !sheetDimensions.height) return;
    const overrides = sheetFrameOverrides[currentSheetIndex] || [];
    const settings = { ...DEFAULT_SLICE_SETTINGS, cols: 4, rows: 4 };
    let cancelled = false;
    const pad: PaddingFour = { left: 10, right: 10, top: 10, bottom: 10 };
    const run = async () => {
      try {
        const frames = await sliceSpriteSheet(
          processed,
          settings.cols,
          settings.rows,
          settings.paddingX,
          settings.paddingY,
          settings.shiftX,
          settings.shiftY,
          false,
          230,
          overrides,
          chromaKeyColor,
          pad
        );
        if (!cancelled) {
          setSheetFrames((prev) => {
            const next = [...prev];
            next[currentSheetIndex] = frames;
            return next;
          });
        }
      } catch (err) {
        if (!cancelled) logger.error('Set mode re-slice fail:', err);
      }
    };
    const timer = setTimeout(run, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    stickerSetMode,
    currentSheetIndex,
    processedSheetImages,
    sheetFrameOverrides,
    sheetDimensions,
    chromaKeyColor,
    setSheetFrames,
  ]);

  const handleImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      setSheetDimensions({
        width: event.currentTarget.naturalWidth,
        height: event.currentTarget.naturalHeight,
      });
    },
    [setSheetDimensions]
  );

  return {
    handleImageLoad,
    sliceProcessedSheetToFrames,
  };
}
