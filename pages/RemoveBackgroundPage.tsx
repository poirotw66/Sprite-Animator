import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Download, Loader2, Eraser, Sliders, ArrowLeft, Image as ImageIcon, Check, RefreshCw, Settings } from '../components/Icons';
import { useLanguage } from '../hooks/useLanguage';
import { SettingsModal } from '../components/SettingsModal';
import { useSettings } from '../hooks/useSettings';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { removeChromaKeyWithWorker } from '../utils/chromaKeyProcessor';
import { removeBackgroundAI } from '../utils/aiBackgroundRemoval';
import { CHROMA_KEY_COLORS, CHROMA_KEY_FUZZ, GRID_PATTERN_URL } from '../utils/constants';
import { logger } from '../utils/logger';
import { Link } from 'react-router-dom';
import type { ChromaKeyColorType, BgRemovalMethod } from '../types';

const RemoveBackgroundPage: React.FC = () => {
    const { t } = useLanguage();

    // State
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [chromaKeyColor, setChromaKeyColor] = useState<ChromaKeyColorType>('magenta');
    const [tolerance, setTolerance] = useState<number>(CHROMA_KEY_FUZZ);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [showOriginal, setShowOriginal] = useState(false);
    const [bgRemovalMethod, setBgRemovalMethod] = useState<BgRemovalMethod>('chroma');

    const {
        apiKey,
        setApiKey,
        selectedModel,
        setSelectedModel,
        hfToken,
        setHfToken,
        showSettings,
        setShowSettings,
        saveSettings,
    } = useSettings();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle file selection
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setOriginalImage(result);
            setProcessedImage(null);
            setError(null);
            setProgress(0);
        };
        reader.readAsDataURL(file);
    }, []);

    // Handle background removal
    const handleProcess = useCallback(async () => {
        if (!originalImage) return;

        setIsProcessing(true);
        setProgress(0);
        setError(null);

        try {
            let result: string;
            if (bgRemovalMethod === 'ai') {
                result = await removeBackgroundAI(originalImage, chromaKeyColor);
            } else {
                const targetColor = CHROMA_KEY_COLORS[chromaKeyColor];
                result = await removeChromaKeyWithWorker(
                    originalImage,
                    targetColor,
                    tolerance,
                    (p) => setProgress(p)
                );
            }
            setProcessedImage(result);
            setShowOriginal(false);
        } catch (err: any) {
            logger.error('Background removal failed', err);
            setError(err.message || 'Processing failed');
        } finally {
            setIsProcessing(false);
        }
    }, [originalImage, chromaKeyColor, tolerance, bgRemovalMethod]);

    // Handle download
    const handleDownload = useCallback(() => {
        if (!processedImage) return;
        const link = document.createElement('a');
        link.href = processedImage;
        link.download = `removed_bg_${Date.now()}.png`;
        link.click();
    }, [processedImage]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Navbar */}
            <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link
                        to="/"
                        className="flex items-center gap-2 text-slate-600 hover:text-orange-600 transition-colors font-medium text-sm group"
                    >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </div>
                        {t.backToHome}
                    </Link>
                    <h1 className="text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent flex items-center gap-2">
                        <Eraser className="w-5 h-5 text-orange-500" />
                        {t.rmbgTitle}
                    </h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                            aria-label={t.settings}
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        <LanguageSwitcher />
                    </div>
                </div>
            </nav>

            <SettingsModal
                apiKey={apiKey}
                setApiKey={setApiKey}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                showSettings={showSettings}
                onClose={() => setShowSettings(false)}
                onSave={saveSettings}
                hfToken={hfToken}
                setHfToken={setHfToken}
            />

            {/* Main Content */}
            <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

                    {/* Settings Section */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6 sticky top-24">
                            <div className="space-y-2">
                                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-orange-500" />
                                    {t.settings}
                                </h2>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    {t.rmbgDesc}
                                </p>
                            </div>

                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">{t.bgRemovalMethodLabel}</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setBgRemovalMethod('chroma')}
                                            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${bgRemovalMethod === 'chroma'
                                                ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                                                : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                                }`}
                                        >
                                            <span className="text-sm font-bold">{t.bgRemovalChroma}</span>
                                        </button>
                                        <button
                                            onClick={() => setBgRemovalMethod('ai')}
                                            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${bgRemovalMethod === 'ai'
                                                ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                                                : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                                }`}
                                        >
                                            <span className="text-sm font-bold">{t.bgRemovalAI}</span>
                                        </button>
                                    </div>
                                </div>

                                {bgRemovalMethod === 'chroma' && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-sm font-semibold text-slate-700 block">
                                            {t.rmbgChromaKeyLabel}
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setChromaKeyColor('magenta')}
                                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${chromaKeyColor === 'magenta'
                                                    ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-sm'
                                                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                                    }`}
                                            >
                                                <div className="w-4 h-4 rounded-full bg-fuchsia-500" />
                                                <span className="text-sm font-bold">{t.magentaColor}</span>
                                                {chromaKeyColor === 'magenta' && <Check className="w-3.5 h-3.5 ml-auto" />}
                                            </button>
                                            <button
                                                onClick={() => setChromaKeyColor('green')}
                                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${chromaKeyColor === 'green'
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                                    }`}
                                            >
                                                <div className="w-4 h-4 rounded-full bg-emerald-500" />
                                                <span className="text-sm font-bold">{t.greenScreen}</span>
                                                {chromaKeyColor === 'green' && <Check className="w-3.5 h-3.5 ml-auto" />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tolerance Selector */}
                            {bgRemovalMethod === 'chroma' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-slate-700">
                                            {t.rmbgToleranceLabel}
                                        </label>
                                        <span className="text-xs font-mono font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-100">
                                            {tolerance}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        step="5"
                                        value={tolerance}
                                        onChange={(e) => setTolerance(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                        <span>Strict</span>
                                        <span>Loose</span>
                                    </div>
                                </div>
                            )}

                            {/* Process Button */}
                            <button
                                onClick={handleProcess}
                                disabled={!originalImage || isProcessing}
                                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg transition-all transform active:scale-[0.98] ${!originalImage || isProcessing
                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200 shadow-none'
                                    : 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:shadow-orange-200 hover:-translate-y-0.5'
                                    }`}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>{progress}% ...</span>
                                    </>
                                ) : (
                                    <>
                                        <Eraser className="w-5 h-5" />
                                        <span>{t.rmbgProcessButton}</span>
                                    </>
                                )}
                            </button>

                            {/* Error Message */}
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                                    <p className="text-xs text-red-600 font-medium text-center">{error}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview Section */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-[500px] overflow-hidden">
                            {/* Preview Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                                        <ImageIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800">Preview</h3>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                                            {originalImage ? (showOriginal ? 'Original Image' : 'Processed Result') : 'No Image Uploaded'}
                                        </p>
                                    </div>
                                </div>

                                {processedImage && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowOriginal(!showOriginal)}
                                            className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all border ${showOriginal
                                                ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {showOriginal ? 'Original' : 'Show Original'}
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="text-xs px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-full font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            {t.rmbgDownloadProcessed}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Preview Area */}
                            <div className="flex-1 p-6 flex flex-col">
                                <div
                                    className="flex-1 bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group min-h-[300px]"
                                    style={!showOriginal && (processedImage || isProcessing) ? { backgroundImage: `url(${GRID_PATTERN_URL})`, backgroundSize: '20px' } : {}}
                                >
                                    {!originalImage && (
                                        <div
                                            className="text-center p-8 cursor-pointer w-full h-full flex flex-col items-center justify-center gap-4 hover:bg-slate-50 transition-colors group"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <div className="w-16 h-16 rounded-3xl bg-orange-50 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                                <Upload className="w-8 h-8 text-orange-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="font-bold text-slate-700">{t.rmbgUploadTitle}</p>
                                                <p className="text-sm text-slate-400">{t.rmbgUploadHint}</p>
                                            </div>
                                        </div>
                                    )}

                                    {originalImage && (
                                        <img
                                            src={showOriginal ? originalImage : (processedImage || originalImage)}
                                            alt="Preview"
                                            className={`max-w-full max-h-[600px] object-contain shadow-2xl rounded-lg ${!showOriginal && (processedImage || isProcessing) ? 'pixelated' : ''} ${isProcessing ? 'opacity-50 grayscale blur-[2px]' : ''}`}
                                        />
                                    )}

                                    {isProcessing && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[1px]">
                                            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3 border border-orange-100">
                                                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-slate-800">{t.rmbgProcessing}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{progress}%</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {originalImage && (
                                    <div className="mt-4 flex items-center justify-center gap-4">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors flex items-center gap-1.5"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Change Image
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
};

export default RemoveBackgroundPage;
