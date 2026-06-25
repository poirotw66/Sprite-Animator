/**
 * Derive the "active sheet" view state for LineStickerPage. In set mode the
 * values come from the per-sheet arrays at currentSheetIndex; in single mode
 * they come from the shared useSpriteSheetFlow instance. Extracted from the page
 * so the component holds wiring, not this branchy adapter logic.
 *
 * Plain function (no React hooks): it only reads inputs and returns derived
 * values + setter wrappers, recreated each render exactly as the inline code did.
 */

import type { Dispatch, SetStateAction } from 'react';
import { FrameOverride, SliceSettings } from './imageUtils';
import type { useSpriteSheetFlow } from '../hooks/useSpriteSheetFlow';
import {
  createLineStickerSetSliceSettings,
  LINE_STICKER_SET_COLS,
  LINE_STICKER_SET_ROWS,
  type LineStickerSheetIndex,
} from './lineStickerSetSchema';

type SingleSheetFlow = ReturnType<typeof useSpriteSheetFlow>;

interface ActiveSheetStateArgs {
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  singleSheetFlow: SingleSheetFlow;
  sheetImages: (string | null)[];
  processedSheetImages: (string | null)[];
  sheetFrames: string[][];
  selectedFramesBySheet: boolean[][];
  setSelectedFramesBySheet: Dispatch<SetStateAction<boolean[][]>>;
  sheetFrameOverrides: FrameOverride[][];
  setSheetFrameOverrides: Dispatch<SetStateAction<FrameOverride[][]>>;
  sheetDimensions: { width: number; height: number };
  chromaKeyProgress: number;
  isProcessingChromaKey: boolean;
  currentSetSliceSettings: SliceSettings;
  sheetSliceSettings: SliceSettings[];
  setSheetSliceSettings: Dispatch<SetStateAction<SliceSettings[]>>;
}

export function deriveLineStickerActiveSheetState({
  stickerSetMode,
  currentSheetIndex,
  singleSheetFlow,
  sheetImages,
  processedSheetImages,
  sheetFrames,
  selectedFramesBySheet,
  setSelectedFramesBySheet,
  sheetFrameOverrides,
  setSheetFrameOverrides,
  sheetDimensions,
  chromaKeyProgress,
  isProcessingChromaKey,
  currentSetSliceSettings,
  sheetSliceSettings,
  setSheetSliceSettings,
}: ActiveSheetStateArgs) {
  const effectiveSpriteSheetImage = stickerSetMode ? (sheetImages[currentSheetIndex] ?? null) : singleSheetFlow.image;
  const effectiveProcessedSpriteSheet = stickerSetMode ? (processedSheetImages[currentSheetIndex] ?? null) : singleSheetFlow.processedImage;
  const effectiveStickerFrames = stickerSetMode ? sheetFrames[currentSheetIndex] ?? [] : singleSheetFlow.frames;
  const effectiveSelectedFrames = stickerSetMode ? (selectedFramesBySheet[currentSheetIndex] ?? []) : singleSheetFlow.frameIncluded;
  const effectiveSetSelectedFrames = stickerSetMode
    ? (val: boolean[] | ((prev: boolean[]) => boolean[])) => {
        setSelectedFramesBySheet((prev) => {
          const next = prev.map((a) => [...a]);
          const s = typeof val === 'function' ? val(next[currentSheetIndex] ?? []) : val;
          next[currentSheetIndex] = s;
          return next;
        });
      }
    : singleSheetFlow.setFrameIncluded;
  const effectiveFrameOverrides = stickerSetMode ? (sheetFrameOverrides[currentSheetIndex] ?? []) : singleSheetFlow.frameOverrides;
  const effectiveSetFrameOverrides = stickerSetMode
    ? (val: FrameOverride[] | ((prev: FrameOverride[]) => FrameOverride[])) => {
        setSheetFrameOverrides((prev) => {
          const next = prev.map((a) => [...a]);
          const s = typeof val === 'function' ? val(next[currentSheetIndex] ?? []) : val;
          next[currentSheetIndex] = s;
          return next;
        });
      }
    : singleSheetFlow.setFrameOverrides;
  const effectiveSheetDimensions = stickerSetMode ? sheetDimensions : singleSheetFlow.sheetDimensions;
  const effectiveChromaKeyProgress = stickerSetMode ? chromaKeyProgress : singleSheetFlow.chromaKeyProgress;
  const effectiveIsProcessingChromaKey = stickerSetMode ? isProcessingChromaKey : singleSheetFlow.isProcessingChromaKey;
  const effectiveSliceSettingsForView = stickerSetMode ? currentSetSliceSettings : singleSheetFlow.sliceSettings;
  const effectiveSetSliceSettingsForView = stickerSetMode
    ? (val: SliceSettings | ((prev: SliceSettings) => SliceSettings)) => {
        const currentSettings = sheetSliceSettings[currentSheetIndex] ?? createLineStickerSetSliceSettings();
        if (typeof val === 'function') {
          const next = val(currentSettings);
          setSheetSliceSettings((prev) => {
            const updated = prev.map((entry) => ({ ...entry }));
            updated[currentSheetIndex] = {
              ...next,
              cols: LINE_STICKER_SET_COLS,
              rows: LINE_STICKER_SET_ROWS,
            };
            return updated;
          });
        } else {
          setSheetSliceSettings((prev) => {
            const updated = prev.map((entry) => ({ ...entry }));
            updated[currentSheetIndex] = {
              ...val,
              cols: LINE_STICKER_SET_COLS,
              rows: LINE_STICKER_SET_ROWS,
            };
            return updated;
          });
        }
      }
    : singleSheetFlow.setSliceSettings;

  return {
    effectiveSpriteSheetImage,
    effectiveProcessedSpriteSheet,
    effectiveStickerFrames,
    effectiveSelectedFrames,
    effectiveSetSelectedFrames,
    effectiveFrameOverrides,
    effectiveSetFrameOverrides,
    effectiveSheetDimensions,
    effectiveChromaKeyProgress,
    effectiveIsProcessingChromaKey,
    effectiveSliceSettingsForView,
    effectiveSetSliceSettingsForView,
  };
}
