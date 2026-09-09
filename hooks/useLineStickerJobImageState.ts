import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  applyFramesListToJobImageState,
  applyGeneratedListToJobImageState,
  applyProcessedListToJobImageState,
  createLineStickerJobImageState,
  flattenJobImageFrames,
  flattenJobImageGenerated,
  flattenJobImageProcessed,
  jobImageStateFromJobSheets,
  type LineStickerJobImageState,
} from '../features/line-sticker/domain/lineStickerJobImageState';
import type { LineStickerJobSheet } from '../features/line-sticker/domain/lineStickerJob';

function resolveNext<T>(value: SetStateAction<T>, previous: T): T {
  return typeof value === 'function' ? (value as (prev: T) => T)(previous) : value;
}

/** Owns set-mode sheet images as per-sheet job fields; flat arrays are projections. */
export function useLineStickerJobImageState() {
  const [imageState, setImageState] = useState<LineStickerJobImageState>(() => createLineStickerJobImageState());

  const sheetImages = useMemo(() => flattenJobImageGenerated(imageState), [imageState]);
  const processedSheetImages = useMemo(() => flattenJobImageProcessed(imageState), [imageState]);
  const sheetFrames = useMemo(() => flattenJobImageFrames(imageState), [imageState]);

  const setSheetImages = useCallback<Dispatch<SetStateAction<(string | null)[]>>>((value) => {
    setImageState((previous) => {
      const flat = flattenJobImageGenerated(previous);
      return applyGeneratedListToJobImageState(previous, resolveNext(value, flat));
    });
  }, []);

  const setProcessedSheetImages = useCallback<Dispatch<SetStateAction<(string | null)[]>>>((value) => {
    setImageState((previous) => {
      const flat = flattenJobImageProcessed(previous);
      return applyProcessedListToJobImageState(previous, resolveNext(value, flat));
    });
  }, []);

  const setSheetFrames = useCallback<Dispatch<SetStateAction<string[][]>>>((value) => {
    setImageState((previous) => {
      const flat = flattenJobImageFrames(previous);
      return applyFramesListToJobImageState(previous, resolveNext(value, flat));
    });
  }, []);

  const replaceImagesFromJobSheets = useCallback((
    sheets: readonly LineStickerJobSheet[],
    resolved: {
      generated: readonly (string | null)[];
      processed: readonly (string | null)[];
      frames: readonly (readonly string[])[];
    },
  ) => {
    setImageState(jobImageStateFromJobSheets(sheets, resolved));
  }, []);

  const resetJobImages = useCallback(() => {
    setImageState(createLineStickerJobImageState());
  }, []);

  return {
    jobImageState: imageState,
    sheetImages,
    setSheetImages,
    processedSheetImages,
    setProcessedSheetImages,
    sheetFrames,
    setSheetFrames,
    replaceImagesFromJobSheets,
    resetJobImages,
  };
}
