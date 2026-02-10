import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, Upload, Loader2, Download, Check, Image, FileArchive } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { SettingsModal } from '../components/SettingsModal';
import { useSettings } from '../hooks/useSettings';
import { generateSpriteSheet, generateStickerPhrases } from '../services/geminiService';
import { FrameGrid } from '../components/FrameGrid';
import { SpriteSheetViewer } from '../components/SpriteSheetViewer';
import { sliceSpriteSheet, SliceSettings, getEffectivePadding, FrameOverride } from '../utils/imageUtils';
import { removeChromaKeyWithWorker } from '../utils/chromaKeyProcessor';
import { ChromaKeyColorType } from '../types';
import { CHROMA_KEY_COLORS, CHROMA_KEY_FUZZ, GRID_PATTERN_URL, DEFAULT_SLICE_SETTINGS, MODEL_RESOLUTIONS, type ImageResolution, type StickerPhraseMode } from '../utils/constants';
import JSZip from 'jszip';
import {
    buildLineStickerPrompt,
    DEFAULT_CHARACTER_SLOT,
    DEFAULT_THEME_SLOT,
    DEFAULT_TEXT_SLOT,
    THEME_PRESETS,
    STYLE_PRESETS,
    TEXT_PRESETS,
    TEXT_COLOR_PRESETS,
    FONT_PRESETS,
    type PromptSlots,
} from '../utils/lineStickerPrompt';

type ImageFormat = 'png' | 'jpg';

/** Theme selection: preset key or custom */
type ThemeOption = keyof typeof THEME_PRESETS | 'custom';

/** Sticker set: 3 sheets × 16 frames = 48 phrases, no repeat */
const SET_PHRASES_COUNT = 48;
const SHEETS_COUNT = 3;
const FRAMES_PER_SHEET = 16;

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
    const [gridRows, setGridRows] = useState(4);

    // Advanced Slicing State
    const [sliceSettings, setSliceSettings] = useState<SliceSettings>(DEFAULT_SLICE_SETTINGS);
    const [sheetDimensions, setSheetDimensions] = useState({ width: 0, height: 0 });
    const [frameOverrides, setFrameOverrides] = useState<FrameOverride[]>([]);

    // Chroma key progress for SpriteSheetViewer
    const [chromaKeyProgress, setChromaKeyProgress] = useState(0);
    const [isProcessingChromaKey, setIsProcessingChromaKey] = useState(false);

    // Wrapper to sync grid inputs when SliceSettings change in viewer
    const handleSliceSettingsChange: React.Dispatch<React.SetStateAction<SliceSettings>> = useCallback((value) => {
        setSliceSettings((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;

            // Sync simple grid inputs if cols/rows changed in advanced settings
            if (next.cols !== gridCols) setGridCols(next.cols);
            if (next.rows !== gridRows) setGridRows(next.rows);

            return next;
        });
    }, [gridCols, gridRows]);

    // Sticker description (user input for character appearance/personality)
    const [stickerDescription, setStickerDescription] = useState('');

    // Prompt slot settings
    const [selectedStyle, setSelectedStyle] = useState<keyof typeof STYLE_PRESETS>('chibi');
    const [selectedTheme, setSelectedTheme] = useState<ThemeOption>('trpg');
    const [customThemeContext, setCustomThemeContext] = useState<string>('');
    const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof TEXT_PRESETS>('zh-TW');
    const [selectedTextColor, setSelectedTextColor] = useState<keyof typeof TEXT_COLOR_PRESETS>('black');
    const [selectedFont, setSelectedFont] = useState<keyof typeof FONT_PRESETS>('handwritten');
    const [customPhrases, setCustomPhrases] = useState<string>('');
    const [isGeneratingPhrases, setIsGeneratingPhrases] = useState(false);

    // Sticker set mode (3 sheets × 16 = 48 phrases, no repeat)
    const [stickerSetMode, setStickerSetMode] = useState(false);
    const [setPhrasesList, setSetPhrasesList] = useState<string[]>([]);
    const [sheetImages, setSheetImages] = useState<(string | null)[]>(() => [null, null, null]);
    const [processedSheetImages, setProcessedSheetImages] = useState<(string | null)[]>(() => [null, null, null]);
    const [sheetFrames, setSheetFrames] = useState<string[][]>(() => [[], [], []]);
    const [sheetFrameOverrides, setSheetFrameOverrides] = useState<FrameOverride[][]>(() => [[], [], []]);
    const [selectedFramesBySheet, setSelectedFramesBySheet] = useState<boolean[][]>(() => [[], [], []]);
    const [currentSheetIndex, setCurrentSheetIndex] = useState<0 | 1 | 2>(0);

    // Initialize phrases with default theme on mount
    React.useEffect(() => {
        const themePhrases = THEME_PRESETS[selectedTheme].examplePhrases.join('\n');
        setCustomPhrases(themePhrases);
    }, []); // Only run once on mount

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [spriteSheetImage, setSpriteSheetImage] = useState<string | null>(null);
    const [processedSpriteSheet, setProcessedSpriteSheet] = useState<string | null>(null);
    const [stickerFrames, setStickerFrames] = useState<string[]>([]);



    // Selection state for batch download
    const [selectedFrames, setSelectedFrames] = useState<boolean[]>([]);
    const [downloadFormat, setDownloadFormat] = useState<ImageFormat>('png');
    const [isDownloading, setIsDownloading] = useState(false);

    // Chroma key color for background removal
    const [chromaKeyColor, setChromaKeyColor] = useState<ChromaKeyColorType>('magenta');

    // Output resolution (1K / 2K / 4K; depends on model)
    const [selectedResolution, setSelectedResolution] = useState<ImageResolution>('1K');
    // Phrase generation mode for LINE sticker text
    const [selectedPhraseMode, setSelectedPhraseMode] = useState<StickerPhraseMode>('balanced');
    const resolutionOptions: ImageResolution[] = MODEL_RESOLUTIONS[selectedModel] ?? ['1K'];
    React.useEffect(() => {
        const allowed = MODEL_RESOLUTIONS[selectedModel] ?? ['1K'];
        if (!allowed.includes(selectedResolution)) setSelectedResolution(allowed[0]);
    }, [selectedModel]);

    // Re-slice effect
    React.useEffect(() => {
        if (!processedSpriteSheet || !sheetDimensions.width || !sheetDimensions.height) return;

        const performSlice = async () => {
            try {
                // Ensure slice settings match grid dimensions if they differ
                // (This syncs the simple grid inputs with the advanced slice settings)
                const currentSettings = { ...sliceSettings };
                if (currentSettings.cols !== gridCols || currentSettings.rows !== gridRows) {
                    currentSettings.cols = gridCols;
                    currentSettings.rows = gridRows;
                    // Don't update state here to avoid loops, just use for calculation
                }

                const frames = await sliceSpriteSheet(
                    processedSpriteSheet,
                    currentSettings.cols,
                    currentSettings.rows,
                    currentSettings.paddingX,
                    currentSettings.paddingY,
                    currentSettings.shiftX,
                    currentSettings.shiftY,
                    false, // Already transparent
                    230,
                    frameOverrides,
                    chromaKeyColor,
                    getEffectivePadding(currentSettings)
                );
                setStickerFrames(frames);
                // Initialize selection state if length changed
                if (frames.length !== stickerFrames.length) {
                    setSelectedFrames(new Array(frames.length).fill(false));
                }
                setStatusText('');
            } catch (err) {
                console.error('Slicing failed:', err);
                setError(t.errorGeneration); // Generic error
                setStatusText('');
            }
        };

        const timer = setTimeout(performSlice, 100);
        return () => clearTimeout(timer);
    }, [processedSpriteSheet, sliceSettings, frameOverrides, gridCols, gridRows, chromaKeyColor, sheetDimensions, stickerFrames.length, t.errorGeneration]);

    // Re-slice current sheet when frame overrides change (sticker set mode only)
    React.useEffect(() => {
        if (!stickerSetMode) return;
        const processed = processedSheetImages[currentSheetIndex];
        if (!processed || !sheetDimensions.width || !sheetDimensions.height) return;

        const settings = { ...DEFAULT_SLICE_SETTINGS, cols: 4, rows: 4 };
        const overrides = sheetFrameOverrides[currentSheetIndex] ?? [];

        let cancelled = false;
        const run = async () => {
            try {
                const frames = await sliceSpriteSheet(
                    processed,
                    settings.cols,
                    settings.rows,
                    settings.paddingX,
                    settings.paddingY,
                    settings.shiftX,
                    settings.shiftY,
                    false,
                    230,
                    overrides,
                    chromaKeyColor,
                    getEffectivePadding(settings)
                );
                if (!cancelled) {
                    setSheetFrames((prev) => {
                        const next = prev.map((arr) => [...arr]);
                        next[currentSheetIndex] = frames;
                        return next;
                    });
                }
            } catch (err) {
                if (!cancelled) console.error('Set mode re-slice failed:', err);
            }
        };
        const timer = setTimeout(run, 100);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [stickerSetMode, currentSheetIndex, processedSheetImages, sheetFrameOverrides, sheetDimensions, chromaKeyColor]);

    // Handle image load to get dimensions
    const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setSheetDimensions({ width: naturalWidth, height: naturalHeight });
    }, []);

    // Build full prompt using slot structure. phraseListOverride: when in sticker set mode, pass the 16 phrases for that sheet.
    const buildFullPrompt = useCallback((
        description: string,
        cols: number,
        rows: number,
        bgColor: ChromaKeyColorType,
        phraseListOverride?: string[]
    ) => {
        // Build character slot from user description
        const characterSlot = description.trim()
            ? {
                  ...DEFAULT_CHARACTER_SLOT,
                  appearance: description.trim(),
              }
            : DEFAULT_CHARACTER_SLOT;

        // Build theme slot (use preset or custom phrases, or override for set mode)
        const customPhrasesList = phraseListOverride !== undefined
            ? phraseListOverride
            : customPhrases.trim()
                ? customPhrases
                      .split('\n')
                      .map((line) => line.trim())
                      .filter((line) => line.length > 0)
                : [];
        
        const themeSlot =
            selectedTheme === 'custom'
                ? {
                      chatContext: customThemeContext.trim() || '自訂聊天主題',
                      examplePhrases: customPhrasesList,
                  }
                : customPhrasesList.length > 0
                  ? {
                        ...THEME_PRESETS[selectedTheme],
                        examplePhrases: customPhrasesList,
                        specialStickers: undefined,
                    }
                  : { ...THEME_PRESETS[selectedTheme], specialStickers: undefined };

        // Build text slot from selected language + user text color & font
        const textSlot: PromptSlots['text'] = {
            ...TEXT_PRESETS[selectedLanguage],
            textColor: TEXT_COLOR_PRESETS[selectedTextColor].promptDesc,
            textStyle: FONT_PRESETS[selectedFont].promptDesc,
        };

        // Build style slot from preset (omit label for prompt)
        const { label: _styleLabel, ...styleSlot } = STYLE_PRESETS[selectedStyle];

        // Combine all slots
        const slots: PromptSlots = {
            style: styleSlot,
            character: characterSlot,
            theme: themeSlot,
            text: textSlot,
        };

        // Build the complete prompt
        return buildLineStickerPrompt(slots, cols, rows, bgColor);
    }, [selectedStyle, selectedTheme, customThemeContext, selectedLanguage, selectedTextColor, selectedFont, customPhrases]);

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

    // Slice a processed sheet image into frames (4×4). Used for sticker set mode.
    const sliceProcessedSheetToFrames = useCallback(async (processedImage: string): Promise<string[]> => {
        const settings = { ...DEFAULT_SLICE_SETTINGS, cols: 4, rows: 4 };
        return sliceSpriteSheet(
            processedImage,
            settings.cols,
            settings.rows,
            settings.paddingX,
            settings.paddingY,
            settings.shiftX,
            settings.shiftY,
            false,
            230,
            [],
            chromaKeyColor,
            getEffectivePadding(settings)
        );
    }, [chromaKeyColor]);

    // Generate sprite sheet (single mode) or current sheet only (sticker set mode)
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

        if (stickerSetMode) {
            if (setPhrasesList.length < FRAMES_PER_SHEET) {
                setError(`請先產生 48 句短語（目前 ${setPhrasesList.length} 句）`);
                return;
            }
            const sheetIndex = currentSheetIndex;
            const phraseSlice = setPhrasesList.slice(sheetIndex * FRAMES_PER_SHEET, (sheetIndex + 1) * FRAMES_PER_SHEET);
            const fullPrompt = buildFullPrompt(stickerDescription, 4, 4, chromaKeyColor, phraseSlice);

            setIsGenerating(true);
            setError(null);
            setStatusText(`正在產生第 ${sheetIndex + 1} 張...`);

            try {
                const sheetImage = await generateSpriteSheet(
                    sourceImage,
                    fullPrompt,
                    4,
                    4,
                    effectiveKey,
                    selectedModel,
                    (status) => setStatusText(status),
                    chromaKeyColor,
                    selectedResolution
                );

                setSheetImages((prev) => {
                    const next = [...prev];
                    next[sheetIndex] = sheetImage;
                    return next;
                });

                setStatusText(t.statusProcessing);
                setIsProcessingChromaKey(true);
                const activeChromaKeyColor = CHROMA_KEY_COLORS[chromaKeyColor];
                const processedImage = await removeChromaKeyWithWorker(
                    sheetImage,
                    activeChromaKeyColor,
                    CHROMA_KEY_FUZZ,
                    (p) => setStatusText(`${t.statusProcessing} (${p}%)`)
                );
                setIsProcessingChromaKey(false);

                setProcessedSheetImages((prev) => {
                    const next = [...prev];
                    next[sheetIndex] = processedImage;
                    return next;
                });

                const frames = await sliceProcessedSheetToFrames(processedImage);
                setSheetFrames((prev) => {
                    const next = [...prev];
                    next[sheetIndex] = frames;
                    return next;
                });
                setSelectedFramesBySheet((prev) => {
                    const next = prev.map((arr) => [...arr]);
                    next[sheetIndex] = new Array(frames.length).fill(false);
                    return next;
                });
                setStatusText('');
            } catch (err: unknown) {
                const rawMsg = err instanceof Error ? err.message : 'Unknown error';
                setError(rawMsg.includes('429') || rawMsg.includes('Quota') || rawMsg.includes('RESOURCE_EXHAUSTED') ? t.errorRateLimit : `${t.errorGeneration}: ${rawMsg}`);
            } finally {
                setIsGenerating(false);
            }
            return;
        }

        setIsGenerating(true);
        setError(null);
        setStatusText(t.statusIdle);
        setSpriteSheetImage(null);
        setStickerFrames([]);
        setSelectedFrames([]);

        // Build the full prompt
        const fullPrompt = buildFullPrompt(stickerDescription, gridCols, gridRows, chromaKeyColor);

        try {
            setStatusText(`${t.statusPreparing} (${t.statusUsingModel}: ${selectedModel})...`);

            // Generate sprite sheet using the same service as Sprite Animator
            const sheetImage = await generateSpriteSheet(
                sourceImage,
                fullPrompt,
                gridCols,
                gridRows,
                effectiveKey,
                selectedModel,
                (status) => setStatusText(status),
                chromaKeyColor,
                selectedResolution
            );

            setSpriteSheetImage(sheetImage);

            // Reset and update slice settings based on new generation
            setSliceSettings({
                ...DEFAULT_SLICE_SETTINGS,
                cols: gridCols,
                rows: gridRows,
            });

            // Step 1: Remove chroma key background using the worker
            setStatusText(t.statusProcessing);
            setIsProcessingChromaKey(true);
            setChromaKeyProgress(0);

            const activeChromaKeyColor = CHROMA_KEY_COLORS[chromaKeyColor];
            const processedImage = await removeChromaKeyWithWorker(
                sheetImage,
                activeChromaKeyColor,
                CHROMA_KEY_FUZZ,
                (progress) => {
                    setChromaKeyProgress(progress);
                    setStatusText(`${t.statusProcessing} (${progress}%)`);
                }
            );

            // Save the processed sprite sheet for display
            // This will trigger the useEffect to slice the sheet once the image loads and dimensions are set
            setProcessedSpriteSheet(processedImage);
            setIsProcessingChromaKey(false);
            setChromaKeyProgress(100);
            setStatusText(t.statusOptimizing); // Keep showing optimizing until slice is done

            // Note: slicing is now handled by the useEffect hook watching processedSpriteSheet
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
        stickerDescription,
        buildFullPrompt,
        gridCols,
        gridRows,
        chromaKeyColor,
        selectedModel,
        setShowSettings,
        stickerSetMode,
        setPhrasesList.length,
        currentSheetIndex,
        sliceProcessedSheetToFrames,
        selectedResolution,
    ]);

    // Generate all 3 sheets in parallel (sticker set mode only)
    const handleGenerateAllSheets = useCallback(async () => {
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
        if (setPhrasesList.length < SET_PHRASES_COUNT) {
            setError(`請先產生 48 句短語（目前 ${setPhrasesList.length} 句）`);
            return;
        }

        setIsGenerating(true);
        setError(null);
        setStatusText('3 張並行產生中...');

        const activeChromaKeyColor = CHROMA_KEY_COLORS[chromaKeyColor];

        try {
            const sheetPromises = ([0, 1, 2] as const).map(async (sheetIndex) => {
                const phraseSlice = setPhrasesList.slice(sheetIndex * FRAMES_PER_SHEET, (sheetIndex + 1) * FRAMES_PER_SHEET);
                const fullPrompt = buildFullPrompt(stickerDescription, 4, 4, chromaKeyColor, phraseSlice);
                return generateSpriteSheet(
                    sourceImage,
                    fullPrompt,
                    4,
                    4,
                    effectiveKey,
                    selectedModel,
                    () => {},
                    chromaKeyColor,
                    selectedResolution
                ).then((sheetImage) => ({ sheetIndex, sheetImage }));
            });

            const results = await Promise.all(sheetPromises);

            setSheetImages((prev) => {
                const next = [...prev];
                results.forEach(({ sheetIndex, sheetImage }) => { next[sheetIndex] = sheetImage; });
                return next;
            });

            setStatusText(t.statusProcessing);
            setIsProcessingChromaKey(true);

            for (let i = 0; i < SHEETS_COUNT; i++) {
                setStatusText(`${t.statusProcessing} 第 ${i + 1} 張去背...`);
                const raw = results[i].sheetImage;
                const processed = await removeChromaKeyWithWorker(raw, activeChromaKeyColor, CHROMA_KEY_FUZZ, () => {});
                setProcessedSheetImages((prev) => {
                    const next = [...prev];
                    next[i] = processed;
                    return next;
                });
                const frames = await sliceProcessedSheetToFrames(processed);
                setSheetFrames((prev) => {
                    const next = [...prev];
                    next[i] = frames;
                    return next;
                });
                setSelectedFramesBySheet((prev) => {
                    const next = prev.map((arr) => [...arr]);
                    next[i] = new Array(frames.length).fill(false);
                    return next;
                });
            }

            setIsProcessingChromaKey(false);
            setStatusText('');
        } catch (err: unknown) {
            const rawMsg = err instanceof Error ? err.message : 'Unknown error';
            setError(rawMsg.includes('429') || rawMsg.includes('Quota') || rawMsg.includes('RESOURCE_EXHAUSTED') ? t.errorRateLimit : `${t.errorGeneration}: ${rawMsg}`);
        } finally {
            setIsGenerating(false);
        }
    }, [
        getEffectiveApiKey,
        sourceImage,
        stickerDescription,
        buildFullPrompt,
        chromaKeyColor,
        selectedModel,
        setShowSettings,
        setPhrasesList.length,
        sliceProcessedSheetToFrames,
        t,
        selectedResolution,
    ]);

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

        // Single file optimization
        if (selectedIndices.length === 1) {
            await downloadSingle(selectedIndices[0]);
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
    }, [selectedFrames, stickerFrames, downloadFormat, convertToFormat, t, downloadSingle]);

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

    // Download original sprite sheet (with background)
    const downloadOriginalSpriteSheet = useCallback(() => {
        if (!spriteSheetImage) return;
        const a = document.createElement('a');
        a.href = spriteSheetImage;
        a.download = `sprite_sheet_original_${Date.now()}.png`;
        a.click();
    }, [spriteSheetImage]);

    // Download processed sprite sheet (background removed)
    const downloadProcessedSpriteSheet = useCallback(() => {
        if (!processedSpriteSheet) return;
        const a = document.createElement('a');
        a.href = processedSpriteSheet;
        a.download = `sprite_sheet_transparent_${Date.now()}.png`;
        a.click();
    }, [processedSpriteSheet]);

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

                        {/* Mode: Single sheet vs Sticker set (3 sheets, 48 phrases) */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">模式</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStickerSetMode(false)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                                        !stickerSetMode ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    單張
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStickerSetMode(true)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                                        stickerSetMode ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    貼圖組（3 張，48 格）
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {stickerSetMode ? '一次產生 48 句不重複短語，對應 3 張 4×4 精靈圖，可單張或並行產生' : '單張精靈圖，網格自訂'}
                            </p>
                        </div>

                        {/* Sticker Description */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                {t.lineStickerDescLabel}
                            </label>
                            <textarea
                                value={stickerDescription}
                                onChange={(e) => setStickerDescription(e.target.value)}
                                placeholder={t.lineStickerDescPlaceholder}
                                className="w-full h-20 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">{t.lineStickerDescHint}</p>
                        </div>

                        {/* Style Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                貼圖風格（Style Slot）
                            </label>
                            <select
                                value={selectedStyle}
                                onChange={(e) => setSelectedStyle(e.target.value as keyof typeof STYLE_PRESETS)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                            >
                                {(Object.keys(STYLE_PRESETS) as Array<keyof typeof STYLE_PRESETS>).map((key) => (
                                    <option key={key} value={key}>
                                        {STYLE_PRESETS[key].label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">選擇貼圖的繪製風格，會影響角色呈現方式</p>
                        </div>

                        {/* Theme Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                聊天主題（Theme Slot）
                            </label>
                            <select
                                value={selectedTheme}
                                onChange={(e) => {
                                    const newTheme = e.target.value as ThemeOption;
                                    setSelectedTheme(newTheme);
                                    if (newTheme !== 'custom') {
                                        const themePhrases = THEME_PRESETS[newTheme].examplePhrases.join('\n');
                                        setCustomPhrases(themePhrases);
                                    }
                                }}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                            >
                                <option value="trpg">TRPG 跑團</option>
                                <option value="daily">日常聊天</option>
                                <option value="social">社群互動</option>
                                <option value="workplace">職場對話</option>
                                <option value="custom">自訂</option>
                            </select>
                            {selectedTheme === 'custom' && (
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        value={customThemeContext}
                                        onChange={(e) => setCustomThemeContext(e.target.value)}
                                        placeholder="例如：遊戲公會、讀書會、寵物群組..."
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">輸入自訂主題描述，下方可手動填短語或點「產生」由 AI 產生</p>
                                </div>
                            )}
                            <p className="text-xs text-slate-500 mt-1">選擇貼圖的聊天語境主題，會自動填入對應短語</p>
                        </div>

                        {/* Custom Phrases (single mode) or Set phrases (sticker set mode) */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                {stickerSetMode ? '貼圖組短語（48 句，不重複）' : '短語列表（每行一句，角色會根據短語做出對應動作）'}
                            </label>
                            {/* Phrase mode selector */}
                            <div className="mb-2 flex flex-wrap gap-2">
                                <span className="text-xs font-medium text-slate-600 mt-0.5">短語風格：</span>
                                {([
                                    { id: 'balanced', label: '黃金比例' },
                                    { id: 'emotional', label: '情緒失控' },
                                    { id: 'meme', label: '梗圖專用' },
                                    { id: 'interaction', label: '關心互動' },
                                    { id: 'theme-deep', label: '符合主題' },
                                ] as const).map((m) => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setSelectedPhraseMode(m.id)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border-2 transition-colors ${
                                            selectedPhraseMode === m.id
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                            {stickerSetMode ? (
                                <>
                                    <textarea
                                        value={setPhrasesList.join('\n')}
                                        readOnly
                                        className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 resize-none font-mono text-xs"
                                        placeholder="先點「產生 48 句短語」"
                                    />
                                    <div className="flex items-center gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const key = getEffectiveApiKey();
                                                if (!key) {
                                                    setShowSettings(true);
                                                    setError(t.errorApiKey);
                                                    return;
                                                }
                                                const themeContext =
                                                    selectedTheme === 'custom'
                                                        ? (customThemeContext.trim() || '自訂聊天主題')
                                                        : THEME_PRESETS[selectedTheme].chatContext;
                                                const language = TEXT_PRESETS[selectedLanguage].language;
                                                setIsGeneratingPhrases(true);
                                                setError(null);
                                                try {
                                                    const lines = await generateStickerPhrases(key, themeContext, language, SET_PHRASES_COUNT, selectedPhraseMode);
                                                    setSetPhrasesList(lines);
                                                } catch (err) {
                                                    const msg = err instanceof Error ? err.message : String(err);
                                                    setError(`產生短語失敗: ${msg}`);
                                                } finally {
                                                    setIsGeneratingPhrases(false);
                                                }
                                            }}
                                            disabled={isGeneratingPhrases}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            {isGeneratingPhrases ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    產生中...
                                                </>
                                            ) : (
                                                '產生 48 句短語'
                                            )}
                                        </button>
                                        <span className="text-xs text-slate-500">依主題與語言一次產生 48 句，對應 3 張精靈圖</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <textarea
                                        value={customPhrases}
                                        onChange={(e) => setCustomPhrases(e.target.value)}
                                        placeholder="每行一句短語，例如：&#10;查規則書...&#10;骰子成功！&#10;暗骰中..."
                                        className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none font-mono text-xs"
                                    />
                                    <div className="flex items-center gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const key = getEffectiveApiKey();
                                                if (!key) {
                                                    setShowSettings(true);
                                                    setError(t.errorApiKey);
                                                    return;
                                                }
                                                const themeContext =
                                                    selectedTheme === 'custom'
                                                        ? (customThemeContext.trim() || '自訂聊天主題')
                                                        : THEME_PRESETS[selectedTheme].chatContext;
                                                const language = TEXT_PRESETS[selectedLanguage].language;
                                                const totalFrames = gridCols * gridRows;
                                                setIsGeneratingPhrases(true);
                                                setError(null);
                                                try {
                                                    const lines = await generateStickerPhrases(key, themeContext, language, totalFrames, selectedPhraseMode);
                                                    setCustomPhrases(lines.join('\n'));
                                                } catch (err) {
                                                    const msg = err instanceof Error ? err.message : String(err);
                                                    setError(`產生短語失敗: ${msg}`);
                                                } finally {
                                                    setIsGeneratingPhrases(false);
                                                }
                                            }}
                                            disabled={isGeneratingPhrases}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            {isGeneratingPhrases ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    產生中...
                                                </>
                                            ) : (
                                                '產生'
                                            )}
                                        </button>
                                        <span className="text-xs text-slate-500">依目前主題與語言用 AI 產生短語（gemini-3-flash-preview）</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        角色會根據每個短語的語意自動做出對應的表情和動作（如：成功→慶祝、失敗→沮喪、查規則→翻書等）
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Language Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                文字語言（Text Slot）
                            </label>
                            <select
                                value={selectedLanguage}
                                onChange={(e) => setSelectedLanguage(e.target.value as keyof typeof TEXT_PRESETS)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                            >
                                <option value="zh-TW">繁體中文</option>
                                <option value="zh-CN">簡體中文</option>
                                <option value="en">English</option>
                                <option value="ja">日本語</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-1">選擇貼圖文字使用的語言</p>
                        </div>

                        {/* Text Color */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                文字顏色
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(TEXT_COLOR_PRESETS) as Array<keyof typeof TEXT_COLOR_PRESETS>).map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setSelectedTextColor(key)}
                                        className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all touch-manipulation ${
                                            selectedTextColor === key
                                                ? 'border-green-500 bg-green-50 text-green-800'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                        }`}
                                        title={TEXT_COLOR_PRESETS[key].promptDesc}
                                    >
                                        {TEXT_COLOR_PRESETS[key].label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">預設為黑色</p>
                        </div>

                        {/* Font / Text Style */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                字體風格
                            </label>
                            <select
                                value={selectedFont}
                                onChange={(e) => setSelectedFont(e.target.value as keyof typeof FONT_PRESETS)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                            >
                                {(Object.keys(FONT_PRESETS) as Array<keyof typeof FONT_PRESETS>).map((key) => (
                                    <option key={key} value={key}>
                                        {FONT_PRESETS[key].label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">貼圖上短語的字體風格</p>
                        </div>

                        {/* Sheet selector (sticker set mode only) */}
                        {stickerSetMode && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">選擇要產生／預覽的張次</label>
                                <div className="flex gap-2">
                                    {([0, 1, 2] as const).map((i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setCurrentSheetIndex(i)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                                                currentSheetIndex === i ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                            }`}
                                        >
                                            第 {i + 1} 張
                                            {processedSheetImages[i] && <span className="ml-1 text-green-600">✓</span>}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">每張 4×4（16 格），共 3 張 48 格</p>
                            </div>
                        )}

                        {/* Grid Settings (single mode only; set mode uses fixed 4×4) */}
                        {!stickerSetMode && (
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
                        )}

                        {/* Chroma Key Color Selection */}
                        <div className="mb-6 p-3 rounded-lg border border-slate-200 bg-slate-50">
                            <span className="text-sm font-medium text-slate-700 block mb-2">
                                {t.backgroundColor}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setChromaKeyColor('magenta')}
                                    className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-2 touch-manipulation ${chromaKeyColor === 'magenta'
                                        ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300'
                                        }`}
                                    aria-label={t.magentaColor}
                                >
                                    <div className="w-4 h-4 rounded-full bg-fuchsia-500 border border-fuchsia-600 flex-shrink-0"></div>
                                    <span className="truncate">{t.magentaColor}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChromaKeyColor('green')}
                                    className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-2 touch-manipulation ${chromaKeyColor === 'green'
                                        ? 'border-green-500 bg-green-50 text-green-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-green-300'
                                        }`}
                                    aria-label={t.greenScreen}
                                >
                                    <div className="w-4 h-4 rounded-full bg-green-500 border border-green-600 flex-shrink-0"></div>
                                    <span className="truncate">{t.greenScreen}</span>
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">
                                {chromaKeyColor === 'magenta'
                                    ? t.magentaHint
                                    : t.greenHint}
                            </p>
                        </div>

                        {/* Output resolution (1K / 2K / 4K by model) */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">輸出解析度</label>
                            <div className="flex flex-wrap gap-2">
                                {resolutionOptions.map((res) => (
                                    <button
                                        key={res}
                                        type="button"
                                        onClick={() => setSelectedResolution(res)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                                            selectedResolution === res
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        {res}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                gemini-2.5-flash-image 僅支援 1K；gemini-3-pro-image-preview 支援 1K / 2K / 4K
                            </p>
                        </div>

                        {/* Total stickers info */}
                        <p className="text-sm text-slate-500 mb-4">
                            {t.totalFrames}: <span className="font-semibold text-slate-700">{stickerSetMode ? `${SET_PHRASES_COUNT}（3 張 × 16）` : gridCols * gridRows}</span>
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

                        {/* Generate Button(s) */}
                        {stickerSetMode ? (
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !sourceImage || setPhrasesList.length < SET_PHRASES_COUNT}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            {t.lineStickerGenerating}
                                        </>
                                    ) : (
                                        <>產生第 {currentSheetIndex + 1} 張</>
                                    )}
                                </button>
                                <button
                                    onClick={handleGenerateAllSheets}
                                    disabled={isGenerating || !sourceImage || setPhrasesList.length < SET_PHRASES_COUNT}
                                    className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            並行產生中...
                                        </>
                                    ) : (
                                        <>一鍵產生 3 張（並行）</>
                                    )}
                                </button>
                            </div>
                        ) : (
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
                        )}
                    </div>
                </div>

                {/* Right Panel - Results */}
                <div className="lg:col-span-7 space-y-4 sm:space-y-5 md:space-y-6">
                    {/* Sprite Sheet Viewer (single mode or current sheet in set mode) */}
                    {(stickerSetMode
                        ? (sheetImages[currentSheetIndex] || processedSheetImages[currentSheetIndex])
                        : (spriteSheetImage || processedSpriteSheet)
                    ) && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 sm:p-5 md:p-6 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900">
                                    {t.lineStickerSpriteSheet}
                                    {stickerSetMode && <span className="text-slate-500 font-normal ml-2">第 {currentSheetIndex + 1} 張</span>}
                                </h2>
                                {stickerSetMode && processedSheetImages[currentSheetIndex] && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const img = processedSheetImages[currentSheetIndex];
                                            if (!img) return;
                                            const a = document.createElement('a');
                                            a.href = img;
                                            a.download = `sprite_sheet_${currentSheetIndex + 1}_transparent_${Date.now()}.png`;
                                            a.click();
                                        }}
                                        className="text-sm font-medium text-green-600 hover:text-green-700"
                                    >
                                        下載這張
                                    </button>
                                )}
                            </div>

                            <div className="p-4 sm:p-5 md:p-6">
                                <SpriteSheetViewer
                                    spriteSheetImage={stickerSetMode ? (processedSheetImages[currentSheetIndex] ?? sheetImages[currentSheetIndex]) : processedSpriteSheet}
                                    originalSpriteSheet={stickerSetMode ? (sheetImages[currentSheetIndex] ?? processedSheetImages[currentSheetIndex]) : spriteSheetImage}
                                    isGenerating={isGenerating}
                                    sheetDimensions={sheetDimensions}
                                    sliceSettings={stickerSetMode ? { ...DEFAULT_SLICE_SETTINGS, cols: 4, rows: 4 } : sliceSettings}
                                    setSliceSettings={stickerSetMode ? () => {} : handleSliceSettingsChange}
                                    onImageLoad={handleImageLoad}
                                    onDownload={stickerSetMode
                                        ? () => {
                                            const img = processedSheetImages[currentSheetIndex];
                                            if (!img) return;
                                            const a = document.createElement('a');
                                            a.href = img;
                                            a.download = `sprite_sheet_${currentSheetIndex + 1}_transparent_${Date.now()}.png`;
                                            a.click();
                                          }
                                        : downloadProcessedSpriteSheet
                                    }
                                    onDownloadOriginal={stickerSetMode
                                        ? () => {
                                            const img = sheetImages[currentSheetIndex];
                                            if (!img) return;
                                            const a = document.createElement('a');
                                            a.href = img;
                                            a.download = `sprite_sheet_${currentSheetIndex + 1}_original_${Date.now()}.png`;
                                            a.click();
                                          }
                                        : downloadOriginalSpriteSheet
                                    }
                                    chromaKeyProgress={chromaKeyProgress}
                                    isProcessingChromaKey={isProcessingChromaKey}
                                />
                            </div>
                        </div>
                    )}

                    {/* Sticker Grid with FrameGrid */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 md:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {t.lineStickerResult}
                                {stickerSetMode && <span className="text-slate-500 font-normal ml-2">第 {currentSheetIndex + 1} 張</span>}
                            </h2>
                            {(stickerSetMode ? sheetFrames[currentSheetIndex].length : stickerFrames.length) > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={stickerSetMode
                                            ? () => setSelectedFramesBySheet((prev) => {
                                                const next = prev.map((arr) => [...arr]);
                                                next[currentSheetIndex] = new Array(sheetFrames[currentSheetIndex].length).fill(true);
                                                return next;
                                            })
                                            : selectAll
                                        }
                                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                                    >
                                        {t.lineStickerSelectAll}
                                    </button>
                                    <button
                                        onClick={stickerSetMode
                                            ? () => setSelectedFramesBySheet((prev) => {
                                                const next = prev.map((arr) => [...arr]);
                                                next[currentSheetIndex] = new Array(sheetFrames[currentSheetIndex].length).fill(false);
                                                return next;
                                            })
                                            : deselectAll
                                        }
                                        className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                        {t.lineStickerDeselectAll}
                                    </button>
                                </div>
                            )}
                        </div>

                        {(stickerSetMode ? sheetFrames[currentSheetIndex].length : stickerFrames.length) > 0 ? (
                            <>
                                {/* FrameGrid Component */}
                                <div className="mb-6">
                                    <FrameGrid
                                        frames={stickerSetMode ? sheetFrames[currentSheetIndex] : stickerFrames}
                                        currentFrameIndex={-1}
                                        onFrameClick={(index) => {
                                            if (stickerSetMode) {
                                                setSelectedFramesBySheet((prev) => {
                                                    const next = prev.map((arr) => [...arr]);
                                                    const sel = next[currentSheetIndex];
                                                    if (!sel.length) return prev;
                                                    const s = [...sel];
                                                    s[index] = !s[index];
                                                    next[currentSheetIndex] = s;
                                                    return next;
                                                });
                                            } else {
                                                setSelectedFrames(prev => {
                                                    const next = [...prev];
                                                    next[index] = !next[index];
                                                    return next;
                                                });
                                            }
                                        }}
                                        frameOverrides={stickerSetMode ? (sheetFrameOverrides[currentSheetIndex] ?? []) : frameOverrides}
                                        setFrameOverrides={stickerSetMode
                                            ? (val) => setSheetFrameOverrides((prev) => {
                                                const next = prev.map((arr) => [...arr]);
                                                const current = next[currentSheetIndex] ?? [];
                                                next[currentSheetIndex] = typeof val === 'function' ? val(current) : val;
                                                return next;
                                            })
                                            : setFrameOverrides
                                        }
                                        enablePerFrameEdit={true}
                                        processedSpriteSheet={stickerSetMode ? (processedSheetImages[currentSheetIndex] ?? undefined) : processedSpriteSheet}
                                        sliceSettings={stickerSetMode ? { ...DEFAULT_SLICE_SETTINGS, cols: 4, rows: 4 } : { ...sliceSettings, cols: gridCols, rows: gridRows }}
                                        sheetDimensions={sheetDimensions}
                                        frameIncluded={stickerSetMode ? selectedFramesBySheet[currentSheetIndex] : selectedFrames}
                                        setFrameIncluded={stickerSetMode
                                            ? (val) => setSelectedFramesBySheet((prev) => {
                                                const next = prev.map((arr) => [...arr]);
                                                next[currentSheetIndex] = typeof val === 'function' ? val(prev[currentSheetIndex]) : val;
                                                return next;
                                            })
                                            : setSelectedFrames
                                        }
                                    />
                                </div>

                                {/* Download options */}
                                <div className="border-t border-slate-200 pt-4">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
                                        {!stickerSetMode && (
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm font-medium text-slate-700">{t.lineStickerFormatLabel}:</label>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setDownloadFormat('png')}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${downloadFormat === 'png' ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                    >
                                                        PNG
                                                    </button>
                                                    <button
                                                        onClick={() => setDownloadFormat('jpg')}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${downloadFormat === 'jpg' ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                    >
                                                        JPG
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {stickerSetMode && (
                                            <button
                                                onClick={async () => {
                                                    if (processedSheetImages.every((img) => img == null)) return;
                                                    setIsDownloading(true);
                                                    try {
                                                        const zip = new JSZip();
                                                        for (let i = 0; i < SHEETS_COUNT; i++) {
                                                            const img = processedSheetImages[i];
                                                            if (img) {
                                                                const base64 = img.replace(/^data:image\/\w+;base64,/, '');
                                                                zip.file(`sprite_sheet_${i + 1}_transparent.png`, base64, { base64: true });
                                                            }
                                                        }
                                                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                                                        const url = URL.createObjectURL(zipBlob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `line_stickers_3_sheets_${Date.now()}.zip`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    } catch (e) {
                                                        setError(t.errorExportZip);
                                                    } finally {
                                                        setIsDownloading(false);
                                                    }
                                                }}
                                                disabled={isDownloading || processedSheetImages.some((img) => img == null)}
                                                className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                                                下載 3 張為 ZIP
                                            </button>
                                        )}

                                        {/* Selected count (single mode) */}
                                        {!stickerSetMode && selectedCount > 0 && (
                                            <span className="text-sm text-green-600 font-medium">{t.lineStickerSelected}: {selectedCount}</span>
                                        )}

                                        {/* Download buttons (single mode) */}
                                        {!stickerSetMode && (
                                            <>
                                                <button
                                                    onClick={downloadSelectedAsZip}
                                                    disabled={selectedCount === 0 || isDownloading}
                                                    className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                                                    {t.lineStickerDownloadZip}
                                                </button>
                                                <button
                                                    onClick={downloadAllAsZip}
                                                    disabled={isDownloading}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center gap-2"
                                                >
                                                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                                    {t.lineStickerDownloadAll}
                                                </button>
                                            </>
                                        )}

                                        {/* Download current sheet frames (set mode) */}
                                        {stickerSetMode && sheetFrames[currentSheetIndex].length > 0 && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        const frames = sheetFrames[currentSheetIndex];
                                                        if (!frames.length) return;
                                                        setIsDownloading(true);
                                                        try {
                                                            const zip = new JSZip();
                                                            for (let i = 0; i < frames.length; i++) {
                                                                const blob = await convertToFormat(frames[i], downloadFormat);
                                                                zip.file(`sheet${currentSheetIndex + 1}_${String(i + 1).padStart(2, '0')}.${downloadFormat}`, blob);
                                                            }
                                                            const zipBlob = await zip.generateAsync({ type: 'blob' });
                                                            const url = URL.createObjectURL(zipBlob);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = `line_stickers_sheet_${currentSheetIndex + 1}_${Date.now()}.zip`;
                                                            a.click();
                                                            URL.revokeObjectURL(url);
                                                        } finally {
                                                            setIsDownloading(false);
                                                        }
                                                    }}
                                                    disabled={isDownloading}
                                                    className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 rounded-lg flex items-center gap-2"
                                                >
                                                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                                    下載第 {currentSheetIndex + 1} 張 16 格
                                                </button>
                                            </div>
                                        )}
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
