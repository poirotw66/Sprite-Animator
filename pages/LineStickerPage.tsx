import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { SettingsModal } from '../components/SettingsModal';
import { RenderProfilerDebugPanel } from '../components/RenderProfilerDebugPanel';
import { useSettings } from '../hooks/useSettings';
import { useLineStickerDownload } from '../hooks/useLineStickerDownload';
import { useLineStickerGeneration } from '../hooks/useLineStickerGeneration';
import { useLineStickerPhraseGrid } from '../hooks/useLineStickerPhraseGrid';
import { useLineStickerPhraseGeneration } from '../hooks/useLineStickerPhraseGeneration';
import { useLineStickerImageInput } from '../hooks/useLineStickerImageInput';
import { useLineStickerSelection } from '../hooks/useLineStickerSelection';
import { useLineStickerSheetGeneration } from '../hooks/useLineStickerSheetGeneration';
import { useLineStickerThemePresetSync } from '../hooks/useLineStickerThemePresetSync';
import { useLineStickerSlicing } from '../hooks/useLineStickerSlicing';
import { useLineStickerPromptPreview } from '../hooks/useLineStickerPromptPreview';
import { useSpriteSheetFlow } from '../hooks/useSpriteSheetFlow';
import { useLineStickerSettingsPanelViewModel } from '../hooks/useLineStickerSettingsPanelViewModel';
import { useLineStickerResultPanelViewModel } from '../hooks/useLineStickerResultPanelViewModel';
import { SliceSettings, FrameOverride } from '../utils/imageUtils';
import { ChromaKeyColorType, BgRemovalMethod } from '../types';
import { DEFAULT_SLICE_SETTINGS } from '../utils/constants';
import { buildPhraseSetExport, parsePhraseSetJson } from '../utils/lineStickerPhraseSetFormat';
import {
    createLineStickerSetSliceSettings,
    createLineStickerSheetArray,
    DEFAULT_LINE_STICKER_SHEET_INDEX,
    formatLineStickerSetText,
    LINE_STICKER_SHEET_INDICES,
    LINE_STICKER_SET_COLS,
    LINE_STICKER_SET_ROWS,
    sliceLineStickerSheetFrames,
    type LineStickerSheetIndex,
} from '../utils/lineStickerSetSchema';
import type { LineStickerSetOverviewItem } from '../components/LineSticker/LineStickerSetOverviewPanel';

import {
    LineStickerHeader,
    LineStickerSettingsPanel,
    LineStickerResultPanel,
} from '../components/LineSticker';

import {
    TEXT_PRESETS,
    TEXT_COLOR_PRESETS,
    FONT_PRESETS,
    DEFAULT_CHARACTER_SLOT,
    STYLE_PRESETS,
    buildLineStickerStylePreviewPrompt,
    type ThemeOption,
    type LineStickerStyleOption,
} from '../utils/lineStickerPrompt';
import { generateSpriteSheet } from '../services/geminiService';

const createSetModeSliceSettingsList = () =>
    createLineStickerSheetArray(() => createLineStickerSetSliceSettings());

const createEmptySetModeImageList = (): (string | null)[] =>
    createLineStickerSheetArray(() => null);

const createEmptySetModeFrameList = (): string[][] =>
    createLineStickerSheetArray(() => []);

const createEmptySetModeOverrideList = (): FrameOverride[][] =>
    createLineStickerSheetArray(() => []);

const createEmptySetModeSelectionList = (): boolean[][] =>
    createLineStickerSheetArray(() => []);

function summarizeSheetPrompt(prompt: string): string {
    const cellLines = prompt
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('**Cell '))
        .slice(0, 2);
    const source = cellLines.length > 0 ? cellLines.join(' ') : prompt;
    const compact = source.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

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
        hfToken,
        setHfToken,
        showSettings,
        setShowSettings,
        saveSettings,
        getEffectiveApiKey,
    } = useSettings();

    // Image upload state
    const [sourceImage, setSourceImage] = useState<string | null>(null);

    // Grid settings
    const [gridCols, setGridCols] = useState(4);
    const [gridRows, setGridRows] = useState(4);

    // Advanced Slicing State
    const [sheetSliceSettings, setSheetSliceSettings] = useState<SliceSettings[]>(() => createSetModeSliceSettingsList());
    const [sheetDimensions, setSheetDimensions] = useState({ width: 0, height: 0 });
    const [frameOverrides, setFrameOverrides] = useState<FrameOverride[]>([]);

    // Chroma key progress
    const [chromaKeyProgress, setChromaKeyProgress] = useState(0);
    const [isProcessingChromaKey, setIsProcessingChromaKey] = useState(false);

    const [selectedStyle, setSelectedStyle] = useState<LineStickerStyleOption>('chibi');
    const [customStyleText, setCustomStyleText] = useState('');
    const [selectedTheme, setSelectedTheme] = useState<ThemeOption>('custom');
    const [customThemeContext, setCustomThemeContext] = useState<string>('');
    const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof TEXT_PRESETS>('zh-TW');
    const [selectedTextColor, setSelectedTextColor] = useState<keyof typeof TEXT_COLOR_PRESETS>('black');
    const [selectedFont, setSelectedFont] = useState<keyof typeof FONT_PRESETS>('handwritten');
    const [singlePhrasesList, setSinglePhrasesList] = useState<string[]>([]);
    const [stylePreviewImage, setStylePreviewImage] = useState<string | null>(null);
    const [isGeneratingStylePreview, setIsGeneratingStylePreview] = useState(false);

    // Set mode state
    const [stickerSetMode, setStickerSetMode] = useState(false);
    const [setPhrasesList, setSetPhrasesList] = useState<string[]>([]);
    const [actionDescsList, setActionDescsList] = useState<string[]>([]);
    const [sheetImages, setSheetImages] = useState<(string | null)[]>(() => createEmptySetModeImageList());
    const [processedSheetImages, setProcessedSheetImages] = useState<(string | null)[]>(() => createEmptySetModeImageList());
    const [sheetFrames, setSheetFrames] = useState<string[][]>(() => createEmptySetModeFrameList());
    const [sheetFrameOverrides, setSheetFrameOverrides] = useState<FrameOverride[][]>(() => createEmptySetModeOverrideList());
    const [selectedFramesBySheet, setSelectedFramesBySheet] = useState<boolean[][]>(() => createEmptySetModeSelectionList());
    const [currentSheetIndex, setCurrentSheetIndex] = useState<LineStickerSheetIndex>(DEFAULT_LINE_STICKER_SHEET_INDEX);

    const [spriteSheetImage, setSpriteSheetImage] = useState<string | null>(null);
    const [processedSpriteSheet, setProcessedSpriteSheet] = useState<string | null>(null);
    const phraseSetFileInputRef = useRef<HTMLInputElement>(null);
    const [stickerFrames, setStickerFrames] = useState<string[]>([]);
    const [selectedFrames, setSelectedFrames] = useState<boolean[]>([]);
    const [chromaKeyColor, setChromaKeyColor] = useState<ChromaKeyColorType>('green');
    const [includeText, setIncludeText] = useState(true);
    const [bgRemovalMethod, setBgRemovalMethod] = useState<BgRemovalMethod>('chroma');

    // Single-sheet mode: shared flow (upload ? slice ? remove bg ? frames) with PartingPage
    const singleSheetFlow = useSpriteSheetFlow({
        runChromaAutomatically: bgRemovalMethod === 'chroma',
        initialSliceSettings: { ...DEFAULT_SLICE_SETTINGS, cols: LINE_STICKER_SET_COLS, rows: LINE_STICKER_SET_ROWS } as SliceSettings,
    });
    const effectiveGridCols = stickerSetMode ? LINE_STICKER_SET_COLS : singleSheetFlow.sliceSettings.cols;
    const effectiveGridRows = stickerSetMode ? LINE_STICKER_SET_ROWS : singleSheetFlow.sliceSettings.rows;
    const currentSetSliceSettings = sheetSliceSettings[currentSheetIndex] ?? createLineStickerSetSliceSettings();

    const {
        phrasesForHook,
        actionDescsForHook,
        phraseGridList,
        actionDescGridList,
        phraseGridCols,
        phraseGridRows,
        updatePhraseAt,
        updateActionDescAt,
    } = useLineStickerPhraseGrid({
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
    });
    useLineStickerThemePresetSync({
        selectedTheme,
        gridCols: effectiveGridCols,
        gridRows: effectiveGridRows,
        setSinglePhrasesList,
        setSetPhrasesList,
        setActionDescsList,
    });

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
        gridCols: effectiveGridCols,
        gridRows: effectiveGridRows,
        chromaKeyColor,
        sourceImage,
        includeText,
        selectedResolution: outputResolution,
    });

    const { isGeneratingPhrases, handleGeneratePhrases } = useLineStickerPhraseGeneration({
        getEffectiveApiKey,
        setError,
        setShowSettings,
        stickerSetMode,
        gridCols: effectiveGridCols,
        gridRows: effectiveGridRows,
        selectedTheme,
        customThemeContext,
        selectedLanguage,
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
    });

    const handleImageLoad = stickerSetMode ? slicingHandleImageLoad : singleSheetFlow.handleImageLoad;
    const sliceProcessedSheetToFrames = stickerSetMode ? slicingSliceToFrames : singleSheetFlow.sliceProcessedSheetToFrames;

    const {
        handleGenerate,
        handleGenerateAllSheets,
        reRunChromaKey,
        sheetStatuses,
        resetSheetStatuses,
        retryFailedSheets,
        retrySheet,
        hasFailedSheets,
        cancelActiveGeneration,
    } = useLineStickerSheetGeneration({
        api: { getEffectiveApiKey },
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
        chroma: { chromaKeyColor, bgRemovalMethod },
        setters: {
            setStatusText,
            setError,
            setShowSettings,
            setIsGenerating,
            setSheetImages,
            setProcessedSheetImages,
            setSheetFrames,
            setSelectedFramesBySheet,
            setSpriteSheetImage: stickerSetMode ? setSpriteSheetImage : singleSheetFlow.setImage,
            setProcessedSpriteSheet: stickerSetMode ? setProcessedSpriteSheet : singleSheetFlow.setProcessedImage,
            setIsProcessingChromaKey: stickerSetMode ? setIsProcessingChromaKey : singleSheetFlow.setIsProcessingChromaKey,
            setChromaKeyProgress: stickerSetMode ? setChromaKeyProgress : singleSheetFlow.setChromaKeyProgress,
        },
        sliceProcessedSheetToFrames,
    });

    const resetSetModeGeneratedOutputs = useCallback(() => {
        setCurrentSheetIndex(DEFAULT_LINE_STICKER_SHEET_INDEX);
        setSheetImages(createEmptySetModeImageList());
        setProcessedSheetImages(createEmptySetModeImageList());
        setSheetFrames(createEmptySetModeFrameList());
        setSheetFrameOverrides(createEmptySetModeOverrideList());
        setSelectedFramesBySheet(createEmptySetModeSelectionList());
        setSpriteSheetImage(null);
        setProcessedSpriteSheet(null);
        setStickerFrames([]);
        setSelectedFrames([]);
        setFrameOverrides([]);
        setSheetDimensions({ width: 0, height: 0 });
        setChromaKeyProgress(0);
        setIsProcessingChromaKey(false);
        resetSheetStatuses();
    }, [resetSheetStatuses]);

    const resetSingleModeGeneratedOutputs = useCallback(() => {
        singleSheetFlow.setImage(null);
        singleSheetFlow.setProcessedImage(null);
        singleSheetFlow.setFrames([]);
        singleSheetFlow.setFrameIncluded([]);
        singleSheetFlow.setFrameOverrides([]);
        singleSheetFlow.setChromaKeyProgress(0);
        singleSheetFlow.setIsProcessingChromaKey(false);
    }, [singleSheetFlow]);

    const resetGeneratedOutputs = useCallback(() => {
        cancelActiveGeneration();
        resetSingleModeGeneratedOutputs();
        resetSetModeGeneratedOutputs();
        setStylePreviewImage(null);
        setStatusText('');
        setError(null);
        setIsGenerating(false);
    }, [cancelActiveGeneration, resetSetModeGeneratedOutputs, resetSingleModeGeneratedOutputs, setError, setIsGenerating, setStatusText]);

    useEffect(() => {
        setStylePreviewImage(null);
    }, [selectedStyle, customStyleText, sourceImage]);

    const handleGenerateStylePreview = useCallback(async () => {
        const key = getEffectiveApiKey();
        if (!key) {
            setError(lineStickerT.errorApiKey);
            setShowSettings(true);
            return;
        }
        if (!sourceImage) {
            setError(lineStickerT.errorNoImage);
            return;
        }

        const styleSlot = selectedStyle === 'custom'
            ? {
                styleType: customStyleText.trim() || 'Custom style from user input.',
                drawingMethod: customStyleText.trim()
                    ? `Apply this style consistently: ${customStyleText.trim()}`
                    : 'Follow the user-provided style description.',
            }
            : STYLE_PRESETS[selectedStyle];
        const prompt = buildLineStickerStylePreviewPrompt({
            style: styleSlot,
            character: DEFAULT_CHARACTER_SLOT,
        });

        setError(null);
        setIsGeneratingStylePreview(true);
        try {
            const preview = await generateSpriteSheet(
                sourceImage,
                prompt,
                1,
                1,
                key,
                selectedModel,
                undefined,
                chromaKeyColor,
                outputResolution,
                false
            );
            setStylePreviewImage(preview);
        } catch (err: unknown) {
            const fallbackMessage = err instanceof Error ? err.message : lineStickerT.errorGeneration;
            setError(fallbackMessage);
        } finally {
            setIsGeneratingStylePreview(false);
        }
    }, [
        chromaKeyColor,
        customStyleText,
        getEffectiveApiKey,
        lineStickerT.errorApiKey,
        lineStickerT.errorGeneration,
        lineStickerT.errorNoImage,
        outputResolution,
        selectedModel,
        selectedStyle,
        setError,
        setShowSettings,
        sourceImage,
    ]);

    const handleStickerSetModeChange = useCallback((nextMode: boolean) => {
        if (nextMode === stickerSetMode) {
            return;
        }
        resetGeneratedOutputs();
        setStickerSetMode(nextMode);
    }, [resetGeneratedOutputs, stickerSetMode]);

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
        showPromptPreviewForSheet,
        handleCopyPrompt,
    } = useLineStickerPromptPreview({
        stickerSetMode,
        currentSheetIndex,
        setPhrasesList,
        actionDescsList,
        buildPrompt,
        setError,
    });

    const handleSelectOverviewSheet = useCallback((sheetIndex: LineStickerSheetIndex) => {
        setCurrentSheetIndex(sheetIndex);
        showPromptPreviewForSheet(sheetIndex);
    }, [showPromptPreviewForSheet]);

    const sheetOverviewItems = useMemo<LineStickerSetOverviewItem[]>(() => {
        if (!stickerSetMode) {
            return [];
        }

        return LINE_STICKER_SHEET_INDICES.map((sheetIndex) => {
            const phrases = sliceLineStickerSheetFrames(setPhrasesList, sheetIndex);
            const actionDescs = sliceLineStickerSheetFrames(actionDescsList, sheetIndex);
            const hasPromptContent = [...phrases, ...actionDescs].some((entry) => entry.trim().length > 0);
            const promptSummary = hasPromptContent
                ? summarizeSheetPrompt(buildPrompt(phrases, actionDescs))
                : lineStickerT.lineStickerPromptSummaryEmpty;
            const status = sheetStatuses.find((entry) => entry.sheetIndex === sheetIndex);

            return {
                sheetIndex,
                promptSummary,
                hasPromptContent,
                progress: status?.progress ?? 0,
                stage: status?.stage ?? 'idle',
                message: status?.message ?? '',
                error: status?.error ?? null,
            };
        });
    }, [actionDescsList, buildPrompt, lineStickerT.lineStickerPromptSummaryEmpty, setPhrasesList, sheetStatuses, stickerSetMode]);

    const hasCustomKey = !!apiKey.trim();

    // Effective values: single-sheet mode uses shared flow; set mode uses local state
    const effectiveSpriteSheetImage = stickerSetMode ? (sheetImages[currentSheetIndex] ?? null) : singleSheetFlow.image;
    const effectiveProcessedSpriteSheet = stickerSetMode ? (processedSheetImages[currentSheetIndex] ?? null) : singleSheetFlow.processedImage;
    const effectiveStickerFrames = stickerSetMode ? sheetFrames[currentSheetIndex] ?? [] : singleSheetFlow.frames;
    const effectiveSelectedFrames = stickerSetMode ? (selectedFramesBySheet[currentSheetIndex] ?? []) : singleSheetFlow.frameIncluded;
    const effectiveSetSelectedFrames = stickerSetMode
        ? (val: boolean[] | ((prev: boolean[]) => boolean[])) => {
            setSelectedFramesBySheet((prev) => {
                const next = prev.map((a) => [...a]);
                const s = typeof val === 'function' ? val(next[currentSheetIndex] ?? []) : val;
                next[currentSheetIndex] = s;
                return next;
            });
        }
        : singleSheetFlow.setFrameIncluded;
    const effectiveFrameOverrides = stickerSetMode ? (sheetFrameOverrides[currentSheetIndex] ?? []) : singleSheetFlow.frameOverrides;
    const effectiveSetFrameOverrides = stickerSetMode
        ? (val: FrameOverride[] | ((prev: FrameOverride[]) => FrameOverride[])) => {
            setSheetFrameOverrides((prev) => {
                const next = prev.map((a) => [...a]);
                const s = typeof val === 'function' ? val(next[currentSheetIndex] ?? []) : val;
                next[currentSheetIndex] = s;
                return next;
            });
        }
        : singleSheetFlow.setFrameOverrides;
    const effectiveSheetDimensions = stickerSetMode ? sheetDimensions : singleSheetFlow.sheetDimensions;
    const effectiveChromaKeyProgress = stickerSetMode ? chromaKeyProgress : singleSheetFlow.chromaKeyProgress;
    const effectiveIsProcessingChromaKey = stickerSetMode ? isProcessingChromaKey : singleSheetFlow.isProcessingChromaKey;
    const effectiveSliceSettingsForView = stickerSetMode ? currentSetSliceSettings : singleSheetFlow.sliceSettings;
    const effectiveSetSliceSettingsForView = stickerSetMode
        ? (val: SliceSettings | ((prev: SliceSettings) => SliceSettings)) => {
            const currentSettings = sheetSliceSettings[currentSheetIndex] ?? createLineStickerSetSliceSettings();
            if (typeof val === 'function') {
                const next = val(currentSettings);
                setSheetSliceSettings((prev) => {
                    const updated = prev.map((entry) => ({ ...entry }));
                    updated[currentSheetIndex] = {
                        ...next,
                        cols: LINE_STICKER_SET_COLS,
                        rows: LINE_STICKER_SET_ROWS,
                    };
                    return updated;
                });
            } else {
                setSheetSliceSettings((prev) => {
                    const updated = prev.map((entry) => ({ ...entry }));
                    updated[currentSheetIndex] = {
                        ...val,
                        cols: LINE_STICKER_SET_COLS,
                        rows: LINE_STICKER_SET_ROWS,
                    };
                    return updated;
                });
            }
        }
        : singleSheetFlow.setSliceSettings;

    const handleSpriteSheetUpload = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                if (stickerSetMode) {
                    setSheetImages(prev => {
                        const n = [...prev];
                        n[currentSheetIndex] = dataUrl;
                        return n;
                    });
                    setProcessedSheetImages(prev => {
                        const n = [...prev];
                        n[currentSheetIndex] = null;
                        return n;
                    });
                } else {
                    singleSheetFlow.setImage(dataUrl);
                }
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        },
        [stickerSetMode, currentSheetIndex, singleSheetFlow]
    );

    const handleDownloadPhraseSet = useCallback(() => {
        const payload = buildPhraseSetExport({
            mode: stickerSetMode ? 'set' : 'single',
            gridCols: effectiveGridCols,
            gridRows: effectiveGridRows,
            phrases: phrasesForHook,
            actionDescs: actionDescsForHook,
        });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `line-sticker-phrase-set-${payload.mode}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [stickerSetMode, effectiveGridCols, effectiveGridRows, phrasesForHook, actionDescsForHook]);

    const handleUploadPhraseSet = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const text = reader.result as string;
                const data = parsePhraseSetJson(text);
                if (!data) {
                    setError(lineStickerT.lineStickerPhraseSetUploadError);
                    return;
                }
                setError(null);
                if (data.mode === 'single' && data.gridCols != null && data.gridRows != null) {
                    handleStickerSetModeChange(false);
                    setGridCols(data.gridCols);
                    setGridRows(data.gridRows);
                    singleSheetFlow.setSliceSettings(prev => ({ ...prev, cols: data.gridCols!, rows: data.gridRows! }));
                    setSinglePhrasesList(data.phrases);
                    setActionDescsList(data.actionDescs ?? data.phrases.map(() => ''));
                } else {
                    handleStickerSetModeChange(true);
                    setSheetSliceSettings(createSetModeSliceSettingsList());
                    setSetPhrasesList(data.phrases);
                    setActionDescsList(data.actionDescs ?? data.phrases.map(() => ''));
                    setCurrentSheetIndex(DEFAULT_LINE_STICKER_SHEET_INDEX);
                }
            };
            reader.readAsText(file, 'UTF-8');
            e.target.value = '';
        },
        [handleStickerSetModeChange, lineStickerT.lineStickerPhraseSetUploadError, setActionDescsList, setError, setGridCols, setGridRows, singleSheetFlow]
    );

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
        selectedLanguage,
        setSelectedLanguage,
        selectedFont,
        setSelectedFont,
        currentSheetIndex,
        phraseGridList,
        actionDescGridList,
        phraseGridCols,
        updatePhraseAt,
        updateActionDescAt,
        isGeneratingPhrases,
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
    });

    return (
        <div className="min-h-screen bg-slate-50 font-sans px-4 pb-8 md:px-6 lg:px-8 pt-4 md:pt-6">
            <SettingsModal
                apiKey={apiKey}
                setApiKey={setApiKey}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                outputResolution={outputResolution}
                setOutputResolution={setOutputResolution}
                showSettings={showSettings}
                onClose={() => setShowSettings(false)}
                onSave={(key, model, token, res) => saveSettings(key, model, token, res)}
                hfToken={hfToken}
                setHfToken={setHfToken}
            />

            <LineStickerHeader
                title={lineStickerT.lineStickerTitle}
                hasCustomKey={hasCustomKey}
                onOpenSettings={() => setShowSettings(true)}
            />

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                <LineStickerSettingsPanel t={lineStickerT} viewModel={settingsPanelViewModel} />

                <div className="lg:col-span-7 space-y-6">
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
