import React, { useCallback, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ToolPageHeader } from '../components/ui';
import { SettingsModal } from '../components/SettingsModal';
import {
  ComicCharacterSheetStep,
  ComicResultStep,
  ComicSourceStep,
  ComicStoryboardStep,
  ComicWizardSteps,
  type ComicSourceMode,
} from '../components/Comic';
import { useComicCharacterSheet } from '../hooks/useComicCharacterSheet';
import { useComicPageGeneration } from '../hooks/useComicPageGeneration';
import { useComicProject } from '../hooks/useComicProject';
import { useComicStoryboard } from '../hooks/useComicStoryboard';
import { useLanguage } from '../hooks/useLanguage';
import { useSettings } from '../hooks/useSettings';
import { clampComicDialogue, type ComicPanel } from '../utils/comicPanelSchema';
import {
  getComicNextStepState,
  getComicPageGenerationState,
} from '../utils/comicPageFlow';
import { canGenerateComicCharacterSheet } from '../utils/comicSheetInput';
import { buildComicDownloadFilename } from '../utils/comicDownloadFilenames';

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

const OnePageComicPage: React.FC = () => {
  const { t } = useLanguage();
  const {
    apiKey,
    setApiKey,
    openRouterApiKey,
    setOpenRouterApiKey,
    imageProvider,
    setImageProvider,
    selectedModel,
    setSelectedModel,
    outputResolution,
    setOutputResolution,
    stylePreviewResolution,
    setStylePreviewResolution,
    hfToken,
    setHfToken,
    showSettings,
    setShowSettings,
    saveSettings,
    getEffectiveApiKey,
  } = useSettings();
  const { project, step, setStep, patchProject } = useComicProject();
  const [stepError, setStepError] = useState<string | null>(null);
  const [highlightedMissingPanels, setHighlightedMissingPanels] = useState<number[]>([]);

  const openSettings = useCallback(() => setShowSettings(true), [setShowSettings]);
  const characterSheet = useComicCharacterSheet(openSettings);
  const storyboard = useComicStoryboard(openSettings);
  const pageGeneration = useComicPageGeneration(openSettings);

  const handleSourceModeChange = useCallback((mode: ComicSourceMode) => {
    setStepError(null);
    patchProject({
      sourceMode: mode,
      ...(mode === 'concept' ? { referenceImage: null } : {}),
      characterSheetImage: null,
      pageImage: null,
      generationMeta: undefined,
    });
  }, [patchProject]);

  const handleCharacterConceptChange = useCallback((value: string) => {
    setStepError(null);
    patchProject({
      characterConcept: value,
      characterSheetImage: null,
      pageImage: null,
      generationMeta: undefined,
    });
  }, [patchProject]);

  const handleImageDataUrl = useCallback((result: string | null) => {
    if (!result) {
      return;
    }
    setStepError(null);
    patchProject({
      sourceMode: 'upload',
      referenceImage: result,
      styleKey: 'matchUploaded',
      characterSheetImage: null,
      pageImage: null,
      generationMeta: undefined,
    });
  }, [patchProject]);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      handleImageDataUrl((loadEvent.target?.result as string) ?? null);
    };
    reader.readAsDataURL(file);
  }, [handleImageDataUrl]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file?.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      handleImageDataUrl((loadEvent.target?.result as string) ?? null);
    };
    reader.readAsDataURL(file);
  }, [handleImageDataUrl]);

  const handleStyleKeyChange = useCallback((styleKey: string) => {
    setStepError(null);
    patchProject({
      styleKey,
      characterSheetImage: null,
      pageImage: null,
      generationMeta: undefined,
    });
  }, [patchProject]);

  const handleGenerateSheet = useCallback(async () => {
    if (!canGenerateComicCharacterSheet(project)) {
      const errorKey =
        project.sourceMode === 'upload' ? 'comicErrorNeedUpload' : 'comicErrorNeedConcept';
      setStepError(t[errorKey]);
      return;
    }

    setStepError(null);
    try {
      const image = await characterSheet.generate({
        apiKey: getEffectiveApiKey(),
        model: selectedModel,
        resolution: outputResolution,
        project,
      });

      patchProject({
        characterSheetImage: image,
        pageImage: null,
        generationMeta: undefined,
      });
    } catch {
      // Step component already renders hook-level errors.
    }
  }, [
    characterSheet,
    getEffectiveApiKey,
    outputResolution,
    patchProject,
    project,
    selectedModel,
    t,
  ]);

  const handleDownloadSheet = useCallback(() => {
    if (!project.characterSheetImage) {
      return;
    }
    downloadDataUrl(
      project.characterSheetImage,
      buildComicDownloadFilename(project, 'character-sheet')
    );
  }, [project]);

  const handleSynopsisChange = useCallback((value: string) => {
    setStepError(null);
    patchProject({
      synopsis: value,
      pageImage: null,
      generationMeta: undefined,
    });
  }, [patchProject]);

  const handleFillStoryboard = useCallback(async () => {
    setStepError(null);
    setHighlightedMissingPanels([]);

    try {
      const nextPanels = await storyboard.fillFromSynopsis({
        apiKey: getEffectiveApiKey(),
        characterConcept: project.characterConcept,
        synopsis: project.synopsis ?? '',
      });

      patchProject({
        panels: nextPanels,
        pageImage: null,
        generationMeta: undefined,
      });
    } catch {
      // Step component already renders hook-level errors.
    }
  }, [getEffectiveApiKey, patchProject, project.characterConcept, project.synopsis, storyboard]);

  const handlePanelChange = useCallback((index: number, patch: Partial<ComicPanel>) => {
    setStepError(null);
    setHighlightedMissingPanels((prev) => prev.filter((item) => item !== index));

    const nextPanels = project.panels.map((panel, panelIndex) => {
      if (panelIndex !== index) {
        return panel;
      }

      return {
        ...panel,
        ...patch,
        dialogue:
          patch.dialogue !== undefined
            ? clampComicDialogue(patch.dialogue)
            : panel.dialogue,
      };
    });

    patchProject({
      panels: nextPanels,
      pageImage: null,
      generationMeta: undefined,
    });
  }, [patchProject, project.panels]);

  const handleGeneratePage = useCallback(async () => {
    const generationState = getComicPageGenerationState(project);
    if (!generationState.canGenerate) {
      if (generationState.errorKey === 'comicErrorNeedPanels') {
        setHighlightedMissingPanels(generationState.missingIndices);
        setStep(3);
      } else if (generationState.errorKey === 'comicErrorNeedSheet') {
        setStep(2);
      }
      setStepError(generationState.errorKey ? t[generationState.errorKey] : t.comicErrorNeedPanels);
      return;
    }

    setStepError(null);
    setHighlightedMissingPanels([]);

    try {
      const image = await pageGeneration.generate({
        apiKey: getEffectiveApiKey(),
        model: selectedModel,
        resolution: outputResolution,
        project,
      });

      patchProject({
        pageImage: image,
        generationMeta: {
          model: selectedModel,
          aspectRatio: '1:1',
          resolution: outputResolution,
        },
      });
    } catch {
      // Step component already renders hook-level errors.
    }
  }, [
    getEffectiveApiKey,
    outputResolution,
    pageGeneration,
    patchProject,
    project,
    selectedModel,
    setStep,
    t,
  ]);

  const handleDownloadPage = useCallback(() => {
    if (!project.pageImage) {
      return;
    }
    pageGeneration.downloadPng(
      project.pageImage,
      buildComicDownloadFilename(project, 'page')
    );
  }, [pageGeneration, project]);

  const handleNext = useCallback(() => {
    if (step === 4) {
      return;
    }

    const transition = getComicNextStepState(step, project);
    if (!transition.canProceed) {
      setStepError(transition.errorKey ? t[transition.errorKey] : null);
      if (step === 2) {
        setStep(2);
      }
      return;
    }

    setStepError(null);
    if (step === 3) {
      setHighlightedMissingPanels([]);
    }
    setStep((step + 1) as 2 | 3 | 4);
  }, [project, setStep, step, t]);

  const handleBack = useCallback(() => {
    if (step === 1) {
      return;
    }
    setStepError(null);
    setStep((step - 1) as 1 | 2 | 3);
  }, [setStep, step]);

  const currentStepContent = useMemo(() => {
    switch (step) {
      case 1:
        return (
          <ComicSourceStep
            sourceMode={project.sourceMode}
            referenceImage={project.referenceImage}
            characterConcept={project.characterConcept}
            onSourceModeChange={handleSourceModeChange}
            onCharacterConceptChange={handleCharacterConceptChange}
            onImageUpload={handleImageUpload}
            onDrop={handleDrop}
          />
        );
      case 2:
        return (
          <ComicCharacterSheetStep
            styleKey={project.styleKey}
            referenceImage={project.sourceMode === 'upload' ? project.referenceImage : null}
            characterSheetImage={project.characterSheetImage}
            isGenerating={characterSheet.isGenerating}
            status={characterSheet.status}
            error={characterSheet.error}
            onStyleKeyChange={handleStyleKeyChange}
            onGenerate={handleGenerateSheet}
            onDownload={handleDownloadSheet}
          />
        );
      case 3:
        return (
          <ComicStoryboardStep
            synopsis={project.synopsis ?? ''}
            panels={project.panels}
            isFilling={storyboard.isFilling}
            error={storyboard.error}
            invalidPanelIndices={highlightedMissingPanels}
            onSynopsisChange={handleSynopsisChange}
            onPanelChange={handlePanelChange}
            onFillFromSynopsis={handleFillStoryboard}
          />
        );
      case 4:
      default:
        return (
          <ComicResultStep
            pageImage={project.pageImage}
            isGenerating={pageGeneration.isGenerating}
            status={pageGeneration.status}
            error={pageGeneration.error}
            canGenerate={Boolean(project.characterSheetImage)}
            onGenerate={handleGeneratePage}
            onDownload={handleDownloadPage}
          />
        );
    }
  }, [
    characterSheet.error,
    characterSheet.isGenerating,
    characterSheet.status,
    handleCharacterConceptChange,
    handleDownloadPage,
    handleDownloadSheet,
    handleDrop,
    handleFillStoryboard,
    handleGeneratePage,
    handleGenerateSheet,
    handleImageUpload,
    handlePanelChange,
    handleSourceModeChange,
    handleStyleKeyChange,
    handleSynopsisChange,
    highlightedMissingPanels,
    pageGeneration.error,
    pageGeneration.isGenerating,
    pageGeneration.status,
    project,
    step,
    storyboard.error,
    storyboard.isFilling,
  ]);

  return (
    <div className="ui-page flex flex-col">
      <ToolPageHeader
        title={t.comicTitle}
        icon={<BookOpen />}
        onOpenSettings={() => setShowSettings(true)}
        settingsLabel={t.settings}
      />

      <SettingsModal
        apiKey={apiKey}
        setApiKey={setApiKey}
        openRouterApiKey={openRouterApiKey}
        setOpenRouterApiKey={setOpenRouterApiKey}
        imageProvider={imageProvider}
        setImageProvider={setImageProvider}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        outputResolution={outputResolution}
        setOutputResolution={setOutputResolution}
        stylePreviewResolution={stylePreviewResolution}
        setStylePreviewResolution={setStylePreviewResolution}
        showSettings={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
        hfToken={hfToken}
        setHfToken={setHfToken}
      />

      <main className="flex-1 max-w-6xl mx-auto w-full py-2 space-y-6">
        <ComicWizardSteps currentStep={step} />

        {stepError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {stepError}
          </div>
        ) : null}

        {currentStepContent}

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.comicBack}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-signal-hover"
            >
              {t.comicNext}
            </button>
          ) : (
            <div />
          )}
        </div>
      </main>
    </div>
  );
};

export default OnePageComicPage;
