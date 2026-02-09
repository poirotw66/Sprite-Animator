import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, Upload, Loader2, Download, Check, Image, FileArchive } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { SettingsModal } from '../components/SettingsModal';
import { useSettings } from '../hooks/useSettings';
import { generateSpriteSheet } from '../services/geminiService';
import { sliceSpriteSheet } from '../utils/imageUtils';
import JSZip from 'jszip';

type ImageFormat = 'png' | 'jpg';

const LineStickerPage: React.FC = () => {
    const { t } = useLanguage();
    const {
        apiKey,
        setApiKey,
        selectedModel,
        setSelectedModel,
        showSettings,
        setShowSettings,
        saveSettings,
        getEffectiveApiKey,
    } = useSettings();

    // Image upload state
    const [sourceImage, setSourceImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Grid settings
    const [gridCols, setGridCols] = useState(4);
    const [gridRows, setGridRows] = useState(2);

    // Prompt
    const [prompt, setPrompt] = useState('');

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [spriteSheetImage, setSpriteSheetImage] = useState<string | null>(null);
    const [stickerFrames, setStickerFrames] = useState<string[]>([]);

    // Selection state for batch download
    const [selectedFrames, setSelectedFrames] = useState<boolean[]>([]);
    const [downloadFormat, setDownloadFormat] = useState<ImageFormat>('png');
    const [isDownloading, setIsDownloading] = useState(false);

    // Image upload handler
    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setSourceImage(event.target?.result as string);
                setSpriteSheetImage(null);
                setStickerFrames([]);
                setSelectedFrames([]);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setSourceImage(event.target?.result as string);
                setSpriteSheetImage(null);
                setStickerFrames([]);
                setSelectedFrames([]);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    // Generate sprite sheet
    const handleGenerate = useCallback(async () => {
        const effectiveKey = getEffectiveApiKey();

        if (!effectiveKey) {
            setShowSettings(true);
            setError(t.errorApiKey);
            return;
        }

        if (!sourceImage) {
            setError(t.errorNoImage);
            return;
        }

        if (!prompt.trim()) {
            setError(t.errorNoPrompt);
            return;
        }

        setIsGenerating(true);
        setError(null);
        setStatusText(t.statusIdle);
        setSpriteSheetImage(null);
        setStickerFrames([]);
        setSelectedFrames([]);

        try {
            setStatusText(`${t.statusPreparing} (${t.statusUsingModel}: ${selectedModel})...`);

            // Generate sprite sheet using the same service as Sprite Animator
            const sheetImage = await generateSpriteSheet(
                sourceImage,
                prompt,
                gridCols,
                gridRows,
                effectiveKey,
                selectedModel,
                (status) => setStatusText(status),
                'magenta' // Default chroma key color
            );

            setSpriteSheetImage(sheetImage);

            // Slice the sprite sheet into individual stickers
            setStatusText(t.statusOptimizing);
            const frames = await sliceSpriteSheet(
                sheetImage,
                gridCols,
                gridRows,
                0, 0, 0, 0, // No padding or shift
                true, // Remove background
                230,
                undefined,
                'magenta'
            );

            setStickerFrames(frames);
            setSelectedFrames(new Array(frames.length).fill(false));
            setStatusText('');
        } catch (err: unknown) {
            const rawMsg = err instanceof Error ? err.message : 'Unknown error';
            let displayMsg = t.errorGeneration;

            if (
                rawMsg.includes('429') ||
                rawMsg.includes('Quota') ||
                rawMsg.includes('RESOURCE_EXHAUSTED')
            ) {
                displayMsg = t.errorRateLimit;
            } else {
                displayMsg = `${t.errorGeneration}: ${rawMsg}`;
            }

            setError(displayMsg);
        } finally {
            setIsGenerating(false);
        }
    }, [
        t,
        getEffectiveApiKey,
        sourceImage,
        prompt,
        gridCols,
        gridRows,
        selectedModel,
        setShowSettings,
    ]);

    // Toggle frame selection
    const toggleFrameSelection = useCallback((index: number) => {
        setSelectedFrames((prev) => {
            const newSelection = [...prev];
            newSelection[index] = !newSelection[index];
            return newSelection;
        });
    }, []);

    // Select/Deselect all
    const selectAll = useCallback(() => {
        setSelectedFrames(new Array(stickerFrames.length).fill(true));
    }, [stickerFrames.length]);

    const deselectAll = useCallback(() => {
        setSelectedFrames(new Array(stickerFrames.length).fill(false));
    }, [stickerFrames.length]);

    // Convert base64 to specified format
    const convertToFormat = useCallback(async (base64: string, format: ImageFormat): Promise<Blob> => {
        return new Promise((resolve) => {
            const img = document.createElement('img');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d')!;

                if (format === 'jpg') {
                    // Fill white background for JPG
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    resolve(blob!);
                }, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
            };
            img.src = base64;
        });
    }, []);

    // Download single image
    const downloadSingle = useCallback(async (index: number) => {
        const frame = stickerFrames[index];
        if (!frame) return;

        const blob = await convertToFormat(frame, downloadFormat);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sticker_${String(index + 1).padStart(2, '0')}.${downloadFormat}`;
        a.click();
        URL.revokeObjectURL(url);
    }, [stickerFrames, downloadFormat, convertToFormat]);

    // Download selected as ZIP
    const downloadSelectedAsZip = useCallback(async () => {
        const selectedIndices = selectedFrames
            .map((selected, index) => (selected ? index : -1))
            .filter((index) => index !== -1);

        if (selectedIndices.length === 0) {
            setError('Please select at least one sticker to download');
            return;
        }

        setIsDownloading(true);
        try {
            const zip = new JSZip();

            for (let i = 0; i < selectedIndices.length; i++) {
                const frameIndex = selectedIndices[i];
                const frame = stickerFrames[frameIndex];
                const blob = await convertToFormat(frame, downloadFormat);
                zip.file(`sticker_${String(frameIndex + 1).padStart(2, '0')}.${downloadFormat}`, blob);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `line_stickers_${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(t.errorExportZip);
        } finally {
            setIsDownloading(false);
        }
    }, [selectedFrames, stickerFrames, downloadFormat, convertToFormat, t]);

    // Download all as ZIP
    const downloadAllAsZip = useCallback(async () => {
        if (stickerFrames.length === 0) return;

        setIsDownloading(true);
        try {
            const zip = new JSZip();

            for (let i = 0; i < stickerFrames.length; i++) {
                const frame = stickerFrames[i];
                const blob = await convertToFormat(frame, downloadFormat);
                zip.file(`sticker_${String(i + 1).padStart(2, '0')}.${downloadFormat}`, blob);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `line_stickers_all_${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(t.errorExportZip);
        } finally {
            setIsDownloading(false);
        }
    }, [stickerFrames, downloadFormat, convertToFormat, t]);

    const hasCustomKey = !!apiKey.trim();
    const selectedCount = selectedFrames.filter(Boolean).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 font-sans overflow-x-hidden px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:px-6 lg:px-8 md:pt-6 lg:pt-8 md:pb-6 lg:pb-8">
            <SettingsModal
                apiKey={apiKey}
                setApiKey={setApiKey}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                showSettings={showSettings}
                onClose={() => setShowSettings(false)}
                onSave={saveSettings}
            />

            {/* Header */}
            <header className="sticky top-0 z-20 max-w-7xl mx-auto mb-4 md:mb-8 -mx-4 px-4 md:mx-0 md:px-0 safe-top">
                <div className="bg-white/95 backdrop-blur-md rounded-xl md:rounded-2xl shadow-sm border border-slate-200/60 p-3 sm:p-4 md:p-5 flex items-center justify-between gap-2 safe-left safe-right">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Link
                            to="/"
                            className="min-h-[44px] min-w-[44px] p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 bg-white rounded-xl transition-all duration-200 shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md cursor-pointer flex items-center justify-center touch-manipulation"
                            title={t.backToHome}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3 truncate">
                            <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-1.5 sm:p-2 rounded-lg md:rounded-xl shadow-md flex-shrink-0">
                                <Image className="w-5 h-5 md:w-6 md:h-6 text-white" />
                            </div>
                            <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                                {t.lineStickerTitle}
                            </span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <LanguageSwitcher />
                        <button
                            onClick={() => setShowSettings(true)}
                            className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl transition-all duration-200 shadow-sm border flex items-center justify-center gap-2 cursor-pointer touch-manipulation
                ${hasCustomKey
                                    ? 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200 hover:shadow-md'
                                    : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-md'
                                }`}
                            title={hasCustomKey ? t.useCustomKey : t.useSystemKey}
                            aria-label={t.settings}
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                {/* Left Panel - Upload & Settings */}
                <div className="lg:col-span-5 space-y-4 sm:space-y-5 md:space-y-6">
                    {/* Image Upload */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 md:p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">{t.lineStickerUploadTitle}</h2>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className={`relative w-full aspect-square max-h-[300px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden
                ${sourceImage ? 'border-green-300 bg-green-50/30' : 'border-slate-300 hover:border-green-400 bg-slate-50 hover:bg-green-50/20'}`}
                        >
                            {sourceImage ? (
                                <img src={sourceImage} alt="Source" className="w-full h-full object-contain" />
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                                    <p className="text-slate-600 font-medium">{t.lineStickerUploadHint}</p>
                                    <p className="text-slate-400 text-sm mt-1">{t.uploadFormats}</p>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Generation Settings */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 md:p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">{t.lineStickerGridSettings}</h2>

                        {/* Prompt */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                {t.lineStickerPromptLabel}
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder={t.lineStickerPromptPlaceholder}
                                className="w-full h-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none"
                            />
                        </div>

                        {/* Grid Settings */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {t.gridCols}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={8}
                                    value={gridCols}
                                    onChange={(e) => setGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {t.gridRows}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={8}
                                    value={gridRows}
                                    onChange={(e) => setGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Total stickers info */}
                        <p className="text-sm text-slate-500 mb-4">
                            {t.totalFrames}: <span className="font-semibold text-slate-700">{gridCols * gridRows}</span>
                        </p>

                        {/* Error display */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Status display */}
                        {statusText && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {statusText}
                            </div>
                        )}

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !sourceImage}
                            className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {t.lineStickerGenerating}
                                </>
                            ) : (
                                <>
                                    <Image className="w-5 h-5" />
                                    {t.lineStickerGenerate}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Panel - Results */}
                <div className="lg:col-span-7 space-y-4 sm:space-y-5 md:space-y-6">
                    {/* Sticker Grid */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 md:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900">{t.lineStickerResult}</h2>
                            {stickerFrames.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={selectAll}
                                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                                    >
                                        {t.lineStickerSelectAll}
                                    </button>
                                    <button
                                        onClick={deselectAll}
                                        className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                        {t.lineStickerDeselectAll}
                                    </button>
                                </div>
                            )}
                        </div>

                        {stickerFrames.length > 0 ? (
                            <>
                                {/* Sticker grid */}
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-3 mb-6">
                                    {stickerFrames.map((frame, index) => (
                                        <div
                                            key={index}
                                            onClick={() => toggleFrameSelection(index)}
                                            className={`relative aspect-square rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-200 group
                        ${selectedFrames[index]
                                                    ? 'border-green-500 ring-2 ring-green-500/20 bg-green-50'
                                                    : 'border-slate-200 hover:border-green-300 bg-white'}`}
                                        >
                                            <img src={frame} alt={`Sticker ${index + 1}`} className="w-full h-full object-contain p-1" />

                                            {/* Selection indicator */}
                                            <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all
                        ${selectedFrames[index]
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-white/80 border border-slate-300 text-transparent group-hover:border-green-400'}`}
                                            >
                                                <Check className="w-4 h-4" />
                                            </div>

                                            {/* Sticker number */}
                                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-white text-xs font-medium">
                                                {index + 1}
                                            </div>

                                            {/* Individual download button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    downloadSingle(index);
                                                }}
                                                className="absolute bottom-1 right-1 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                title={t.lineStickerDownloadSingle}
                                            >
                                                <Download className="w-3.5 h-3.5 text-slate-600" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Download options */}
                                <div className="border-t border-slate-200 pt-4">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        {/* Format selector */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm font-medium text-slate-700">{t.lineStickerFormatLabel}:</label>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setDownloadFormat('png')}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                            ${downloadFormat === 'png'
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                >
                                                    PNG
                                                </button>
                                                <button
                                                    onClick={() => setDownloadFormat('jpg')}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                            ${downloadFormat === 'jpg'
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                >
                                                    JPG
                                                </button>
                                            </div>
                                        </div>

                                        {/* Selected count */}
                                        {selectedCount > 0 && (
                                            <span className="text-sm text-green-600 font-medium">
                                                {t.lineStickerSelected}: {selectedCount}
                                            </span>
                                        )}

                                        {/* Download buttons */}
                                        <div className="flex gap-2 ml-auto">
                                            <button
                                                onClick={downloadSelectedAsZip}
                                                disabled={selectedCount === 0 || isDownloading}
                                                className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                {isDownloading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <FileArchive className="w-4 h-4" />
                                                )}
                                                {t.lineStickerDownloadZip}
                                            </button>
                                            <button
                                                onClick={downloadAllAsZip}
                                                disabled={isDownloading}
                                                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center gap-2"
                                            >
                                                {isDownloading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Download className="w-4 h-4" />
                                                )}
                                                {t.lineStickerDownloadAll}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="aspect-video flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                <Image className="w-12 h-12 mb-3 opacity-50" />
                                <p className="text-sm">{t.spriteSheetPlaceholder}</p>
                            </div>
                        )}
                    </div>

                    {/* Sprite Sheet Preview (if generated) */}
                    {spriteSheetImage && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 md:p-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">{t.spriteSheetTitle}</h2>
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-[length:20px_20px]" style={{
                                backgroundImage: `linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
                  linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                  linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)`,
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                            }}>
                                <img src={spriteSheetImage} alt="Sprite Sheet" className="w-full h-auto" />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default LineStickerPage;
