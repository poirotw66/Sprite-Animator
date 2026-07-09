import { useCallback, useState } from 'react';
import { API_KEY_MISSING_MESSAGE, generateComicCharacterSheet } from '../services/geminiService';
import { getErrorMessage } from '../types/errors';

export function useComicCharacterSheet(openSettings: () => void) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (params: {
      apiKey: string;
      model: string;
      resolution: string;
      styleKey: string;
      characterConcept: string;
      referenceImage: string | null;
    }) => {
      if (!params.apiKey) {
        openSettings();
        throw new Error(API_KEY_MISSING_MESSAGE);
      }
      if (!params.characterConcept.trim() && !params.referenceImage) {
        throw new Error('Need character concept or reference image');
      }

      setIsGenerating(true);
      setError(null);
      try {
        const image = await generateComicCharacterSheet({
          ...params,
          onProgress: setStatus,
        });
        return image;
      } catch (e) {
        const msg = getErrorMessage(e);
        setError(msg);
        throw e;
      } finally {
        setIsGenerating(false);
        setStatus(null);
      }
    },
    [openSettings]
  );

  return { generate, isGenerating, status, error };
}
