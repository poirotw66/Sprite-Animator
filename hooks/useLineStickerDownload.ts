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

    const triggerBlobDownload = useCallback((blob: Blob, fileName: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, []);

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

    const appendProcessedSheetsToZip = useCallback((zip: JSZip, rootFolderName?: string) => {
        const root = rootFolderName ? zip.folder(rootFolderName) : zip;
        if (!root) {
            return 0;
        }

        let addedCount = 0;
        for (let i = 0; i < processedSheetImages.length; i++) {
            const img = processedSheetImages[i];
            if (!img) {
                continue;
            }

            const base64 = img.replace(/^data:image\/\w+;base64,/, '');
            root.file(`sprite_sheet_${i + 1}_transparent.png`, base64, { base64: true });
            addedCount += 1;
        }

        return addedCount;
    }, [processedSheetImages]);

    const appendSheetFramesToZip = useCallback(async (
        zip: JSZip,
        options?: {
            rootFolderName?: string;
            format?: DownloadFormat;
        }
    ) => {
        const format = options?.format ?? downloadFormat;
        const root = options?.rootFolderName ? zip.folder(options.rootFolderName) : zip;
        if (!root) {
            return 0;
        }

        const tasks = sheetFrames.flatMap((frames, sheetIndex) =>
            frames.map((frame, frameIndex) => ({ frame, frameIndex, sheetIndex }))
        );

        const files = await mapWithConcurrency(tasks, DOWNLOAD_CONCURRENCY, async ({ frame, frameIndex, sheetIndex }) => {
            if (!frame) {
                return null;
            }

            const blob = await convertToFormat(frame, format);
            return {
                folderName: `sheet_${sheetIndex + 1}`,
                fileName: `sticker_${String(frameIndex + 1).padStart(2, '0')}.${format}`,
                blob,
            };
        });

        let addedCount = 0;
        files.forEach((file) => {
            if (!file) {
                return;
            }

            root.folder(file.folderName)?.file(file.fileName, file.blob);
            addedCount += 1;
        });

        return addedCount;
    }, [sheetFrames, downloadFormat, convertToFormat]);

    const downloadSingle = useCallback(async (index: number) => {
        const frames = stickerSetMode ? sheetFrames[currentSheetIndex] : stickerFrames;
        const frame = frames[index];
        if (!frame) return;

        const blob = await convertToFormat(frame, downloadFormat);
        triggerBlobDownload(blob, `sticker_${String(index + 1).padStart(2, '0')}.${downloadFormat}`);
    }, [stickerSetMode, sheetFrames, currentSheetIndex, stickerFrames, downloadFormat, convertToFormat, triggerBlobDownload]);

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
            triggerBlobDownload(zipBlob, `line_stickers_${Date.now()}.zip`);
        } catch (err) {
            logger.error('Failed to export ZIP:', err);
            setError(t.errorExportZip);
        } finally {
            setIsDownloading(false);
        }
    }, [stickerSetMode, sheetFrames, currentSheetIndex, stickerFrames, downloadFormat, convertToFormat, t, setError, downloadSingle, triggerBlobDownload]);

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
            const addedCount = appendProcessedSheetsToZip(zip);
            if (addedCount === 0) {
                return;
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            triggerBlobDownload(zipBlob, `line_stickers_3_sheets_${Date.now()}.zip`);
        } catch (err) {
            logger.error('Failed to export sticker set ZIP:', err);
            setError(t.errorExportZip);
        } finally {
            setIsDownloading(false);
        }
    }, [processedSheetImages, appendProcessedSheetsToZip, setError, t, triggerBlobDownload]);

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
            const addedCount = await appendSheetFramesToZip(zip);
            if (addedCount === 0) {
                return;
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            triggerBlobDownload(zipBlob, `line_stickers_3_sheets_frames_${Date.now()}.zip`);
        } catch (err) {
            logger.error('Failed to export 3 sheets frames ZIP:', err);
            setError(t.errorExportZip);
        } finally {
            setIsDownloading(false);
        }
    }, [sheetFrames, appendSheetFramesToZip, setError, t, triggerBlobDownload]);

    /** One-click: download a single ZIP containing processed sheets and sliced frame folders. */
    const downloadSetOneClick = useCallback(async () => {
        const hasSheets = processedSheetImages.some((img) => !!img);
        const hasFrames = sheetFrames.some((arr) => arr.length > 0);
        if (!hasSheets && !hasFrames) return;

        setIsDownloading(true);
        try {
            const zip = new JSZip();
            let addedCount = 0;

            if (hasSheets) {
                addedCount += appendProcessedSheetsToZip(zip, 'sprite_sheets');
            }

            if (hasFrames) {
                addedCount += await appendSheetFramesToZip(zip, { rootFolderName: 'frames' });
            }

            if (addedCount === 0) {
                return;
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            triggerBlobDownload(zipBlob, `line_stickers_bundle_${Date.now()}.zip`);
        } catch (err) {
            logger.error('Failed to export combined sticker set ZIP:', err);
            setError(t.errorExportZip);
        } finally {
            setIsDownloading(false);
        }
    }, [processedSheetImages, sheetFrames, appendProcessedSheetsToZip, appendSheetFramesToZip, setError, t, triggerBlobDownload]);

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
