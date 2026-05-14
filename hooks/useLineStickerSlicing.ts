import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction, SyntheticEvent } from 'react';
import {
  getEffectivePadding,
  sliceSpriteSheet,
  type FrameOverride,
  type PaddingFour,
  type SliceSettings,
} from '../utils/imageUtils';
import type { ChromaKeyColorType } from '../types';
import { logger } from '../utils/logger';
import {
  createLineStickerSetSliceSettings,
  sliceLineStickerSheetFrames,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';
import type { LineStickerTextRendering } from '../utils/lineStickerPrompt';
import { FONT_PRESETS, TEXT_COLOR_PRESETS } from '../utils/lineStickerPrompt';
import {
  overlayPhrasesOnStickerFrames,
  type ProgrammaticTextOverlayTuning,
} from '../utils/lineStickerTextOverlay';

type FontPresetKey = keyof typeof FONT_PRESETS;
type TextColorPresetKey = keyof typeof TEXT_COLOR_PRESETS;

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
  /** Programmatic text overlay (set mode slicing). */
  textRendering: LineStickerTextRendering;
  includeText: boolean;
  selectedFont: FontPresetKey;
  selectedTextColor: TextColorPresetKey;
  setPhrasesList: string[];
  /** Single-mode phrase row (length cols*rows); used when set-mode first slice path runs. */
  phraseListSingle: string[];
  programmaticTextTuning: ProgrammaticTextOverlayTuning;
  /** Called with sliced frames before optional programmatic overlay (for live preview). */
  onProgrammaticRawFrames?: (rawFrames: string[], sheetIndex: LineStickerSheetIndex) => void;
}

interface SliceProcessedSheetOptions {
  sheetIndex?: LineStickerSheetIndex;
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
  selectedFont,
  selectedTextColor,
  setPhrasesList,
  phraseListSingle,
  programmaticTextTuning,
  onProgrammaticRawFrames,
}: UseLineStickerSlicingParams) {
  const maybeOverlay = useCallback(
    async (frames: string[], phraseSlice: string[]): Promise<string[]> => {
      if (textRendering !== 'programmatic' || !includeText) {
        return frames;
      }
      const aligned = frames.map((_, i) => phraseSlice[i] ?? '');
      return overlayPhrasesOnStickerFrames(frames, aligned, {
        fontKey: selectedFont,
        colorKey: selectedTextColor,
        tuning: programmaticTextTuning,
      });
    },
    [textRendering, includeText, selectedFont, selectedTextColor, programmaticTextTuning]
  );
  const sliceProcessedSheetToFrames = useCallback(
    async (
      processedImage: string,
      options?: SliceProcessedSheetOptions
    ): Promise<string[]> => {
      const targetSheetIndex = options?.sheetIndex ?? currentSheetIndex;
      const settings = stickerSetMode
        ? (sheetSliceSettings[targetSheetIndex] ?? createLineStickerSetSliceSettings())
        : sliceSettings;
      const overrides = stickerSetMode
        ? (sheetFrameOverrides[targetSheetIndex] ?? [])
        : frameOverrides;
      const cols = stickerSetMode ? settings.cols : gridCols;
      const rows = stickerSetMode ? settings.rows : gridRows;
      const pad: PaddingFour = getEffectivePadding(settings);

      const raw = await sliceSpriteSheet(
        processedImage,
        cols,
        rows,
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
      const sheetIdx = targetSheetIndex;
      const phraseSlice = stickerSetMode
        ? sliceLineStickerSheetFrames(setPhrasesList, sheetIdx)
        : phraseListSingle;
      onProgrammaticRawFrames?.(raw, sheetIdx);
      return maybeOverlay(raw, phraseSlice);
    },
    [
      chromaKeyColor,
      currentSheetIndex,
      frameOverrides,
      gridCols,
      gridRows,
      maybeOverlay,
      phraseListSingle,
      setPhrasesList,
      sheetFrameOverrides,
      sheetSliceSettings,
      sliceSettings,
      stickerSetMode,
      programmaticTextTuning,
      onProgrammaticRawFrames,
    ]
  );

  useEffect(() => {
    if (!processedSpriteSheet || !sheetDimensions.width || !sheetDimensions.height) return;
    let cancelled = false;
    const run = async () => {
      try {
        const pad: PaddingFour = getEffectivePadding(sliceSettings);
        const raw = await sliceSpriteSheet(
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
        const phraseSlice = stickerSetMode
          ? sliceLineStickerSheetFrames(setPhrasesList, currentSheetIndex)
          : phraseListSingle;
        onProgrammaticRawFrames?.(raw, currentSheetIndex);
        const frames = await maybeOverlay(raw, phraseSlice);
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
    maybeOverlay,
    phraseListSingle,
    setPhrasesList,
    currentSheetIndex,
    stickerSetMode,
    programmaticTextTuning,
    onProgrammaticRawFrames,
  ]);

  useEffect(() => {
    if (!stickerSetMode) return;
    const processed = processedSheetImages[currentSheetIndex];
    if (!processed || !sheetDimensions.width || !sheetDimensions.height) return;
    const overrides = sheetFrameOverrides[currentSheetIndex] || [];
    const settings = sheetSliceSettings[currentSheetIndex] ?? createLineStickerSetSliceSettings();
    let cancelled = false;
    const pad: PaddingFour = getEffectivePadding(settings);
    const run = async () => {
      try {
        const raw = await sliceSpriteSheet(
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
        const phraseSlice = sliceLineStickerSheetFrames(setPhrasesList, currentSheetIndex);
        onProgrammaticRawFrames?.(raw, currentSheetIndex);
        const frames = await maybeOverlay(raw, phraseSlice);
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
    maybeOverlay,
    setPhrasesList,
    programmaticTextTuning,
    onProgrammaticRawFrames,
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
