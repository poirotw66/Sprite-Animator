import { useCallback, useState } from 'react';
import { API_KEY_MISSING_MESSAGE, generateComicPage } from '../services/geminiService';
import { getErrorMessage } from '../types/errors';
import {
  validatePanelsForGeneration,
  type ComicPanel,
  type ComicProject,
} from '../utils/comicPanelSchema';

export function useComicPageGeneration(openSettings: () => void) {
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
      if (!params.project.characterSheetImage) {
        throw new Error('Character sheet required');
      }

      const validation = validatePanelsForGeneration(params.project.panels);
      if (!validation.ok) {
        throw new Error(
          `Missing scene on panels: ${validation.missingIndices.map((i) => i + 1).join(', ')}`
        );
      }

      setIsGenerating(true);
      setError(null);
      try {
        return await generateComicPage({
          apiKey: params.apiKey,
          model: params.model,
          resolution: params.resolution,
          characterSheetImage: params.project.characterSheetImage,
          characterConcept: params.project.characterConcept,
          styleKey: params.project.styleKey,
          panels: params.project.panels as ComicPanel[],
          onProgress: setStatus,
        });
      } catch (e) {
        setError(getErrorMessage(e));
        throw e;
      } finally {
        setIsGenerating(false);
        setStatus(null);
      }
    },
    [openSettings]
  );

  const downloadPng = useCallback((dataUrl: string, filename = 'comic-page.png') => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }, []);

  return { generate, downloadPng, isGenerating, status, error };
}
