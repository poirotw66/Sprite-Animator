import { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { logger } from '../utils/logger';
import { useLanguage } from './useLanguage';

const DOWNLOAD_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    if (items.length === 0) {
        return [];
    }

    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);

    const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
            const currentIndex = nextIndex;
            nextIndex += 1;

            if (currentIndex >= items.length) {
                return;
            }

            results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
        }
    });

    await Promise.all(workers);
    return results;
}

export type DownloadFormat = 'png' | 'jpg';

interface UseLineStickerDownloadProps {
    stickerFrames: string[];
    sheetFrames: string[][];
    stickerSetMode: boolean;
    currentSheetIndex: number;
    processedSheetImages: (string | null)[];
    sheetImages: (string | null)[];
    setError: (msg: string | null) => void;
}

export const useLineStickerDownload = ({
    stickerFrames,
    sheetFrames,
    stickerSetMode,
    currentSheetIndex,
    processedSheetImages,
    sheetImages,
    setError,
}: UseLineStickerDownloadProps) => {
    const { t } = useLanguage();
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('png');
    const conversionCacheRef = useRef<Map<string, Promise<Blob>>>(new Map());

    useEffect(() => {
        conversionCacheRef.current.clear();
    }, [stickerFrames, sheetFrames, processedSheetImages, sheetImages]);

    const getCacheKey = useCallback((base64: string, format: DownloadFormat) => {
        return `${format}:${base64}`;
    }, []);

    const convertToFormat = useCallback(async (base64: string, format: DownloadFormat): Promise<Blob> => {
        const cacheKey = getCacheKey(base64, format);
        const cached = conversionCacheRef.current.get(cacheKey);
        if (cached) {
            return cached;
        }

        const conversionPromise = new Promise<Blob>((resolve, reject) => {
            const img = document.createElement('img');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d')!;

                if (format === 'jpg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob from canvas'));
                    }
                }, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
            };
            img.onerror = () => reject(new Error('Failed to load image for format conversion'));
            img.src = base64;
        }).catch((error) => {
            conversionCacheRef.current.delete(cacheKey);
            throw error;
        });

        conversionCacheRef.current.set(cacheKey, conversionPromise);
        return conversionPromise;
    }, [getCacheKey]);

    const downloadSingle = useCallback(async (index: number) => {
        const frames = stickerSetMode ? sheetFrames[currentSheetIndex] : stickerFrames;
        const frame = frames[index];
        if (!frame) return;

        const blob = await convertToFormat(frame, downloadFormat);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sticker_${String(index + 1).padStart(2, '0')}.${downloadFormat}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, [stickerSetMode, sheetFrames, currentSheetIndex, stickerFrames, downloadFormat, convertToFormat]);

    const downloadSelectedAsZip = useCallback(async (selectedIndices: number[]) => {
        if (selectedIndices.length === 0) {
            setError(t.lineStickerErrorSelectOne);
            return;
        }

        if (selectedIndices.length === 1) {
            await downloadSingle(selectedIndices[0]);
            return;
        }

        setIsDownloading(true);
        try {
            const zip = new JSZip();
            const frames = stickerSetMode ? sheetFrames[currentSheetIndex] : stickerFrames;

            const files = await mapWithConcurrency(selectedIndices, DOWNLOAD_CONCURRENCY, async (index) => {
                const frame = frames[index];
                if (!frame) {
                    return null;
                }

                const blob = await convertToFormat(frame, downloadFormat);
                return {
                    fileName: `sticker_${String(index + 1).padStart(2, '0')}.${downloadFormat}`,
                    blob,
                };
            });

            files.forEach((file) => {
                if (!file) {
                    return;
                }
                zip.file(file.fileName, file.blob);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `line_stickers_${Date.now()}.zip`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            logger.error('Failed to export ZIP:', err);
            setError(t.errorExportZip);
        } finally {
            setIsDownloading(false);
        }
    }, [stickerSetMode, sheetFrames, currentSheetIndex, stickerFrames, downloadFormat, convertToFormat, t, setError, downloadSingle]);

    const downloadAllAsZip = useCallback(async () => {
        const frames = stickerSetMode ? sheetFrames[currentSheetIndex] : stickerFrames;
        if (frames.length === 0) return;

        const indices = frames.map((_, i) => i);
        await downloadSelectedAsZip(indices);
    }, [stickerSetMode, sheetFrames, currentSheetIndex, stickerFrames, downloadSelectedAsZip]);

    const downloadStickerSetZip = useCallback(async () => {
        if (processedSheetImages.every((img) => img == null)) return;
        setIsDownloading(true);
        try {
            const zip = new JSZip();
            for (let i = 0; i < processedSheetImages.length; i++) {
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
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            logger.error('Failed to export sticker set ZIP:', err);
            setError(t.errorExportZip);
        } finally {
            setIsDownloading(false);
        }
    }, [processedSheetImages, setError, t]);

    const downloadCurrentSheetZip = useCallback(async () => {
        const frames = sheetFrames[currentSheetIndex];
        if (!frames || frames.length === 0) return;

        const indices = frames.map((_, i) => i);
        await downloadSelectedAsZip(indices);
    }, [sheetFrames, currentSheetIndex, downloadSelectedAsZip]);

    /** One ZIP containing 3 folders (sheet_1, sheet_2, sheet_3), each with 16 sliced frame images. */
    const downloadAllSheetsFramesZip = useCallback(async () => {
        const hasAny = sheetFrames.some((arr) => arr.length > 0);
        if (!hasAny) return;
        setIsDownloading(true);
        try {
            const zip = new JSZip();
            const ext = downloadFormat;
            const tasks = sheetFrames.flatMap((frames, sheetIndex) =>
                frames.map((frame, frameIndex) => ({ frame, frameIndex, sheetIndex }))
            );

            const files = await mapWithConcurrency(tasks, DOWNLOAD_CONCURRENCY, async ({ frame, frameIndex, sheetIndex }) => {
                if (!frame) {
                    return null;
                }

                const blob = await convertToFormat(frame, downloadFormat);
                return {
                    folderName: `sheet_${sheetIndex + 1}`,
                    fileName: `sticker_${String(frameIndex + 1).padStart(2, '0')}.${ext}`,
                    blob,
                };
            });

            files.forEach((file) => {
                if (!file) {
                    return;
                }
                const folder = zip.folder(file.folderName);
                folder?.file(file.fileName, file.blob);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `line_stickers_3_sheets_frames_${Date.now()}.zip`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            logger.error('Failed to export 3 sheets frames ZIP:', err);
            setError(t.errorExportZip);
        } finally {
            setIsDownloading(false);
        }
    }, [sheetFrames, downloadFormat, convertToFormat, setError, t]);

    /** One-click: download ZIP of 3 sprite sheets, then ZIP of 3 sets of sliced frames. */
    const downloadSetOneClick = useCallback(async () => {
        const hasSheets = processedSheetImages.some((img) => !!img);
        const hasFrames = sheetFrames.some((arr) => arr.length > 0);
        if (!hasSheets && !hasFrames) return;
        setIsDownloading(true);
        try {
            if (hasSheets) {
                await downloadStickerSetZip();
                setIsDownloading(true);
                await new Promise((r) => setTimeout(r, 400));
            }
            if (hasFrames) await downloadAllSheetsFramesZip();
        } finally {
            setIsDownloading(false);
        }
    }, [processedSheetImages, sheetFrames, downloadStickerSetZip, downloadAllSheetsFramesZip]);

    return {
        isDownloading,
        downloadFormat,
        setDownloadFormat,
        downloadSingle,
        downloadSelectedAsZip,
        downloadAllAsZip,
        downloadStickerSetZip,
        downloadCurrentSheetZip,
        downloadAllSheetsFramesZip,
        downloadSetOneClick,
    };
};
