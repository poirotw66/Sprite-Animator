import { useCallback, useMemo } from 'react';
import { useLanguage } from './useLanguage';
import { useSettings } from './useSettings';
import { useLineStickerDownload } from './useLineStickerDownload';
import { useLineStickerGeneration } from './useLineStickerGeneration';
import { useLineStickerPhraseGeneration } from './useLineStickerPhraseGeneration';
import { useLineStickerImageInput } from './useLineStickerImageInput';
import { useLineStickerSelection } from './useLineStickerSelection';
import { useLineStickerSlicing } from './useLineStickerSlicing';
import { useLineStickerPhraseSetTransfer } from './useLineStickerPhraseSetTransfer';
import { useLineStickerStylePreview } from './useLineStickerStylePreview';
import { useLineStickerSettingsPanelViewModel } from './useLineStickerSettingsPanelViewModel';
import { useLineStickerResultPanelViewModel } from './useLineStickerResultPanelViewModel';
import { formatLineStickerSetText } from '../utils/lineStickerSetSchema';
import { deriveLineStickerActiveSheetState } from '../utils/lineStickerActiveSheetState';

import {
    useLineStickerProgrammaticOverlayCompose,
    useLineStickerProgrammaticOverlayCore,
} from './useLineStickerProgrammaticOverlay';
import { useLazyBundledStickerFont } from './useLazyBundledStickerFont';
import { useLineStickerDesignController } from './useLineStickerDesignController';
import { useLineStickerSetOutputController } from './useLineStickerSetOutputController';
import { useLineStickerSingleSheetController } from './useLineStickerSingleSheetController';
import { useLineStickerPhraseController } from './useLineStickerPhraseController';
import { getLineStickerActiveGrid } from '../utils/lineStickerActiveGrid';
import { useLineStickerGenerationLifecycleController } from './useLineStickerGenerationLifecycleController';
import { useLineStickerSheetOverviewController } from './useLineStickerSheetOverviewController';
import { useLineStickerFrameEditController } from './useLineStickerFrameEditController';
import { useLineStickerJobPersistence } from './useLineStickerJobPersistence';

/**
 * Composes the LINE sticker feature controllers into props consumed by the page.
 * Controllers retain ownership of workflow and domain behavior; this hook only
 * defines the browser UI wiring boundary.
 */
export const useLineStickerWorkspace = () => {
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
        statusText,
        setStatusText,
        error,
        setError,
        run,
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
        resetGeneratedOutputs: resetGeneratedOutputsBase,
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
            startRun: run.startRun,
            finishRun: run.finishRun,
            setRunMessage: run.setRunMessage,
            setRunError: run.setRunError,
            cancelRun: run.cancelRun,
            resetRun: run.resetRun,
            setRunStage: run.setRunStage,
            sheetStatuses: run.sheetStatuses,
            updateSheetStatus: run.updateSheetStatus,
        },
        setShowSettings,
        setSourceImage,
        setStylePreviewImage,
        setStickerSetMode,
        resetOverlayState: lineStickerProgrammaticOverlayCore.resetOverlayState,
    });

    const { clearPersistedJob } = useLineStickerJobPersistence({
        isGenerating,
        run,
        sourceImage,
        setSourceImage,
        stickerSetMode,
        setStickerSetMode,
        setPhrasesList,
        setSetPhrasesList,
        actionDescsList,
        setActionDescsList,
        sheetImages,
        setSheetImages,
        processedSheetImages,
        setProcessedSheetImages,
        sheetFrames,
        setSheetFrames,
        setSpriteSheetImage,
        setProcessedSpriteSheet,
    });

    const resetGeneratedOutputs = useCallback(() => {
        resetGeneratedOutputsBase();
        void clearPersistedJob();
    }, [clearPersistedJob, resetGeneratedOutputsBase]);

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

    return {
        modal: {
            apiKey,
            setApiKey,
            selectedModel,
            setSelectedModel,
            outputResolution,
            setOutputResolution,
            stylePreviewResolution,
            setStylePreviewResolution,
            showSettings,
            onClose: () => setShowSettings(false),
            onSave: saveSettings,
            hfToken,
            setHfToken,
        },
        header: {
            title: lineStickerT.lineStickerTitle,
            hasCustomKey,
            onOpenSettings: () => setShowSettings(true),
            jumpToResultLabel: lineStickerT.lineStickerJumpToResult,
        },
        settings: {
            t: lineStickerT,
            viewModel: settingsPanelViewModel,
        },
        result: {
            t: lineStickerT,
            viewModel: resultPanelViewModel,
        },
        profiler: {
            title: 'Line Sticker Profiler',
            filterIds: [
                'LineStickerPhraseGrid',
                'LineStickerResultViewer',
                'LineStickerResultDownloads',
            ],
        },
    };
};
