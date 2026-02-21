import React, { useState, Suspense } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, Settings, Upload, Loader2, Download, Check, Image, FileArchive,
    Plus, Trash2, Wand2, ImageIcon, Copy
} from '../components/Icons';
import { useLanguage } from '../hooks/useLanguage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { SettingsModal } from '../components/SettingsModal';
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
import { SliceSettings, FrameOverride } from '../utils/imageUtils';
import { ChromaKeyColorType, BgRemovalMethod } from '../types';
import {
    DEFAULT_SLICE_SETTINGS,
    type StickerPhraseMode
} from '../utils/constants';

// Lazy load heavy components for code splitting
const FrameGrid = lazyWithRetry(() =>
    import('../components/FrameGrid').then(module => ({ default: module.FrameGrid }))
);
const SpriteSheetViewer = lazyWithRetry(() =>
    import('../components/SpriteSheetViewer').then(module => ({ default: module.SpriteSheetViewer }))
);

import {
    THEME_PRESETS,
    STYLE_PRESETS,
    STYLE_PRESET_ORDER,
    TEXT_PRESETS,
    TEXT_COLOR_PRESETS,
    FONT_PRESETS,
    FONT_PRESET_ORDER,
    CHARACTER_PRESETS,
    type ThemeOption,
} from '../utils/lineStickerPrompt';

const SHEETS_COUNT = 3;

const LineStickerPage: React.FC = () => {
    const { t } = useLanguage();
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
    const [sliceSettings, setSliceSettings] = useState<SliceSettings>(DEFAULT_SLICE_SETTINGS);
    const [sheetDimensions, setSheetDimensions] = useState({ width: 0, height: 0 });
    const [frameOverrides, setFrameOverrides] = useState<FrameOverride[]>([]);

    // Chroma key progress
    const [chromaKeyProgress, setChromaKeyProgress] = useState(0);
    const [isProcessingChromaKey, setIsProcessingChromaKey] = useState(false);

    const [characterPreset, setCharacterPreset] = useState<keyof typeof CHARACTER_PRESETS | 'custom'>('cute');
    const [characterAppearance, setCharacterAppearance] = useState('');
    const [characterPersonality, setCharacterPersonality] = useState('');
    const [selectedStyle, setSelectedStyle] = useState<keyof typeof STYLE_PRESETS>('chibi');
    const [selectedTheme, setSelectedTheme] = useState<ThemeOption>('custom');
    const [customThemeContext, setCustomThemeContext] = useState<string>('');
    const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof TEXT_PRESETS>('zh-TW');
    const [selectedTextColor, setSelectedTextColor] = useState<keyof typeof TEXT_COLOR_PRESETS>('black');
    const [selectedFont, setSelectedFont] = useState<keyof typeof FONT_PRESETS>('handwritten');
    const [customPhrases, setCustomPhrases] = useState<string>('');

    // Set mode state
    const [stickerSetMode, setStickerSetMode] = useState(false);
    const [setPhrasesList, setSetPhrasesList] = useState<string[]>([]);
    const [actionDescsList, setActionDescsList] = useState<string[]>([]);
    const [sheetImages, setSheetImages] = useState<(string | null)[]>([null, null, null]);
    const [processedSheetImages, setProcessedSheetImages] = useState<(string | null)[]>([null, null, null]);
    const [sheetFrames, setSheetFrames] = useState<string[][]>(() => [[], [], []]);
    const [sheetFrameOverrides, setSheetFrameOverrides] = useState<FrameOverride[][]>(() => [[], [], []]);
    const [selectedFramesBySheet, setSelectedFramesBySheet] = useState<boolean[][]>(() => [[], [], []]);
    const [currentSheetIndex, setCurrentSheetIndex] = useState<0 | 1 | 2>(0);

    const [spriteSheetImage, setSpriteSheetImage] = useState<string | null>(null);
    const [processedSpriteSheet, setProcessedSpriteSheet] = useState<string | null>(null);
    const [showOriginalInSpriteView, setShowOriginalInSpriteView] = useState(false);
    const [stickerFrames, setStickerFrames] = useState<string[]>([]);
    const [selectedFrames, setSelectedFrames] = useState<boolean[]>([]);
    const [chromaKeyColor, setChromaKeyColor] = useState<ChromaKeyColorType>('green');
    const [selectedPhraseMode, setSelectedPhraseMode] = useState<StickerPhraseMode>('balanced');
    const [includeText, setIncludeText] = useState(true);
    const [bgRemovalMethod, setBgRemovalMethod] = useState<BgRemovalMethod>('chroma');
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
        setPhrasesList,
        setSetPhrasesList,
        customPhrases,
        setCustomPhrases,
        actionDescsList,
        setActionDescsList,
        gridCols,
        gridRows,
    });
    useLineStickerThemePresetSync({
        selectedTheme,
        setCustomPhrases,
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
        characterPreset,
        characterAppearance,
        characterPersonality,
        selectedStyle,
        selectedTheme,
        customThemeContext,
        customPhrasesList: phrasesForHook,
        customActionDescsList: actionDescsForHook,
        selectedLanguage,
        selectedTextColor,
        selectedFont,
        gridCols,
        gridRows,
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
        gridCols,
        gridRows,
        selectedTheme,
        customThemeContext,
        characterPreset,
        characterAppearance,
        characterPersonality,
        selectedLanguage,
        selectedPhraseMode,
        setCustomPhrases,
        setSetPhrasesList,
        setActionDescsList,
        t: {
            errorApiKey: t.errorApiKey,
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
        stickerFrames,
        sheetFrames,
        stickerSetMode,
        currentSheetIndex,
        processedSheetImages,
        sheetImages,
        setError,
    });

    const { handleImageLoad, sliceProcessedSheetToFrames } = useLineStickerSlicing({
        chromaKeyColor,
        processedSpriteSheet,
        sliceSettings,
        frameOverrides,
        gridCols,
        gridRows,
        sheetDimensions,
        setStickerFrames,
        setSelectedFrames,
        stickerSetMode,
        currentSheetIndex,
        processedSheetImages,
        sheetFrameOverrides,
        setSheetFrames,
        setSheetDimensions,
    });

    const { handleGenerate, handleGenerateAllSheets } = useLineStickerSheetGeneration({
        getEffectiveApiKey,
        sourceImage,
        stickerSetMode,
        setPhrasesList,
        actionDescsList,
        currentSheetIndex,
        generateSingleSheet,
        t: {
            errorApiKey: t.errorApiKey,
            errorNoImage: t.errorNoImage,
            lineStickerErrorNeedPhrases: t.lineStickerErrorNeedPhrases,
            lineStickerParallelGenerating: t.lineStickerParallelGenerating,
            statusProcessing: t.statusProcessing,
            errorGeneration: t.errorGeneration,
        },
        chromaKeyColor,
        bgRemovalMethod,
        setStatusText,
        setError,
        setShowSettings,
        sliceProcessedSheetToFrames,
        setIsGenerating,
        setSheetImages,
        setProcessedSheetImages,
        setSheetFrames,
        setSelectedFramesBySheet,
        setSpriteSheetImage,
        setProcessedSpriteSheet,
        setIsProcessingChromaKey,
        setChromaKeyProgress,
    });

    const {
        fileInputRef,
        handleImageUpload,
        handleDrop,
        handleDragOver,
        openFilePicker,
    } = useLineStickerImageInput({
        setSourceImage,
        setSpriteSheetImage,
        setStickerFrames,
        setSelectedFrames,
        setError,
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
        stickerFrames,
        selectedFramesBySheet,
        selectedFrames,
        setSelectedFramesBySheet,
        setSelectedFrames,
    });
    const {
        previewPrompt,
        promptCopied,
        handleGeneratePromptPreview,
        handleCopyPrompt,
    } = useLineStickerPromptPreview({
        stickerSetMode,
        currentSheetIndex,
        setPhrasesList,
        actionDescsList,
        buildPrompt,
        setError,
    });

    const hasCustomKey = !!apiKey.trim();

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

            {/* Header */}
            <header className="max-w-7xl mx-auto mb-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <div className="bg-green-500 p-1.5 rounded-lg shadow-sm">
                                <Image className="w-5 h-5 text-white" />
                            </div>
                            {t.lineStickerTitle}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <button onClick={() => setShowSettings(true)} className={`p-2 rounded-xl transition-all border ${hasCustomKey ? 'text-green-700 bg-green-50 border-green-200' : 'text-slate-600 bg-white border-slate-200'}`}>
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Panel */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">{t.lineStickerUploadTitle}</h2>
                        <div onClick={openFilePicker} onDrop={handleDrop} onDragOver={handleDragOver} className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-green-400 bg-slate-50 transition-all overflow-hidden">
                            {sourceImage ? <img src={sourceImage} alt="Source" className="w-full h-full object-contain" /> : (
                                <div className="text-center p-4">
                                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                                    <p className="text-slate-600 font-medium">{t.lineStickerUploadHint}</p>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-slate-900">{t.lineStickerGridSettings}</h2>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerMode}</label>
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                <button onClick={() => setStickerSetMode(false)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!stickerSetMode ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t.lineStickerModeSingle}</button>
                                <button onClick={() => setStickerSetMode(true)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${stickerSetMode ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t.lineStickerModeSet}</button>
                            </div>
                        </div>

                        {!stickerSetMode && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.cols}</label>
                                    <input type="number" min="1" max="8" value={gridCols} onChange={e => setGridCols(Number(e.target.value))} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.rows}</label>
                                    <input type="number" min="1" max="8" value={gridRows} onChange={e => setGridRows(Number(e.target.value))} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerStyleLabel}</label>
                                <select value={selectedStyle} onChange={e => setSelectedStyle(e.target.value as keyof typeof STYLE_PRESETS)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                                    {STYLE_PRESET_ORDER.map((k) => (
                                        <option key={k} value={k}>{STYLE_PRESETS[k].label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerCharacterVibe || '角色形象'}</label>
                                <select value={characterPreset} onChange={e => setCharacterPreset(e.target.value as any)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                                    {Object.keys(CHARACTER_PRESETS).map(k => <option key={k} value={k}>{CHARACTER_PRESETS[k].label}</option>)}
                                    <option value="custom">{t.lineStickerThemeCustom}</option>
                                </select>
                            </div>
                        </div>

                        {characterPreset === 'custom' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerDescLabel}</label>
                                    <textarea value={characterAppearance} onChange={e => setCharacterAppearance(e.target.value)} placeholder={t.lineStickerDescPlaceholder} className="w-full h-20 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerPersonalityLabel || '個性描述'}</label>
                                    <input type="text" value={characterPersonality} onChange={e => setCharacterPersonality(e.target.value)} placeholder="例如：溫柔、害羞、愛吐槽" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerThemeLabel}</label>
                            <select value={selectedTheme} onChange={e => setSelectedTheme(e.target.value as any)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                                {Object.keys(THEME_PRESETS).map(k => <option key={k} value={k}>{(THEME_PRESETS as any)[k].label}</option>)}
                                <option value="custom">{t.lineStickerThemeCustom}</option>
                            </select>
                        </div>

                        {selectedTheme === 'custom' && (
                            <textarea value={customThemeContext} onChange={e => setCustomThemeContext(e.target.value)} placeholder={t.lineStickerCustomThemePlaceholder} className="w-full h-20 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" />
                        )}

                        {/* Chroma Key Selector */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">{t.bgRemovalMethodLabel}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setBgRemovalMethod('chroma')}
                                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${bgRemovalMethod === 'chroma'
                                            ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                            }`}
                                    >
                                        <span className="text-sm font-bold">{t.bgRemovalChroma}</span>
                                    </button>
                                    <button
                                        onClick={() => setBgRemovalMethod('ai')}
                                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${bgRemovalMethod === 'ai'
                                            ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                            }`}
                                    >
                                        <span className="text-sm font-bold">{t.bgRemovalAI}</span>
                                    </button>
                                </div>
                            </div>

                            {bgRemovalMethod === 'chroma' && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.rmbgChromaKeyLabel}</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setChromaKeyColor('magenta')}
                                            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${chromaKeyColor === 'magenta'
                                                ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-sm'
                                                : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="w-3 h-3 rounded-full bg-fuchsia-500" />
                                            <span className="text-sm font-bold">{t.magentaColor}</span>
                                            {chromaKeyColor === 'magenta' && <Check className="w-3.5 h-3.5 ml-auto" />}
                                        </button>
                                        <button
                                            onClick={() => setChromaKeyColor('green')}
                                            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${chromaKeyColor === 'green'
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                                : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                            <span className="text-sm font-bold">{t.greenScreen}</span>
                                            {chromaKeyColor === 'green' && <Check className="w-3.5 h-3.5 ml-auto" />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <input
                                type="checkbox"
                                id="includeText"
                                checked={includeText}
                                onChange={e => setIncludeText(e.target.checked)}
                                className="w-5 h-5 text-green-600 border-slate-300 rounded focus:ring-green-500 cursor-pointer"
                            />
                            <label htmlFor="includeText" className="text-sm font-medium text-slate-700 cursor-pointer">
                                {t.lineStickerIncludeText}
                            </label>
                        </div>

                        {includeText && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerTextLangLabel}</label>
                                    <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value as any)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                                        {Object.keys(TEXT_PRESETS).map(k => <option key={k} value={k}>{(TEXT_PRESETS as any)[k].label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerFontStyleLabel}</label>
                                    <select value={selectedFont} onChange={e => setSelectedFont(e.target.value as any)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                                        {FONT_PRESET_ORDER.map(k => <option key={k} value={k}>{FONT_PRESETS[k].label}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerPhraseStyle}</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: 'balanced', label: t.lineStickerPhraseBalanced },
                                    { id: 'emotional', label: t.lineStickerPhraseEmotional },
                                    { id: 'meme', label: t.lineStickerPhraseMeme },
                                    { id: 'interaction', label: t.lineStickerPhraseInteraction },
                                    { id: 'theme-deep', label: t.lineStickerPhraseThemeDeep },
                                ].map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => setSelectedPhraseMode(mode.id as any)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedPhraseMode === mode.id
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:border-green-200'
                                            }`}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-slate-700">{t.lineStickerPhraseListSet}</label>
                                <button onClick={handleGeneratePhrases} disabled={isGeneratingPhrases} className="text-xs text-green-600 flex items-center gap-1 font-semibold hover:text-green-700">
                                    {isGeneratingPhrases ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                    {t.lineStickerGeneratePhrases}
                                </button>
                            </div>
                            {stickerSetMode && (
                                <div className="flex gap-1 mb-2">
                                    {[0, 1, 2].map(i => (
                                        <button key={i} type="button" onClick={() => setCurrentSheetIndex(i as 0 | 1 | 2)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${currentSheetIndex === i ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'}`}>
                                            {t.lineStickerSheetN.replace('{n}', String(i + 1))}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div
                                className="gap-1.5 w-full"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${phraseGridCols}, minmax(0, 1fr))`,
                                    gridAutoRows: 'auto',
                                }}
                            >
                                {phraseGridList.map((phrase, index) => (
                                    <div key={stickerSetMode ? `s${currentSheetIndex}-${index}` : index} className="flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={phrase}
                                            onChange={e => updatePhraseAt(index, e.target.value)}
                                            placeholder={`${index + 1}`}
                                            className="w-full min-w-0 p-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none bg-white"
                                            aria-label={stickerSetMode ? `Sheet ${currentSheetIndex + 1} cell ${index + 1} phrase` : `Cell ${index + 1} phrase`}
                                        />
                                        <textarea
                                            rows={2}
                                            value={actionDescGridList[index] ?? ''}
                                            onChange={e => updateActionDescAt(index, e.target.value)}
                                            placeholder={t.lineStickerActionDescPlaceholder}
                                            className="w-full min-w-0 min-h-[3.5rem] p-1.5 border border-slate-100 rounded text-xs text-slate-500 focus:ring-2 focus:ring-green-500 outline-none bg-slate-50 resize-y"
                                            aria-label={stickerSetMode ? `Sheet ${currentSheetIndex + 1} cell ${index + 1} action` : `Cell ${index + 1} action`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Prompt preview: generate prompt first, then confirm before generating image */}
                        <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <h3 className="text-sm font-semibold text-slate-800">{t.lineStickerPromptPreviewTitle}</h3>
                                <button
                                    type="button"
                                    onClick={handleGeneratePromptPreview}
                                    className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                                >
                                    {t.lineStickerGeneratePrompt}
                                </button>
                            </div>
                            {previewPrompt ? (
                                <>
                                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-white border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto" role="region" aria-label={t.lineStickerPromptPreviewTitle}>
                                        {previewPrompt}
                                    </pre>
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <p className="text-xs text-slate-500">{t.lineStickerPromptConfirmHint}</p>
                                        <button
                                            type="button"
                                            onClick={handleCopyPrompt}
                                            className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium inline-flex items-center gap-1.5"
                                        >
                                            {promptCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                            {promptCopied ? t.lineStickerCopyPromptDone : t.lineStickerCopyPrompt}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-slate-500">{t.lineStickerPromptEmptyHint}</p>
                            )}
                        </div>
                        <button onClick={stickerSetMode ? handleGenerateAllSheets : handleGenerate} disabled={isGenerating || !sourceImage || !previewPrompt} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                            {stickerSetMode ? t.lineStickerGenerateAll : t.lineStickerGenerate}
                        </button>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900">{t.lineStickerResult}</h2>
                            {stickerSetMode && (
                                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                    {[0, 1, 2].map(i => (
                                        <button key={i} onClick={() => setCurrentSheetIndex(i as any)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${currentSheetIndex === i ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                            {t.lineStickerSheetN.replace('{n}', String(i + 1))}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {error && <div className="mb-4 p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl text-sm flex items-center gap-2 animate-in slide-in-from-top-2"><Plus className="w-5 h-5 rotate-45" />{error}</div>}
                        {statusText && <div className="mb-4 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm flex items-center gap-3"><Loader2 className="w-4 h-4 animate-spin" />{statusText}</div>}

                        {(spriteSheetImage || sheetImages[currentSheetIndex]) ? (
                            <div className="space-y-8">
                                <div className="flex flex-wrap items-center gap-2 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowOriginalInSpriteView(prev => !prev)}
                                        className={`text-xs px-3 py-1.5 rounded-lg border-2 transition-all ${showOriginalInSpriteView
                                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                    >
                                        {showOriginalInSpriteView ? t.lineStickerShowProcessed : t.lineStickerShowOriginal}
                                    </button>
                                    <button
                                        onClick={() => {
                                            const img = stickerSetMode ? (sheetImages[currentSheetIndex] ?? null) : (spriteSheetImage ?? null);
                                            if (img) {
                                                const link = document.createElement('a');
                                                link.href = img;
                                                link.download = `sprite-sheet-${stickerSetMode ? currentSheetIndex + 1 : 'single'}-original.png`;
                                                link.click();
                                            }
                                        }}
                                        disabled={stickerSetMode ? !sheetImages[currentSheetIndex] : !spriteSheetImage}
                                        className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        {t.downloadOriginal}
                                    </button>
                                    <button
                                        onClick={() => {
                                            const img = stickerSetMode ? (processedSheetImages[currentSheetIndex] ?? null) : (processedSpriteSheet ?? null);
                                            if (img) {
                                                const link = document.createElement('a');
                                                link.href = img;
                                                link.download = `sprite-sheet-${stickerSetMode ? currentSheetIndex + 1 : 'single'}-processed.png`;
                                                link.click();
                                            }
                                        }}
                                        disabled={stickerSetMode ? !processedSheetImages[currentSheetIndex] : !processedSpriteSheet}
                                        className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50"
                                    >
                                        {t.downloadProcessed}
                                    </button>
                                </div>

                                <Suspense fallback={<div className="aspect-video bg-slate-50 rounded-xl animate-pulse" />}>
                                    <SpriteSheetViewer
                                        spriteSheetImage={showOriginalInSpriteView
                                            ? (stickerSetMode ? (sheetImages[currentSheetIndex] ?? null) : spriteSheetImage)
                                            : (stickerSetMode
                                                ? (processedSheetImages[currentSheetIndex] || sheetImages[currentSheetIndex] || null)
                                                : (processedSpriteSheet || spriteSheetImage || null))}
                                        onImageLoad={handleImageLoad}
                                        isGenerating={isGenerating}
                                        sliceSettings={stickerSetMode ? { ...DEFAULT_SLICE_SETTINGS, cols: 4, rows: 4 } : { ...sliceSettings, cols: gridCols, rows: gridRows }}
                                        setSliceSettings={stickerSetMode
                                            ? () => { } // Read-only in set mode view
                                            : (val: SliceSettings | ((prev: SliceSettings) => SliceSettings)) => {
                                                if (typeof val === 'function') {
                                                    const next = val({ ...sliceSettings, cols: gridCols, rows: gridRows });
                                                    setSliceSettings(next);
                                                    setGridCols(next.cols);
                                                    setGridRows(next.rows);
                                                } else {
                                                    setSliceSettings(val);
                                                    setGridCols(val.cols);
                                                    setGridRows(val.rows);
                                                }
                                            }
                                        }
                                        chromaKeyProgress={chromaKeyProgress}
                                        isProcessingChromaKey={isProcessingChromaKey}
                                        sheetDimensions={sheetDimensions}
                                        onDownload={(isProcessed: boolean) => {
                                            const img = isProcessed
                                                ? (stickerSetMode ? processedSheetImages[currentSheetIndex] : processedSpriteSheet)
                                                : (stickerSetMode ? sheetImages[currentSheetIndex] : spriteSheetImage);
                                            if (img) {
                                                const link = document.createElement('a');
                                                link.href = img;
                                                link.download = `sprite-sheet-${isProcessed ? 'processed' : 'original'}.png`;
                                                link.click();
                                            }
                                        }}
                                    />
                                </Suspense>

                                <div className="border-t border-slate-100 pt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">{t.lineStickerPreviewCropped} <span className="text-xs font-normal text-slate-500">{t.lineStickerPreviewCropHint}</span></h3>
                                        <div className="flex gap-2">
                                            <button onClick={selectAll} className="text-xs font-semibold text-green-600 hover:text-green-700">{t.lineStickerSelectAll}</button>
                                            <button onClick={deselectAll} className="text-xs font-semibold text-slate-500 hover:text-slate-600">{t.lineStickerDeselectAll}</button>
                                        </div>
                                    </div>
                                    <Suspense fallback={<div className="grid grid-cols-4 gap-2"><div className="aspect-square bg-slate-50 animate-pulse rounded-lg" /></div>}>
                                        <FrameGrid
                                            frames={stickerSetMode ? sheetFrames[currentSheetIndex] : stickerFrames}
                                            currentFrameIndex={0}
                                            onFrameClick={() => { }}
                                            frameIncluded={stickerSetMode ? (selectedFramesBySheet[currentSheetIndex] || []) : selectedFrames}
                                            setFrameIncluded={(val: boolean[] | ((prev: boolean[]) => boolean[])) => {
                                                if (stickerSetMode) {
                                                    setSelectedFramesBySheet(prev => {
                                                        const next = prev.map(a => [...a]);
                                                        const s = typeof val === 'function' ? val(next[currentSheetIndex] || []) : val;
                                                        next[currentSheetIndex] = s;
                                                        return next;
                                                    });
                                                } else {
                                                    setSelectedFrames(val);
                                                }
                                            }}
                                            frameOverrides={stickerSetMode ? (sheetFrameOverrides[currentSheetIndex] || []) : frameOverrides}
                                            setFrameOverrides={(val: FrameOverride[] | ((prev: FrameOverride[]) => FrameOverride[])) => {
                                                if (stickerSetMode) {
                                                    setSheetFrameOverrides(prev => {
                                                        const next = prev.map(a => [...a]);
                                                        const s = typeof val === 'function' ? val(next[currentSheetIndex] || []) : val;
                                                        next[currentSheetIndex] = s;
                                                        return next;
                                                    });
                                                } else {
                                                    setFrameOverrides(val);
                                                }
                                            }}
                                            enablePerFrameEdit={true}
                                            processedSpriteSheet={stickerSetMode ? (processedSheetImages[currentSheetIndex]) : processedSpriteSheet}
                                            sliceSettings={stickerSetMode ? { ...DEFAULT_SLICE_SETTINGS, cols: 4, rows: 4 } : { ...sliceSettings, cols: gridCols, rows: gridRows }}
                                            sheetDimensions={sheetDimensions}
                                        />
                                    </Suspense>
                                </div>

                                <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    {stickerSetMode ? (
                                        <div className="flex flex-wrap gap-2 w-full">
                                            <button onClick={downloadSetOneClick} disabled={isDownloading || (!processedSheetImages.every(img => !!img) && !sheetFrames.some(arr => arr.length > 0))} className="px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 transition-all shadow-md"><Download className="w-4 h-4" />{t.lineStickerDownloadAllOneClick}</button>
                                            <button onClick={downloadStickerSetZip} disabled={isDownloading || !processedSheetImages.every(img => !!img)} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md"><FileArchive className="w-4 h-4" />{t.lineStickerDownload3Zip}</button>
                                            <button onClick={downloadAllSheetsFramesZip} disabled={isDownloading || !sheetFrames.some(arr => arr.length > 0)} className="px-5 py-2.5 bg-slate-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-slate-600 disabled:opacity-50 transition-all shadow-md"><FileArchive className="w-4 h-4" />{t.lineStickerDownload3SheetsFramesZip}</button>
                                            <button onClick={downloadCurrentSheetZip} disabled={isDownloading || !processedSheetImages[currentSheetIndex]} className="px-5 py-2.5 bg-green-500 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-green-600 disabled:opacity-50 transition-all shadow-md"><Download className="w-4 h-4" />{t.lineStickerDownloadCurrentSheet}</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 w-full">
                                            <button onClick={downloadAllAsZip} disabled={isDownloading || stickerFrames.length === 0} className="px-5 py-2.5 bg-green-500 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-green-600 disabled:opacity-50 transition-all shadow-md"><Download className="w-4 h-4" />{t.lineStickerDownloadAll}</button>
                                            <button onClick={() => downloadSelectedAsZip(selectedIndices)} disabled={isDownloading || selectedCount === 0} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"><Check className="w-4 h-4" />{t.lineStickerDownloadSelected.replace('{n}', String(selectedCount))}</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-3xl">
                                <ImageIcon className="w-20 h-20 mb-4 opacity-10" />
                                <p className="text-sm font-medium">{t.spriteSheetPlaceholder}</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LineStickerPage;
