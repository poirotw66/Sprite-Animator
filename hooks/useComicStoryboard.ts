import { useCallback, useState } from 'react';
import { API_KEY_MISSING_MESSAGE, generateComicStoryboard } from '../services/geminiService';
import { getErrorMessage } from '../types/errors';
import type { ComicPanel } from '../utils/comicPanelSchema';

export function useComicStoryboard(openSettings: () => void) {
  const [isFilling, setIsFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillFromSynopsis = useCallback(
    async (params: {
      apiKey: string;
      characterConcept: string;
      synopsis: string;
    }): Promise<ComicPanel[]> => {
      if (!params.apiKey) {
        openSettings();
        throw new Error(API_KEY_MISSING_MESSAGE);
      }
      if (!params.synopsis.trim()) {
        throw new Error('Synopsis required');
      }

      setIsFilling(true);
      setError(null);
      try {
        return await generateComicStoryboard(
          params.apiKey,
          params.characterConcept,
          params.synopsis
        );
      } catch (e) {
        setError(getErrorMessage(e));
        throw e;
      } finally {
        setIsFilling(false);
      }
    },
    [openSettings]
  );

  return { fillFromSynopsis, isFilling, error };
}
