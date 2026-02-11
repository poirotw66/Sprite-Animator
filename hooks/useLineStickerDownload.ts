import { useCallback, useState } from 'react';
import JSZip from 'jszip';
import { logger } from '../utils/logger';
import { useLanguage } from './useLanguage';

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

    const convertToFormat = useCallback(async (base64: string, format: DownloadFormat): Promise<Blob> => {
        return new Promise((resolve, reject) => {
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
        });
    }, []);

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

            for (const index of selectedIndices) {
                const frame = frames[index];
                if (frame) {
                    const blob = await convertToFormat(frame, downloadFormat);
                    zip.file(`sticker_${String(index + 1).padStart(2, '0')}.${downloadFormat}`, blob);
                }
            }

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

    return {
        isDownloading,
        downloadFormat,
        setDownloadFormat,
        downloadSingle,
        downloadSelectedAsZip,
        downloadAllAsZip,
        downloadStickerSetZip,
        downloadCurrentSheetZip,
    };
};
