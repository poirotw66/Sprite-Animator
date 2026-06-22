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
import {
  collectSheetsNeedingFullRes,
  collectSheetsWithRaw,
  digestOverlayStyle,
  digestPhrasesForSheet,
  planOverlayComposeSheets,
} from '../utils/lineStickerProgrammaticOverlaySchedule';

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

function createEmptyOverlaySheetArray<T>(fill: T): T[] {
  return Array.from({ length: LINE_STICKER_SHEET_COUNT }, () => fill);
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
  const overlayDirtySheetsRef = useRef(new Set<LineStickerSheetIndex>());
  const overlayFullResPendingRef = useRef(new Set<LineStickerSheetIndex>());
  const overlayFullResSheetsRef = useRef(new Set<LineStickerSheetIndex>());
  const appliedStyleDigestBySheetRef = useRef<(string | null)[]>(createEmptyOverlaySheetArray(null));
  const appliedPhraseDigestBySheetRef = useRef<(string | null)[]>(createEmptyOverlaySheetArray(null));
  const [overlayComposeTrigger, setOverlayComposeTrigger] = useState(0);

  const bumpOverlayCompose = useCallback(() => {
    setOverlayComposeTrigger((value) => value + 1);
  }, []);

  const markOverlaySheetDirty = useCallback(
    (sheetIndex: LineStickerSheetIndex, options?: { fullRes?: boolean }) => {
      overlayDirtySheetsRef.current.add(sheetIndex);
      if (options?.fullRes) {
        overlayFullResPendingRef.current.add(sheetIndex);
      }
      bumpOverlayCompose();
    },
    [bumpOverlayCompose]
  );

  const resetOverlayState = useCallback(() => {
    programmaticRawFramesRef.current = [];
    programmaticRawBySheetRef.current = Array.from(
      { length: LINE_STICKER_SHEET_COUNT },
      () => null
    );
    overlayDirtySheetsRef.current.clear();
    overlayFullResPendingRef.current.clear();
    overlayFullResSheetsRef.current.clear();
    appliedStyleDigestBySheetRef.current = createEmptyOverlaySheetArray(null);
    appliedPhraseDigestBySheetRef.current = createEmptyOverlaySheetArray(null);
    bumpOverlayCompose();
  }, [bumpOverlayCompose]);

  const captureProgrammaticRawFramesFromMap = useCallback(
    (raw: string[], bumpEpoch: boolean) => {
      programmaticRawFramesRef.current = raw;
      programmaticRawBySheetRef.current[DEFAULT_LINE_STICKER_SHEET_INDEX] = raw;
      if (bumpEpoch) {
        markOverlaySheetDirty(DEFAULT_LINE_STICKER_SHEET_INDEX, { fullRes: true });
      }
    },
    [markOverlaySheetDirty]
  );

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
      programmaticRawBySheetRef.current[sheetIndex] = raw;
      if (!stickerSetMode || sheetIndex === currentSheetIndex) {
        programmaticRawFramesRef.current = raw;
      }
      markOverlaySheetDirty(sheetIndex, {
        fullRes: !stickerSetMode || sheetIndex === currentSheetIndex,
      });
    },
    [stickerSetMode, currentSheetIndex, markOverlaySheetDirty]
  );

  useEffect(() => {
    if (!stickerSetMode) {
      return;
    }
    const cached = programmaticRawBySheetRef.current[currentSheetIndex];
    if (!cached || cached.length === 0) {
      return;
    }
    programmaticRawFramesRef.current = cached;
    const styleDigest = appliedStyleDigestBySheetRef.current[currentSheetIndex];
    const phraseDigest = appliedPhraseDigestBySheetRef.current[currentSheetIndex];
    const needsFullRes = !overlayFullResSheetsRef.current.has(currentSheetIndex);
    if (styleDigest == null || phraseDigest == null || needsFullRes) {
      markOverlaySheetDirty(currentSheetIndex, { fullRes: true });
    }
  }, [stickerSetMode, currentSheetIndex, markOverlaySheetDirty]);

  return {
    mapFramesAfterSlice,
    onProgrammaticRawFrames,
    overlayComposeTrigger,
    programmaticRawFramesRef,
    programmaticRawBySheetRef,
    overlayDirtySheetsRef,
    overlayFullResPendingRef,
    overlayFullResSheetsRef,
    appliedStyleDigestBySheetRef,
    appliedPhraseDigestBySheetRef,
    markOverlaySheetDirty,
    resetOverlayState,
    bumpOverlayCompose,
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

export interface LineStickerProgrammaticOverlayComposeResult {
  ensureProgrammaticOverlayFullRes: (baseSheetFrames: string[][]) => Promise<string[][]>;
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
): LineStickerProgrammaticOverlayComposeResult {
  const {
    overlayComposeTrigger,
    programmaticRawFramesRef,
    programmaticRawBySheetRef,
    overlayDirtySheetsRef,
    overlayFullResPendingRef,
    overlayFullResSheetsRef,
    appliedStyleDigestBySheetRef,
    appliedPhraseDigestBySheetRef,
    markOverlaySheetDirty,
    bumpOverlayCompose,
  } = core;

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
  const styleDigest = useMemo(
    () => digestOverlayStyle(debouncedOverlayStyle),
    [debouncedOverlayStyle]
  );

  const phraseDigestBySheet = useMemo(
    () =>
      LINE_STICKER_SHEET_INDICES.map((sheetIndex) =>
        digestPhrasesForSheet(phrasesForHook, sheetIndex)
      ),
    [phrasesForHook]
  );

  useEffect(() => {
    if (textRendering !== 'programmatic' || !includeText || !stickerSetMode) {
      return;
    }

    LINE_STICKER_SHEET_INDICES.forEach((sheetIndex) => {
      const raw = programmaticRawBySheetRef.current[sheetIndex];
      if (!raw || raw.length === 0) {
        return;
      }
      if (appliedPhraseDigestBySheetRef.current[sheetIndex] === phraseDigestBySheet[sheetIndex]) {
        return;
      }
      markOverlaySheetDirty(sheetIndex, { fullRes: sheetIndex === currentSheetIndex });
    });
  }, [
    textRendering,
    includeText,
    stickerSetMode,
    phraseDigestBySheet,
    currentSheetIndex,
    markOverlaySheetDirty,
    programmaticRawBySheetRef,
    appliedPhraseDigestBySheetRef,
  ]);

  useEffect(() => {
    if (textRendering !== 'programmatic' || !includeText || !stickerSetMode) {
      return;
    }

    const raw = programmaticRawBySheetRef.current[currentSheetIndex];
    if (!raw || raw.length === 0) {
      return;
    }

    if (appliedStyleDigestBySheetRef.current[currentSheetIndex] === styleDigest) {
      return;
    }

    markOverlaySheetDirty(currentSheetIndex, { fullRes: true });
    LINE_STICKER_SHEET_INDICES.forEach((sheetIndex) => {
      if (sheetIndex === currentSheetIndex) {
        return;
      }
      if (!programmaticRawBySheetRef.current[sheetIndex]?.length) {
        return;
      }
      appliedStyleDigestBySheetRef.current[sheetIndex] = null;
      appliedPhraseDigestBySheetRef.current[sheetIndex] = null;
      overlayFullResSheetsRef.current.delete(sheetIndex);
    });
  }, [
    textRendering,
    includeText,
    stickerSetMode,
    styleDigest,
    currentSheetIndex,
    markOverlaySheetDirty,
    programmaticRawBySheetRef,
    appliedStyleDigestBySheetRef,
    appliedPhraseDigestBySheetRef,
    overlayFullResSheetsRef,
  ]);

  const composeSheets = useCallback(
    async (
      plan: ReturnType<typeof planOverlayComposeSheets>,
      options?: { cancelled?: () => boolean }
    ): Promise<Map<LineStickerSheetIndex, string[]>> => {
      const live = overlayLiveStyleRef.current;
      const overlayOptsBase = {
        fontKey: live.selectedFont,
        colorKey: live.selectedTextColor,
        tuning: live.programmaticTextTuning,
      };
      const activeStyleDigest = digestOverlayStyle(live);
      const composedBySheet = new Map<LineStickerSheetIndex, string[]>();

      for (let index = 0; index < plan.length; index += 1) {
        if (options?.cancelled?.()) {
          return composedBySheet;
        }

        const { sheetIndex, useFullRes } = plan[index]!;
        const rawSheet = programmaticRawBySheetRef.current[sheetIndex];
        if (!rawSheet || rawSheet.length === 0) {
          overlayDirtySheetsRef.current.delete(sheetIndex);
          overlayFullResPendingRef.current.delete(sheetIndex);
          continue;
        }

        const phrasesSheet = sliceLineStickerSheetFrames(phrasesForHook, sheetIndex);
        const compositedSheet = await overlayPhrasesOnStickerFrames(rawSheet, phrasesSheet, {
          ...overlayOptsBase,
          previewMaxLongestSide: useFullRes ? undefined : SET_MODE_NON_CURRENT_PREVIEW_MAX_SIDE,
        });

        if (options?.cancelled?.()) {
          return composedBySheet;
        }

        composedBySheet.set(sheetIndex, compositedSheet);
        setSheetFrames((prev) => {
          const next = [...prev];
          next[sheetIndex] = compositedSheet;
          return next;
        });
        if (sheetIndex === currentSheetIndex) {
          setStickerFrames(compositedSheet);
        }

        appliedStyleDigestBySheetRef.current[sheetIndex] = activeStyleDigest;
        appliedPhraseDigestBySheetRef.current[sheetIndex] = phraseDigestBySheet[sheetIndex] ?? '';
        overlayDirtySheetsRef.current.delete(sheetIndex);
        overlayFullResPendingRef.current.delete(sheetIndex);
        if (useFullRes) {
          overlayFullResSheetsRef.current.add(sheetIndex);
        } else {
          overlayFullResSheetsRef.current.delete(sheetIndex);
        }

        if (index < plan.length - 1) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 0);
          });
        }
      }

      return composedBySheet;
    },
    [
      appliedPhraseDigestBySheetRef,
      appliedStyleDigestBySheetRef,
      currentSheetIndex,
      overlayDirtySheetsRef,
      overlayFullResPendingRef,
      overlayFullResSheetsRef,
      phraseDigestBySheet,
      phrasesForHook,
      programmaticRawBySheetRef,
      setSheetFrames,
      setStickerFrames,
    ]
  );

  const ensureProgrammaticOverlayFullRes = useCallback(
    async (baseSheetFrames: string[][]): Promise<string[][]> => {
      if (textRendering !== 'programmatic' || !includeText || !stickerSetMode) {
        return baseSheetFrames;
      }

      const sheetsWithRaw = collectSheetsWithRaw(programmaticRawBySheetRef.current);
      const pendingFullRes = collectSheetsNeedingFullRes({
        sheetsWithRaw,
        fullResSheets: overlayFullResSheetsRef.current,
      });
      if (pendingFullRes.length === 0) {
        return baseSheetFrames;
      }

      pendingFullRes.forEach((sheetIndex) => {
        overlayDirtySheetsRef.current.add(sheetIndex);
        overlayFullResPendingRef.current.add(sheetIndex);
      });

      const plan = planOverlayComposeSheets({
        dirtySheets: overlayDirtySheetsRef.current,
        fullResPendingSheets: overlayFullResPendingRef.current,
        currentSheetIndex,
        sheetsWithRaw,
      });
      const composedBySheet = await composeSheets(plan);
      bumpOverlayCompose();

      if (composedBySheet.size === 0) {
        return baseSheetFrames;
      }

      return baseSheetFrames.map((frames, sheetIndex) => {
        const upgraded = composedBySheet.get(sheetIndex as LineStickerSheetIndex);
        return upgraded ?? frames;
      });
    },
    [
    textRendering,
    includeText,
    stickerSetMode,
    programmaticRawBySheetRef,
    overlayFullResSheetsRef,
    overlayDirtySheetsRef,
    overlayFullResPendingRef,
    currentSheetIndex,
    composeSheets,
    bumpOverlayCompose,
  ]);

  useEffect(() => {
    if (textRendering !== 'programmatic' || !includeText) {
      return;
    }
    let cancelled = false;

    const run = async () => {
      if (!stickerSetMode) {
        const rawSingle = programmaticRawFramesRef.current;
        if (rawSingle.length === 0) {
          return;
        }
        const phrasesSingle = phrasesForHook.slice(0, rawSingle.length);
        const live = overlayLiveStyleRef.current;
        const compositedSingle = await overlayPhrasesOnStickerFrames(rawSingle, phrasesSingle, {
          fontKey: live.selectedFont,
          colorKey: live.selectedTextColor,
          tuning: live.programmaticTextTuning,
        });
        if (cancelled) {
          return;
        }
        singleSheetSetFrames(compositedSingle);
        return;
      }

      if (overlayDirtySheetsRef.current.size === 0) {
        return;
      }

      const sheetsWithRaw = collectSheetsWithRaw(programmaticRawBySheetRef.current);
      const plan = planOverlayComposeSheets({
        dirtySheets: overlayDirtySheetsRef.current,
        fullResPendingSheets: overlayFullResPendingRef.current,
        currentSheetIndex,
        sheetsWithRaw,
      });
      if (plan.length === 0) {
        return;
      }

      await composeSheets(plan, { cancelled: () => cancelled });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    textRendering,
    includeText,
    overlayComposeTrigger,
    stickerSetMode,
    currentSheetIndex,
    styleDigest,
    phraseDigestBySheet,
    singleSheetSetFrames,
    composeSheets,
    phrasesForHook,
    programmaticRawFramesRef,
    overlayDirtySheetsRef,
    overlayFullResPendingRef,
    programmaticRawBySheetRef,
  ]);

  return { ensureProgrammaticOverlayFullRes };
}
