import { useState, useCallback } from 'react';
import { AnimationConfig } from '../types';
import { loadImagesData } from '../utils/imageUtils';
import { ANIMATION_FPS_MULTIPLIER } from '../utils/constants';
import UPNG from 'upng-js';
import JSZip from 'jszip';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

/**
 * Custom hook for exporting animation frames in various formats.
 * Supports APNG (high quality with transparency), GIF, and ZIP formats.
 * Automatically handles resource cleanup (URL.revokeObjectURL).
 * 
 * @param generatedFrames - Array of base64 encoded frame images
 * @param config - Animation configuration including speed
 * @returns Object containing export state and export functions
 * 
 * @example
 * ```typescript
 * const {
 *   isExporting,
 *   handleDownloadApng,
 *   handleDownloadGif,
 *   handleDownloadZip
 * } = useExport(frames, config);
 * ```
 */
export const useExport = (generatedFrames: string[], config: AnimationConfig) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadApng = useCallback(async () => {
    if (generatedFrames.length === 0) return;

    setIsExporting(true);
    try {
      const { imagesData, width, height } = await loadImagesData(generatedFrames);

      const buffers = imagesData.map((d) => d.data.buffer);
      const fps = Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER);
      const delayMs = Math.round(1000 / fps);
      const delays = generatedFrames.map(() => delayMs);

      const apngBuffer = UPNG.encode(buffers, width, height, 0, delays);

      const blob = new Blob([apngBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'animation.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('APNG Export failed', err);
      throw new Error('APNG 導出失敗');
    } finally {
      setIsExporting(false);
    }
  }, [generatedFrames, config.speed]);

  const handleDownloadGif = useCallback(async () => {
    if (generatedFrames.length === 0) return;

    setIsExporting(true);
    try {
      const { imagesData, width, height } = await loadImagesData(generatedFrames);

      const gif = new GIFEncoder();
      const fps = Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER);
      const delayMs = Math.round(1000 / fps);

      for (const { data } of imagesData) {
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        gif.writeFrame(index, width, height, {
          palette,
          delay: delayMs,
          transparent: true,
          dispose: -1,
        });
      }

      gif.finish();
      const buffer = gif.bytes();

      const blob = new Blob([buffer], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'animation.gif';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('GIF Export failed', err);
      throw new Error('GIF 導出失敗');
    } finally {
      setIsExporting(false);
    }
  }, [generatedFrames, config.speed]);

  const handleDownloadZip = useCallback(async () => {
    if (generatedFrames.length === 0) return;

    setIsExporting(true);
    try {
      const zip = new JSZip();

      generatedFrames.forEach((frame, index) => {
        const base64Data = frame.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        const fileName = `frame_${String(index + 1).padStart(3, '0')}.png`;
        zip.file(fileName, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'frames_archive.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Zip Export failed', err);
      throw new Error('ZIP 打包失敗');
    } finally {
      setIsExporting(false);
    }
  }, [generatedFrames]);

  const handleDownloadSpriteSheet = useCallback((spriteSheetImage: string) => {
    if (!spriteSheetImage) return;
    const link = document.createElement('a');
    link.href = spriteSheetImage;
    link.download = `sprite_sheet_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return {
    isExporting,
    handleDownloadApng,
    handleDownloadGif,
    handleDownloadZip,
    handleDownloadSpriteSheet,
  };
};
