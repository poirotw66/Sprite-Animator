import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  applyFlatValuesToJobTextState,
  createLineStickerJobTextState,
  flattenJobTextValues,
  jobTextStateFromJobSheets,
  type LineStickerJobTextState,
} from '../features/line-sticker/domain/lineStickerJobText';
import type { LineStickerJobSheet } from '../features/line-sticker/domain/lineStickerJob';

function resolveNext<T>(value: SetStateAction<T>, previous: T): T {
  return typeof value === 'function' ? (value as (prev: T) => T)(previous) : value;
}

/** Owns set-mode phrase/action text as per-sheet job fields; flat lists are projections. */
export function useLineStickerJobTextState() {
  const [textState, setTextState] = useState<LineStickerJobTextState>(() => createLineStickerJobTextState());

  const setPhrasesList = useMemo(
    () => flattenJobTextValues(textState, 'phrases'),
    [textState],
  );
  const actionDescsList = useMemo(
    () => flattenJobTextValues(textState, 'actionDescriptions'),
    [textState],
  );

  const setSetPhrasesList = useCallback<Dispatch<SetStateAction<string[]>>>((value) => {
    setTextState((previous) => {
      const flat = flattenJobTextValues(previous, 'phrases');
      return applyFlatValuesToJobTextState(previous, 'phrases', resolveNext(value, flat));
    });
  }, []);

  const setActionDescsList = useCallback<Dispatch<SetStateAction<string[]>>>((value) => {
    setTextState((previous) => {
      const flat = flattenJobTextValues(previous, 'actionDescriptions');
      return applyFlatValuesToJobTextState(previous, 'actionDescriptions', resolveNext(value, flat));
    });
  }, []);

  const replaceFromJobSheets = useCallback((sheets: readonly LineStickerJobSheet[]) => {
    setTextState(jobTextStateFromJobSheets(sheets));
  }, []);

  const resetJobText = useCallback(() => {
    setTextState(createLineStickerJobTextState());
  }, []);

  return {
    jobTextState: textState,
    setPhrasesList,
    setSetPhrasesList,
    actionDescsList,
    setActionDescsList,
    replaceFromJobSheets,
    resetJobText,
  };
}
