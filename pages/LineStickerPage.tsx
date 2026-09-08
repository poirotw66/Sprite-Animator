import React, { useCallback, useMemo } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { SettingsModal } from '../components/SettingsModal';
import { RenderProfilerDebugPanel } from '../components/RenderProfilerDebugPanel';
import { useSettings } from '../hooks/useSettings';
import { useLineStickerDownload } from '../hooks/useLineStickerDownload';
import { useLineStickerGeneration } from '../hooks/useLineStickerGeneration';
import { useLineStickerPhraseGeneration } from '../hooks/useLineStickerPhraseGeneration';
import { useLineStickerImageInput } from '../hooks/useLineStickerImageInput';
import { useLineStickerSelection } from '../hooks/useLineStickerSelection';
import { useLineStickerSlicing } from '../hooks/useLineStickerSlicing';
import { useLineStickerPhraseSetTransfer } from '../hooks/useLineStickerPhraseSetTransfer';
import { useLineStickerStylePreview } from '../hooks/useLineStickerStylePreview';
import { useLineStickerSettingsPanelViewModel } from '../hooks/useLineStickerSettingsPanelViewModel';
import { useLineStickerResultPanelViewModel } from '../hooks/useLineStickerResultPanelViewModel';
import { formatLineStickerSetText, type LineStickerSheetIndex } from '../utils/lineStickerSetSchema';
import { deriveLineStickerActiveSheetState } from '../utils/lineStickerActiveSheetState';

import {
    LineStickerHeader,
    LineStickerSettingsPanel,
    LineStickerResultPanel,
} from '../components/LineSticker';
import {
    useLineStickerProgrammaticOverlayCompose,
    useLineStickerProgrammaticOverlayCore,
} from '../hooks/useLineStickerProgrammaticOverlay';
import { useLazyBundledStickerFont } from '../hooks/useLazyBundledStickerFont';
import { useLineStickerDesignController } from '../hooks/useLineStickerDesignController';
import { useLineStickerSetOutputController } from '../hooks/useLineStickerSetOutputController';
import { useLineStickerSingleSheetController } from '../hooks/useLineStickerSingleSheetController';
import { useLineStickerPhraseController } from '../hooks/useLineStickerPhraseController';
import { getLineStickerActiveGrid } from '../utils/lineStickerActiveGrid';
import { useLineStickerGenerationLifecycleController } from '../hooks/useLineStickerGenerationLifecycleController';
import { useLineStickerSheetOverviewController } from '../hooks/useLineStickerSheetOverviewController';
import { useLineStickerFrameEditController } from '../hooks/useLineStickerFrameEditController';

const LineStickerPage: React.FC = () => {
    const { t } = useLanguage();
    const lineStickerT = useMemo(() => ({
        ...t,
        lineStickerModeSet: formatLineStickerSetText(t.lineStickerModeSet),
        lineStickerModeSetHint: formatLineStickerSetText(t.lineStickerModeSetHint),
        lineStickerPhraseListSet: formatLineStickerSetText(t.lineStickerPhraseListSet),
        lineStickerGeneratePhrases48: formatLineStickerSetText(t.lineStickerGeneratePhrases48),
        lineStickerPhraseGenHint48: formatLineStickerSetText(t.lineStickerPhraseGenHint48),
        lineStickerPhraseSetPlaceholder: formatLineStickerSetText(t.lineStickerPhraseSetPlaceholder),
        lineStickerSheetInfo: formatLineStickerSetText(t.lineStickerSheetInfo),
        lineStickerGenerateAll: formatLineStickerSetText(t.lineStickerGenerateAll),
        lineStickerDownload3Zip: formatLineStickerSetText(t.lineStickerDownload3Zip),
        lineStickerDownload3SheetsFramesZip: formatLineStickerSetText(t.lineStickerDownload3SheetsFramesZip),
        lineStickerDownloadAllOneClick: formatLineStickerSetText(t.lineStickerDownloadAllOneClick),
        lineStickerDownloadSheetN: formatLineStickerSetText(t.lineStickerDownloadSheetN),
        lineStickerErrorNeedPhrases: formatLineStickerSetText(t.lineStickerErrorNeedPhrases),
        lineStickerParallelGenerating: formatLineStickerSetText(t.lineStickerParallelGenerating),
        lineStickerSheetProgressTitle: formatLineStickerSetText(t.lineStickerSheetProgressTitle),
        lineStickerTotalFramesSet: formatLineStickerSetText(t.lineStickerTotalFramesSet),
    }), [t]);
    const {
        apiKey,
        setApiKey,
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

    const {
        sheetSliceSettings, setSheetSliceSettings, sheetDimensions, setSheetDimensions,
        frameOverrides, chromaKeyProgress, setChromaKeyProgress,
        isProcessingChromaKey, setIsProcessingChromaKey, sheetImages, setSheetImages,
        processedSheetImages, setProcessedSheetImages, sheetFrames, setSheetFrames,
        sheetFrameOverrides, setSheetFrameOverrides, selectedFramesBySheet, setSelectedFramesBySheet,
        currentSheetIndex, setCurrentSheetIndex, spriteSheetImage, setSpriteSheetImage,
        processedSpriteSheet, setProcessedSpriteSheet, stickerFrames, setStickerFrames,
        selectedFrames, setSelectedFrames, resetSetOutputState, currentSetSliceSettings,
        optimizeSheetSlice,
    } = useLineStickerSetOutputController();
    const {
        sourceImage, setSourceImage, gridCols, setGridCols, gridRows, setGridRows,
        selectedStyle, setSelectedStyle,
        customStyleText, setCustomStyleText, customFontText, setCustomFontText,
        selectedTheme, setSelectedTheme, customThemeContext, setCustomThemeContext,
        selectedLanguage, setSelectedLanguage, selectedPromptVersion, setSelectedPromptVersion,
        actionDedupeStrength, setActionDedupeStrength, selectedTextColor, setSelectedTextColor,
        selectedFont, setSelectedFont, singlePhrasesList, stickerSetMode, setStickerSetMode, setSinglePhrasesList,
        setPhrasesList, setSetPhrasesList, actionDescsList, setActionDescsList,
        stylePreviewImage, setStylePreviewImage, chromaKeyColor, setChromaKeyColor,
        bgRemovalMethod, setBgRemovalMethod,
        includeText, setIncludeText, textRendering, setTextRendering,
        programmaticTextTuning, setProgrammaticTextTuning,
    } = useLineStickerDesignController();
    useLazyBundledStickerFont(selectedFont, textRendering === 'programmatic' && includeText);

    const lineStickerProgrammaticOverlayCore = useLineStickerProgrammaticOverlayCore({
        textRendering,
        includeText,
        stickerSetMode,
        currentSheetIndex,
    });

    const singleSheetFlow = useLineStickerSingleSheetController({
        bgRemovalMethod,
        chromaKeyColor,
        mapFramesAfterSlice: lineStickerProgrammaticOverlayCore.mapFramesAfterSlice,
    });
    const { cols: effectiveGridCols, rows: effectiveGridRows } = getLineStickerActiveGrid(
        stickerSetMode,
        singleSheetFlow.sliceSettings,
    );
    const {
        phrasesForHook, actionDescsForHook, phraseGridList, actionDescGridList,
        phraseGridCols, phraseGridRows, updatePhraseAt, updateActionDescAt, phraseMaxLength,
    } = useLineStickerPhraseController({
        stickerSetMode,
        currentSheetIndex,
        singlePhrasesList,
        setSinglePhrasesList,
        setPhrasesList,
        setSetPhrasesList,
        actionDescsList,
        setActionDescsList,
        gridCols: effectiveGridCols,
        gridRows: effectiveGridRows,
        selectedLanguage,
        selectedTheme,
    });

    const { ensureProgrammaticOverlayFullRes } = useLineStickerProgrammaticOverlayCompose(
        lineStickerProgrammaticOverlayCore,
        {
        textRendering,
        includeText,
        stickerSetMode,
        currentSheetIndex,
        phrasesForHook,
        selectedFont,
        selectedTextColor,
        programmaticTextTuning,
        singleSheetSetFrames: singleSheetFlow.setFrames,
        setSheetFrames,
        setStickerFrames,
        }
    );

    const prepareProgrammaticDownload = useCallback(async () => {
        if (textRendering === 'programmatic' && includeText && stickerSetMode) {
            return ensureProgrammaticOverlayFullRes(sheetFrames);
        }
        return undefined;
    }, [textRendering, includeText, stickerSetMode, ensureProgrammaticOverlayFullRes, sheetFrames]);


    const {
        isGenerating,
        setIsGenerating,
        statusText,
        setStatusText,
        error,
        setError,
        generateSingleSheet,
        buildPrompt,
    } = useLineStickerGeneration({
        apiKey: getEffectiveApiKey(),
        selectedModel,
        selectedStyle,
        customStyleText,
        selectedTheme,
        customThemeContext,
        customPhrasesList: phrasesForHook,
        customActionDescsList: actionDescsForHook,
        selectedLanguage,
        selectedTextColor,
        selectedFont,
        customFontText,
        gridCols: effectiveGridCols,
        gridRows: effectiveGridRows,
        chromaKeyColor,
        sourceImage,
        includeText,
        textRendering,
        promptVersion: selectedPromptVersion,
        selectedResolution: outputResolution,
    });

    const {
        isGeneratingPhrases,
        isBackfillingActionDescs,
        handleGeneratePhrases,
    } = useLineStickerPhraseGeneration({
        getEffectiveApiKey,
        setError,
        setShowSettings,
        stickerSetMode,
        gridCols: effectiveGridCols,
        gridRows: effectiveGridRows,
        selectedTheme,
        customThemeContext,
        selectedLanguage,
        actionDedupeStrength,
        setSinglePhrasesList,
        setSetPhrasesList,
        setActionDescsList,
        t: {
            errorApiKey: lineStickerT.errorApiKey,
        },
    });

    const {
        isDownloading,
        downloadFormat,
        setDownloadFormat,
        downloadSelectedAsZip,
        downloadAllAsZip,
        downloadStickerSetZip,
        downloadCurrentSheetZip,
        downloadAllSheetsFramesZip,
        downloadSetOneClick,
    } = useLineStickerDownload({
        stickerFrames: stickerSetMode ? stickerFrames : singleSheetFlow.frames,
        sheetFrames,
        stickerSetMode,
        currentSheetIndex,
        processedSheetImages,
        sheetImages,
        setError,
        prepareDownload: prepareProgrammaticDownload,
    });

    const { handleImageLoad: slicingHandleImageLoad, sliceProcessedSheetToFrames: slicingSliceToFrames } = useLineStickerSlicing({
        chromaKeyColor,
        processedSpriteSheet: stickerSetMode ? processedSpriteSheet : null,
        sliceSettings: stickerSetMode ? currentSetSliceSettings : singleSheetFlow.sliceSettings,
        sheetSliceSettings,
        frameOverrides: stickerSetMode ? frameOverrides : singleSheetFlow.frameOverrides,
        gridCols: effectiveGridCols,
        gridRows: effectiveGridRows,
        sheetDimensions: stickerSetMode ? sheetDimensions : singleSheetFlow.sheetDimensions,
        setStickerFrames: stickerSetMode ? setStickerFrames : singleSheetFlow.setFrames,
        setSelectedFrames: stickerSetMode ? setSelectedFrames : singleSheetFlow.setFrameIncluded,
        stickerSetMode,
        currentSheetIndex,
        processedSheetImages,
        sheetFrameOverrides,
        setSheetFrames,
        setSheetDimensions,
        textRendering,
        includeText,
        setPhrasesList,
        phraseListSingle: phrasesForHook,
        onProgrammaticRawFrames: lineStickerProgrammaticOverlayCore.onProgrammaticRawFrames,
    });

    const handleImageLoad = stickerSetMode ? slicingHandleImageLoad : singleSheetFlow.handleImageLoad;
    const sliceProcessedSheetToFrames = stickerSetMode ? slicingSliceToFrames : singleSheetFlow.sliceProcessedSheetToFrames;

    const {
        handleGenerate,
        handleGenerateAllSheets,
        reRunChromaKey,
        sheetStatuses,
        retryFailedSheets,
        retrySheet,
        hasFailedSheets,
        cancelActiveGeneration,
        resetGeneratedOutputs,
        handleStickerSetModeChange,
        handleUseStylePreview,
    } = useLineStickerGenerationLifecycleController({
        getEffectiveApiKey,
        sourceImage,
        stickerSetMode,
        setPhrasesList,
        actionDescsList,
        currentSheetIndex,
        generateSingleSheet,
        texts: {
            errorApiKey: lineStickerT.errorApiKey,
            errorNoImage: lineStickerT.errorNoImage,
            lineStickerErrorNeedPhrases: lineStickerT.lineStickerErrorNeedPhrases,
            lineStickerParallelGenerating: lineStickerT.lineStickerParallelGenerating,
            lineStickerGeneratingSheetN: lineStickerT.lineStickerGeneratingSheetN,
            lineStickerProcessingSheetN: lineStickerT.lineStickerProcessingSheetN,
            lineStickerQueuedSheetN: lineStickerT.lineStickerQueuedSheetN,
            lineStickerSlicingSheetN: lineStickerT.lineStickerSlicingSheetN,
            lineStickerSheetReadyN: lineStickerT.lineStickerSheetReadyN,
            lineStickerSheetFailedN: lineStickerT.lineStickerSheetFailedN,
            lineStickerRetryFailed: lineStickerT.lineStickerRetryFailed,
            lineStickerErrorSomeSheetsFailed: lineStickerT.lineStickerErrorSomeSheetsFailed,
            statusProcessing: lineStickerT.statusProcessing,
            errorGeneration: lineStickerT.errorGeneration,
        },
        chromaKeyColor,
        bgRemovalMethod,
        sliceProcessedSheetToFrames,
        output: {
            setSheetImages,
            setProcessedSheetImages,
            setSheetFrames,
            setSelectedFramesBySheet,
            setSpriteSheetImage,
            setProcessedSpriteSheet,
            setIsProcessingChromaKey,
            setChromaKeyProgress,
            resetSetOutputState,
            optimizeSheetSlice,
        },
        singleSheet: {
            setImage: singleSheetFlow.setImage,
            setProcessedImage: singleSheetFlow.setProcessedImage,
            setIsProcessingChromaKey: singleSheetFlow.setIsProcessingChromaKey,
            setChromaKeyProgress: singleSheetFlow.setChromaKeyProgress,
            resetGeneratedOutputs: singleSheetFlow.resetGeneratedOutputs,
        },
        state: {
            setStatusText,
            setError,
            setIsGenerating,
        },
        setShowSettings,
        setSourceImage,
        setStylePreviewImage,
        setStickerSetMode,
        resetOverlayState: lineStickerProgrammaticOverlayCore.resetOverlayState,
    });

    const {
        isGeneratingStylePreview,
        handleGenerateStylePreview,
        handleDownloadStylePreview,
        handleUseStylePreviewAsReference,
    } = useLineStickerStylePreview({
        sourceImage,
        stylePreviewImage,
        setStylePreviewImage,
        selectedStyle,
        customStyleText,
        chromaKeyColor,
        selectedModel,
        stylePreviewResolution,
        getEffectiveApiKey,
        setError,
        setShowSettings,
        errorApiKey: lineStickerT.errorApiKey,
        errorNoImage: lineStickerT.errorNoImage,
        errorGeneration: lineStickerT.errorGeneration,
        onUseStylePreview: handleUseStylePreview,
    });

    const {
        phraseSetFileInputRef,
        handleDownloadPhraseSet,
        handleUploadPhraseSet,
    } = useLineStickerPhraseSetTransfer({
        stickerSetMode,
        gridCols: effectiveGridCols,
        gridRows: effectiveGridRows,
        phrases: phrasesForHook,
        actionDescs: actionDescsForHook,
        onStickerSetModeChange: handleStickerSetModeChange,
        setGridCols,
        setGridRows,
        setSingleSheetSliceSettings: singleSheetFlow.setSliceSettings,
        setSinglePhrasesList,
        setSetPhrasesList,
        setActionDescsList,
        setSheetSliceSettings,
        setCurrentSheetIndex,
        setError,
        invalidFileMessage: lineStickerT.lineStickerPhraseSetUploadError,
    });

    const {
        fileInputRef,
        handleImageUpload,
        handleDrop,
        handleDragOver,
        openFilePicker,
    } = useLineStickerImageInput({
        setSourceImage,
        setSpriteSheetImage: stickerSetMode ? setSpriteSheetImage : singleSheetFlow.setImage,
        setStickerFrames: stickerSetMode ? setStickerFrames : singleSheetFlow.setFrames,
        setSelectedFrames: stickerSetMode ? setSelectedFrames : singleSheetFlow.setFrameIncluded,
        setError,
        resetGeneratedOutputs,
    });

    const {
        selectAll,
        deselectAll,
        selectedCount,
        selectedIndices,
    } = useLineStickerSelection({
        stickerSetMode,
        currentSheetIndex,
        sheetFrames,
        stickerFrames: stickerSetMode ? stickerFrames : singleSheetFlow.frames,
        selectedFramesBySheet,
        selectedFrames: stickerSetMode ? selectedFrames : singleSheetFlow.frameIncluded,
        setSelectedFramesBySheet,
        setSelectedFrames: stickerSetMode ? setSelectedFrames : singleSheetFlow.setFrameIncluded,
    });
    const {
        previewPrompt,
        promptCopied,
        handleGeneratePromptPreview,
        handleCopyPrompt,
        handleSelectOverviewSheet,
        sheetOverviewItems,
    } = useLineStickerSheetOverviewController({
        stickerSetMode,
        currentSheetIndex,
        setPhrasesList,
        actionDescsList,
        buildPrompt,
        setError,
        setCurrentSheetIndex,
        sheetStatuses,
        emptyPromptSummary: lineStickerT.lineStickerPromptSummaryEmpty,
    });

    const hasCustomKey = !!apiKey.trim();

    // Effective values: single-sheet mode uses shared flow; set mode uses local state
    const {
        effectiveSpriteSheetImage,
        effectiveProcessedSpriteSheet,
        effectiveStickerFrames,
        effectiveSelectedFrames,
        effectiveSetSelectedFrames,
        effectiveFrameOverrides,
        effectiveSetFrameOverrides,
        effectiveSheetDimensions,
        effectiveChromaKeyProgress,
        effectiveIsProcessingChromaKey,
        effectiveSliceSettingsForView,
        effectiveSetSliceSettingsForView,
    } = deriveLineStickerActiveSheetState({
        stickerSetMode,
        currentSheetIndex,
        singleSheetFlow,
        sheetImages,
        processedSheetImages,
        sheetFrames,
        selectedFramesBySheet,
        setSelectedFramesBySheet,
        sheetFrameOverrides,
        setSheetFrameOverrides,
        sheetDimensions,
        chromaKeyProgress,
        isProcessingChromaKey,
        currentSetSliceSettings,
        sheetSliceSettings,
        setSheetSliceSettings,
    });

    const {
        resultSidePhraseEdit: lineStickerResultSidePhraseEdit,
        frameEditProgrammaticStyleSlot: lineStickerFrameEditProgrammaticStyleSlot,
        resetProgrammaticTextTuning: handleResetProgrammaticTextTuning,
    } = useLineStickerFrameEditController({
        t: lineStickerT,
        stickerSetMode,
        textRendering,
        includeText,
        phraseGridList,
        actionDescGridList,
        phraseGridCols,
        phraseMaxLength,
        updatePhraseAt,
        updateActionDescAt,
        currentSheetIndex,
        gridCellCount: effectiveGridCols * effectiveGridRows,
        selectedFont,
        setSelectedFont,
        selectedTextColor,
        setSelectedTextColor,
        programmaticTextTuning,
        setProgrammaticTextTuning,
    });

    const settingsPanelViewModel = useLineStickerSettingsPanelViewModel({
        t: lineStickerT,
        sourceImage,
        fileInputRef,
        onOpenFilePicker: openFilePicker,
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onImageUpload: handleImageUpload,
        stickerSetMode,
        onStickerSetModeChange: handleStickerSetModeChange,
        gridCols: effectiveGridCols,
        gridRows: effectiveGridRows,
        setGridCols,
        setGridRows,
        setSingleSheetSliceSettings: singleSheetFlow.setSliceSettings,
        selectedStyle,
        setSelectedStyle,
        stylePreviewImage,
        isGeneratingStylePreview,
        onGenerateStylePreview: handleGenerateStylePreview,
        onDownloadStylePreview: handleDownloadStylePreview,
        onUseStylePreviewAsReference: handleUseStylePreviewAsReference,
        customStyleText,
        setCustomStyleText,
        selectedTheme,
        setSelectedTheme,
        customThemeContext,
        setCustomThemeContext,
        bgRemovalMethod,
        setBgRemovalMethod,
        chromaKeyColor,
        setChromaKeyColor,
        includeText,
        setIncludeText,
        textRendering,
        setTextRendering,
        selectedLanguage,
        setSelectedLanguage,
        selectedPromptVersion,
        setSelectedPromptVersion,
        actionDedupeStrength,
        setActionDedupeStrength,
        selectedFont,
        setSelectedFont,
        customFontText,
        setCustomFontText,
        selectedTextColor,
        setSelectedTextColor,
        programmaticTextTuning,
        setProgrammaticTextTuning,
        onResetProgrammaticTextTuning: handleResetProgrammaticTextTuning,
        currentSheetIndex,
        phraseGridList,
        actionDescGridList,
        phraseGridCols,
        phraseMaxLength,
        updatePhraseAt,
        updateActionDescAt,
        isGeneratingPhrases,
        isBackfillingActionDescs,
        handleGeneratePhrases,
        phraseSetFileInputRef,
        handleUploadPhraseSet,
        handleDownloadPhraseSet,
        setCurrentSheetIndex,
        onSelectOverviewSheet: handleSelectOverviewSheet,
        previewPrompt,
        promptCopied,
        handleGeneratePromptPreview,
        handleCopyPrompt,
        isGenerating,
        onGenerate: handleGenerate,
        onGenerateAllSheets: handleGenerateAllSheets,
        onCancelGeneration: cancelActiveGeneration,
        sheetStatuses,
        sheetOverviewItems,
        hasFailedSheets,
        onRetryFailedSheets: retryFailedSheets,
        onRetrySheet: retrySheet,
    });

    const resultPanelViewModel = useLineStickerResultPanelViewModel({
        stickerSetMode,
        currentSheetIndex,
        setCurrentSheetIndex,
        onSelectOverviewSheet: handleSelectOverviewSheet,
        onRetrySheet: retrySheet,
        error,
        statusText,
        isGenerating,
        isDownloading,
        effectiveSpriteSheetImage,
        effectiveProcessedSpriteSheet,
        effectiveStickerFrames,
        effectiveSelectedFrames,
        effectiveSetSelectedFrames,
        effectiveFrameOverrides,
        effectiveSetFrameOverrides,
        effectiveSliceSettingsForView,
        effectiveSetSliceSettingsForView,
        effectiveSheetDimensions,
        effectiveChromaKeyProgress,
        effectiveIsProcessingChromaKey,
        onImageLoad: handleImageLoad,
        sheetOverviewItems,
        processedSheetImages,
        sheetFrames,
        singleSheetProcessedImage: singleSheetFlow.processedImage,
        selectedCount,
        selectedIndices,
        selectAll,
        deselectAll,
        onDownloadSetOneClick: downloadSetOneClick,
        onDownloadStickerSetZip: downloadStickerSetZip,
        onDownloadAllSheetsFramesZip: downloadAllSheetsFramesZip,
        onDownloadCurrentSheetZip: downloadCurrentSheetZip,
        onDownloadAllAsZip: downloadAllAsZip,
        onDownloadSelectedAsZip: downloadSelectedAsZip,
        setSheetImages,
        setProcessedSheetImages,
        setSingleSheetImage: singleSheetFlow.setImage,
        setSingleSheetProcessedImage: singleSheetFlow.setProcessedImage,
        reRunSetSheetChromaKey: reRunChromaKey,
        reRunSingleSheetChromaKey: singleSheetFlow.reRunChromaKey,
        useFrameImageForSingleCanvas: textRendering === 'programmatic' && includeText,
        frameEditProgrammaticStyleSlot: lineStickerFrameEditProgrammaticStyleSlot,
        resultSidePhraseEdit: lineStickerResultSidePhraseEdit,
    });

    return (
        <div className="min-h-screen bg-slate-50 font-sans px-4 pb-12 pt-4 md:px-6 md:pb-14 md:pt-6 lg:px-8">
            <SettingsModal
                apiKey={apiKey}
                setApiKey={setApiKey}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                outputResolution={outputResolution}
                setOutputResolution={setOutputResolution}
                stylePreviewResolution={stylePreviewResolution}
                setStylePreviewResolution={setStylePreviewResolution}
                showSettings={showSettings}
                onClose={() => setShowSettings(false)}
                onSave={(key, model, token, res, previewRes) =>
                    saveSettings(key, model, token, res, previewRes)
                }
                hfToken={hfToken}
                setHfToken={setHfToken}
            />

            <LineStickerHeader
                title={lineStickerT.lineStickerTitle}
                hasCustomKey={hasCustomKey}
                onOpenSettings={() => setShowSettings(true)}
                jumpToResultLabel={lineStickerT.lineStickerJumpToResult}
            />

            <main className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
                <LineStickerSettingsPanel t={lineStickerT} viewModel={settingsPanelViewModel} />

                <div id="line-sticker-result" className="scroll-mt-28 space-y-5 lg:col-span-7">
                    <LineStickerResultPanel t={lineStickerT} viewModel={resultPanelViewModel} />
                </div>
            </main>

            <RenderProfilerDebugPanel
                title="Line Sticker Profiler"
                filterIds={[
                    'LineStickerPhraseGrid',
                    'LineStickerResultViewer',
                    'LineStickerResultDownloads',
                ]}
            />
        </div>
    );
};

export default LineStickerPage;
