import { useCallback, useState } from 'react';
import { API_KEY_MISSING_MESSAGE, generateComicCharacterSheet } from '../services/geminiService';
import { getErrorMessage } from '../types/errors';
import type { ComicProject } from '../utils/comicPanelSchema';
import { canGenerateComicCharacterSheet } from '../utils/comicSheetInput';

export function useComicCharacterSheet(openSettings: () => void) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (params: {
      apiKey: string;
      model: string;
      resolution: string;
      project: ComicProject;
    }) => {
      if (!params.apiKey) {
        openSettings();
        throw new Error(API_KEY_MISSING_MESSAGE);
      }
      if (!canGenerateComicCharacterSheet(params.project)) {
        throw new Error(
          params.project.sourceMode === 'upload'
            ? 'Upload a reference image before generating the character sheet.'
            : 'Need character concept or reference image'
        );
      }

      setIsGenerating(true);
      setError(null);
      try {
        const image = await generateComicCharacterSheet({
          apiKey: params.apiKey,
          model: params.model,
          resolution: params.resolution,
          project: params.project,
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
