import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction, SyntheticEvent } from 'react';
import {
  sliceSheetWithSettings,
  type FrameOverride,
  type SliceSettings,
} from '../utils/imageUtils';
import type { ChromaKeyColorType } from '../types';
import { logger } from '../utils/logger';
import { LINE_STICKER_CELL_INSET_RATIO } from '../utils/constants';
import {
  createLineStickerSetSliceSettings,
  sliceLineStickerSheetFrames,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';
import type { LineStickerTextRendering } from '../utils/lineStickerPrompt';

interface UseLineStickerSlicingParams {
  chromaKeyColor: ChromaKeyColorType;
  processedSpriteSheet: string | null;
  sliceSettings: SliceSettings;
  sheetSliceSettings: SliceSettings[];
  frameOverrides: FrameOverride[];
  gridCols: number;
  gridRows: number;
  sheetDimensions: { width: number; height: number };
  setStickerFrames: (value: string[]) => void;
  setSelectedFrames: (value: boolean[]) => void;
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  processedSheetImages: (string | null)[];
  sheetFrameOverrides: FrameOverride[][];
  setSheetFrames: Dispatch<SetStateAction<string[][]>>;
  setSheetDimensions: Dispatch<SetStateAction<{ width: number; height: number }>>;
  /** Programmatic text: slice only; overlay runs in LineStickerPage. */
  textRendering: LineStickerTextRendering;
  includeText: boolean;
  setPhrasesList: string[];
  /** Single-mode phrase row (length cols*rows); used when set-mode first slice path runs. */
  phraseListSingle: string[];
  /** Raw sliced frames before browser overlay (for programmatic live compositing). */
  onProgrammaticRawFrames?: (rawFrames: string[], sheetIndex: LineStickerSheetIndex) => void;
}

interface SliceProcessedSheetOptions {
  sheetIndex?: LineStickerSheetIndex;
  /** Use when slice settings were just optimized and React state may not have flushed yet. */
  sliceSettingsOverride?: SliceSettings;
}

function withGridSize(
  settings: SliceSettings,
  cols: number,
  rows: number
): SliceSettings {
  return { ...settings, cols, rows };
}

export function useLineStickerSlicing({
  chromaKeyColor,
  processedSpriteSheet,
  sliceSettings,
  sheetSliceSettings,
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
  textRendering,
  includeText,
  setPhrasesList,
  phraseListSingle,
  onProgrammaticRawFrames,
}: UseLineStickerSlicingParams) {
  const passThroughOrCaptureRaw = useCallback(
    async (
      frames: string[],
      _phraseSlice: string[],
      sheetIndex: LineStickerSheetIndex
    ): Promise<string[]> => {
      if (textRendering === 'programmatic' && includeText) {
        onProgrammaticRawFrames?.(frames, sheetIndex);
      }
      return frames;
    },
    [textRendering, includeText, onProgrammaticRawFrames]
  );

  const sliceProcessedSheetToFrames = useCallback(
    async (
      processedImage: string,
      options?: SliceProcessedSheetOptions
    ): Promise<string[]> => {
      const targetSheetIndex = options?.sheetIndex ?? currentSheetIndex;
      const settings =
        options?.sliceSettingsOverride ??
        (stickerSetMode
          ? (sheetSliceSettings[targetSheetIndex] ?? createLineStickerSetSliceSettings())
          : sliceSettings);
      const overrides = stickerSetMode
        ? (sheetFrameOverrides[targetSheetIndex] ?? [])
        : frameOverrides;
      const cols = stickerSetMode ? settings.cols : gridCols;
      const rows = stickerSetMode ? settings.rows : gridRows;

      const raw = await sliceSheetWithSettings(
        processedImage,
        withGridSize(settings, cols, rows),
        {
          frameOverrides: overrides,
          chromaKeyColor,
          cellInsetRatio: LINE_STICKER_CELL_INSET_RATIO,
        }
      );
      const sheetIdx = targetSheetIndex;
      const phraseSlice = stickerSetMode
        ? sliceLineStickerSheetFrames(setPhrasesList, sheetIdx)
        : phraseListSingle;
      return passThroughOrCaptureRaw(raw, phraseSlice, sheetIdx);
    },
    [
      chromaKeyColor,
      currentSheetIndex,
      frameOverrides,
      gridCols,
      gridRows,
      passThroughOrCaptureRaw,
      phraseListSingle,
      setPhrasesList,
      sheetFrameOverrides,
      sheetSliceSettings,
      sliceSettings,
      stickerSetMode,
    ]
  );

  useEffect(() => {
    if (!processedSpriteSheet || !sheetDimensions.width || !sheetDimensions.height) return;
    let cancelled = false;
    const run = async () => {
      try {
        const raw = await sliceSheetWithSettings(
          processedSpriteSheet,
          withGridSize(sliceSettings, gridCols, gridRows),
          {
            frameOverrides,
            chromaKeyColor,
            cellInsetRatio: LINE_STICKER_CELL_INSET_RATIO,
          }
        );
        const phraseSlice = stickerSetMode
          ? sliceLineStickerSheetFrames(setPhrasesList, currentSheetIndex)
          : phraseListSingle;
        const frames = await passThroughOrCaptureRaw(raw, phraseSlice, currentSheetIndex);
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
    passThroughOrCaptureRaw,
    phraseListSingle,
    setPhrasesList,
    currentSheetIndex,
    stickerSetMode,
  ]);

  useEffect(() => {
    if (!stickerSetMode) return;
    const processed = processedSheetImages[currentSheetIndex];
    if (!processed || !sheetDimensions.width || !sheetDimensions.height) return;
    const overrides = sheetFrameOverrides[currentSheetIndex] || [];
    const settings = sheetSliceSettings[currentSheetIndex] ?? createLineStickerSetSliceSettings();
    let cancelled = false;
    const run = async () => {
      try {
        const raw = await sliceSheetWithSettings(processed, settings, {
          frameOverrides: overrides,
          chromaKeyColor,
          cellInsetRatio: LINE_STICKER_CELL_INSET_RATIO,
        });
        const phraseSlice = sliceLineStickerSheetFrames(setPhrasesList, currentSheetIndex);
        const frames = await passThroughOrCaptureRaw(raw, phraseSlice, currentSheetIndex);
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
    sheetSliceSettings,
    sheetDimensions,
    chromaKeyColor,
    setSheetFrames,
    passThroughOrCaptureRaw,
    setPhrasesList,
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
