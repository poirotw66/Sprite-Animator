import type { LineStickerPhraseSetJson } from './lineStickerPhraseSetFormat';

export type LineStickerPhraseSetImportPlan =
  | {
      mode: 'single';
      gridCols: number;
      gridRows: number;
      phrases: string[];
      actionDescs: string[];
    }
  | {
      mode: 'set';
      phrases: string[];
      actionDescs: string[];
    };

/**
 * Converts a validated phrase-set file into the state updates required by the UI.
 * Parsing remains the responsibility of `parsePhraseSetJson`; this only supplies
 * the default empty action descriptions and preserves the two import modes.
 */
export function planLineStickerPhraseSetImport(
  phraseSet: LineStickerPhraseSetJson
): LineStickerPhraseSetImportPlan {
  const actionDescs = phraseSet.actionDescs ?? phraseSet.phrases.map(() => '');

  if (phraseSet.mode === 'single') {
    if (phraseSet.gridCols == null || phraseSet.gridRows == null) {
      throw new Error('Single-sheet phrase sets require grid dimensions.');
    }

    return {
      mode: 'single',
      gridCols: phraseSet.gridCols,
      gridRows: phraseSet.gridRows,
      phrases: phraseSet.phrases,
      actionDescs,
    };
  }

  return {
    mode: 'set',
    phrases: phraseSet.phrases,
    actionDescs,
  };
}
