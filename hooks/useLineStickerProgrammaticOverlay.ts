import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { FONT_PRESETS, TEXT_COLOR_PRESETS, type LineStickerTextRendering } from '../utils/lineStickerPrompt';
import {
  DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
  overlayPhrasesOnStickerFrames,
  type ProgrammaticTextOverlayTuning,
} from '../utils/lineStickerTextOverlay';
import {
  DEFAULT_LINE_STICKER_SHEET_INDEX,
  LINE_STICKER_SHEET_COUNT,
  LINE_STICKER_SHEET_INDICES,
  sliceLineStickerSheetFrames,
  type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';

const OVERLAY_STYLE_DEBOUNCE_MS = 110;
const SET_MODE_NON_CURRENT_PREVIEW_MAX_SIDE = 400;

type FontKey = keyof typeof FONT_PRESETS;
type ColorKey = keyof typeof TEXT_COLOR_PRESETS;

export interface LineStickerProgrammaticOverlayStyle {
  selectedFont: FontKey;
  selectedTextColor: ColorKey;
  programmaticTextTuning: ProgrammaticTextOverlayTuning;
}

export interface UseLineStickerProgrammaticOverlayCoreParams {
  textRendering: LineStickerTextRendering;
  includeText: boolean;
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
}

/**
 * Runs before `useSpriteSheetFlow`: captures raw sliced frames for programmatic text.
 */
export function useLineStickerProgrammaticOverlayCore({
  textRendering,
  includeText,
  stickerSetMode,
  currentSheetIndex,
}: UseLineStickerProgrammaticOverlayCoreParams) {
  const programmaticRawFramesRef = useRef<string[]>([]);
  const programmaticRawBySheetRef = useRef<(string[] | null)[]>(
    Array.from({ length: LINE_STICKER_SHEET_COUNT }, () => null)
  );
  const [programmaticRawFrameEpoch, setProgrammaticRawFrameEpoch] = useState(0);

  const captureProgrammaticRawFramesFromMap = useCallback((raw: string[], bumpEpoch: boolean) => {
    programmaticRawFramesRef.current = raw.slice();
    programmaticRawBySheetRef.current[DEFAULT_LINE_STICKER_SHEET_INDEX] = raw.slice();
    if (bumpEpoch) {
      setProgrammaticRawFrameEpoch((n) => n + 1);
    }
  }, []);

  const mapFramesAfterSlice = useCallback(
    async (frames: string[]) => {
      const bumpEpoch = textRendering === 'programmatic' && includeText;
      captureProgrammaticRawFramesFromMap(frames, bumpEpoch);
      return frames;
    },
    [textRendering, includeText, captureProgrammaticRawFramesFromMap]
  );

  const onProgrammaticRawFrames = useCallback(
    (raw: string[], sheetIndex: LineStickerSheetIndex) => {
      programmaticRawBySheetRef.current[sheetIndex] = raw.slice();
      if (!stickerSetMode || sheetIndex === currentSheetIndex) {
        programmaticRawFramesRef.current = raw.slice();
        setProgrammaticRawFrameEpoch((n) => n + 1);
      }
    },
    [stickerSetMode, currentSheetIndex]
  );

  useEffect(() => {
    if (!stickerSetMode) {
      return;
    }
    const cached = programmaticRawBySheetRef.current[currentSheetIndex];
    if (cached && cached.length > 0) {
      programmaticRawFramesRef.current = cached;
      setProgrammaticRawFrameEpoch((n) => n + 1);
    }
  }, [stickerSetMode, currentSheetIndex]);

  return {
    mapFramesAfterSlice,
    onProgrammaticRawFrames,
    programmaticRawFrameEpoch,
    programmaticRawFramesRef,
    programmaticRawBySheetRef,
  };
}

export type LineStickerProgrammaticOverlayCore = ReturnType<typeof useLineStickerProgrammaticOverlayCore>;

function useDebouncedStyle(style: LineStickerProgrammaticOverlayStyle, delayMs: number) {
  const [debounced, setDebounced] = useState(style);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(style), delayMs);
    return () => window.clearTimeout(id);
  }, [style, delayMs]);
  return debounced;
}

export interface UseLineStickerProgrammaticOverlayComposeParams {
  textRendering: LineStickerTextRendering;
  includeText: boolean;
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  phrasesForHook: string[];
  selectedFont: FontKey;
  selectedTextColor: ColorKey;
  programmaticTextTuning: ProgrammaticTextOverlayTuning;
  singleSheetSetFrames: (frames: string[]) => void;
  setSheetFrames: Dispatch<SetStateAction<string[][]>>;
  setStickerFrames: Dispatch<SetStateAction<string[]>>;
}

/**
 * Runs after phrase grid + `useSpriteSheetFlow`: debounced compositing and set-mode scheduling.
 */
export function useLineStickerProgrammaticOverlayCompose(
  core: LineStickerProgrammaticOverlayCore,
  {
    textRendering,
    includeText,
    stickerSetMode,
    currentSheetIndex,
    phrasesForHook,
    selectedFont,
    selectedTextColor,
    programmaticTextTuning,
    singleSheetSetFrames,
    setSheetFrames,
    setStickerFrames,
  }: UseLineStickerProgrammaticOverlayComposeParams
) {
  const { programmaticRawFrameEpoch, programmaticRawFramesRef, programmaticRawBySheetRef } = core;

  const overlayLiveStyleRef = useRef<LineStickerProgrammaticOverlayStyle>({
    selectedFont,
    selectedTextColor,
    programmaticTextTuning: { ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING },
  });

  useLayoutEffect(() => {
    overlayLiveStyleRef.current = {
      selectedFont,
      selectedTextColor,
      programmaticTextTuning,
    };
  }, [selectedFont, selectedTextColor, programmaticTextTuning]);

  const styleSnapshot = useMemo<LineStickerProgrammaticOverlayStyle>(
    () => ({
      selectedFont,
      selectedTextColor,
      programmaticTextTuning,
    }),
    [selectedFont, selectedTextColor, programmaticTextTuning]
  );
  const debouncedOverlayStyle = useDebouncedStyle(styleSnapshot, OVERLAY_STYLE_DEBOUNCE_MS);

  const phraseDigest = useMemo(() => phrasesForHook.join('\u0001'), [phrasesForHook]);

  useEffect(() => {
    if (textRendering !== 'programmatic' || !includeText) {
      return;
    }
    let cancelled = false;

    const yieldToMain = () =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });

    const run = async () => {
      const live = overlayLiveStyleRef.current;
      const overlayOptsBase = {
        fontKey: live.selectedFont,
        colorKey: live.selectedTextColor,
        tuning: live.programmaticTextTuning,
      };

      if (!stickerSetMode) {
        const rawSingle = programmaticRawFramesRef.current;
        if (rawSingle.length === 0) {
          return;
        }
        const phrasesSingle = phrasesForHook.slice(0, rawSingle.length);
        const compositedSingle = await overlayPhrasesOnStickerFrames(
          rawSingle,
          phrasesSingle,
          overlayOptsBase
        );
        if (cancelled) {
          return;
        }
        singleSheetSetFrames(compositedSingle);
        return;
      }

      const sheetIndicesWithRaw = LINE_STICKER_SHEET_INDICES.filter((idx) => {
        const rawSheet = programmaticRawBySheetRef.current[idx];
        return rawSheet && rawSheet.length > 0;
      });
      if (sheetIndicesWithRaw.length === 0) {
        return;
      }

      const orderedSheets: LineStickerSheetIndex[] = [
        ...(sheetIndicesWithRaw.includes(currentSheetIndex) ? [currentSheetIndex] : []),
        ...sheetIndicesWithRaw.filter((i) => i !== currentSheetIndex),
      ];

      const usedPreviewDownscale = new Set<LineStickerSheetIndex>();

      for (let i = 0; i < orderedSheets.length; i += 1) {
        if (cancelled) {
          return;
        }
        const sheetIdx = orderedSheets[i]!;
        const rawSheet = programmaticRawBySheetRef.current[sheetIdx];
        if (!rawSheet || rawSheet.length === 0) {
          continue;
        }
        const phrasesSheet = sliceLineStickerSheetFrames(phrasesForHook, sheetIdx);
        const isCurrent = sheetIdx === currentSheetIndex;
        const usePreview =
          orderedSheets.length > 1 && !isCurrent ? SET_MODE_NON_CURRENT_PREVIEW_MAX_SIDE : undefined;
        if (usePreview != null) {
          usedPreviewDownscale.add(sheetIdx);
        }
        const compositedSheet = await overlayPhrasesOnStickerFrames(rawSheet, phrasesSheet, {
          ...overlayOptsBase,
          previewMaxLongestSide: usePreview,
        });
        if (cancelled) {
          return;
        }
        setSheetFrames((prev) => {
          const next = [...prev];
          next[sheetIdx] = compositedSheet;
          return next;
        });
        if (isCurrent) {
          setStickerFrames(compositedSheet);
        }
        if (i < orderedSheets.length - 1) {
          await yieldToMain();
        }
      }

      if (usedPreviewDownscale.size === 0 || cancelled) {
        return;
      }

      for (const sheetIdx of orderedSheets) {
        if (cancelled || !usedPreviewDownscale.has(sheetIdx)) {
          continue;
        }
        const rawSheet = programmaticRawBySheetRef.current[sheetIdx];
        if (!rawSheet || rawSheet.length === 0) {
          continue;
        }
        const phrasesSheet = sliceLineStickerSheetFrames(phrasesForHook, sheetIdx);
        const compositedFull = await overlayPhrasesOnStickerFrames(rawSheet, phrasesSheet, {
          ...overlayOptsBase,
        });
        if (cancelled) {
          return;
        }
        setSheetFrames((prev) => {
          const next = [...prev];
          next[sheetIdx] = compositedFull;
          return next;
        });
        if (sheetIdx === currentSheetIndex) {
          setStickerFrames(compositedFull);
        }
        await yieldToMain();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    textRendering,
    includeText,
    programmaticRawFrameEpoch,
    stickerSetMode,
    currentSheetIndex,
    phraseDigest,
    debouncedOverlayStyle,
    singleSheetSetFrames,
    setSheetFrames,
    setStickerFrames,
    phrasesForHook,
    programmaticRawFramesRef,
    programmaticRawBySheetRef,
  ]);
}
