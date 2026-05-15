import { useCallback, useMemo, useState } from 'react';
import { FONT_PRESETS, TEXT_COLOR_PRESETS } from '../utils/lineStickerPrompt';
import type { ProgrammaticTextOverlayTuning } from '../utils/lineStickerTextOverlay';
import {
  DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
  overlayPhrasesOnStickerFrames,
} from '../utils/lineStickerTextOverlay';

export type SheetSliceOverlayFontKey = keyof typeof FONT_PRESETS;
export type SheetSliceOverlayColorKey = keyof typeof TEXT_COLOR_PRESETS;

function buildPhrasesFromMultiline(text: string, frameCount: number): string[] {
  const lines = text.split(/\r?\n/);
  const phrases: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    phrases.push((lines[i] ?? '').trim());
  }
  return phrases;
}

/**
 * Browser-side text overlay after grid slicing (Parting tool + Sprite Animator sheet mode).
 * Pairs with `useSpriteSheetFlow` / `useSpriteSheet` via `mapFramesAfterSlice` + `slicePipelineRevision`.
 */
export function useSheetSliceProgrammaticOverlay() {
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [overlayLinesText, setOverlayLinesText] = useState('');
  const [overlayFontKey, setOverlayFontKey] = useState<SheetSliceOverlayFontKey>('handwritten');
  const [overlayColorKey, setOverlayColorKey] = useState<SheetSliceOverlayColorKey>('black');
  const [overlayTuning, setOverlayTuning] = useState<ProgrammaticTextOverlayTuning>(() => ({
    ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
  }));

  const mapFramesAfterSlice = useCallback(
    async (frames: string[]) => {
      if (!overlayEnabled) {
        return frames;
      }
      const phrases = buildPhrasesFromMultiline(overlayLinesText, frames.length);
      if (!phrases.some((p) => p.length > 0)) {
        return frames;
      }
      return overlayPhrasesOnStickerFrames(frames, phrases, {
        fontKey: overlayFontKey,
        colorKey: overlayColorKey,
        tuning: overlayTuning,
      });
    },
    [overlayEnabled, overlayLinesText, overlayFontKey, overlayColorKey, overlayTuning]
  );

  const slicePipelineRevision = useMemo(
    () =>
      JSON.stringify({
        overlayEnabled,
        overlayLinesText,
        overlayFontKey,
        overlayColorKey,
        overlayTuning,
      }),
    [overlayEnabled, overlayLinesText, overlayFontKey, overlayColorKey, overlayTuning]
  );

  const useFrameImageForSingleCanvas = useMemo(() => {
    if (!overlayEnabled) {
      return false;
    }
    return overlayLinesText.split(/\r?\n/).some((line) => line.trim().length > 0);
  }, [overlayEnabled, overlayLinesText]);

  return {
    overlayEnabled,
    setOverlayEnabled,
    overlayLinesText,
    setOverlayLinesText,
    overlayFontKey,
    setOverlayFontKey,
    overlayColorKey,
    setOverlayColorKey,
    overlayTuning,
    setOverlayTuning,
    mapFramesAfterSlice,
    slicePipelineRevision,
    useFrameImageForSingleCanvas,
  };
}
