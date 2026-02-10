import { useState, useCallback } from 'react';
import { AnimationConfig } from '../types';
import { loadImagesData, generateSmoothAnimation } from '../utils/imageUtils';
import { ANIMATION_FPS_MULTIPLIER, GIF_TARGET_FPS, DEFAULT_INTERPOLATION_FRAMES } from '../utils/constants';
import { logger } from '../utils/logger';
import UPNG from 'upng-js';
import JSZip from 'jszip';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

/** Decode PNG from base64/data URL to RGBA using UPNG (same source as ZIP, no canvas). */
function decodePngToRgba(dataUrl: string): { data: Uint8ClampedArray; width: number; height: number } {
  const base64 = dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  const img = UPNG.decode(bytes.buffer);
  const frames = UPNG.toRGBA8(img);
  const data = new Uint8ClampedArray(frames[0]);
  return { data, width: img.width, height: img.height };
}

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
      // Step 1: Generate smooth animation with frame interpolation
      const originalFps = Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER);

      let framesToExport = generatedFrames;

      // Apply frame interpolation for smoother animation (if enabled)
      if (config.enableInterpolation && generatedFrames.length >= 2) {
        logger.debug(`APNG: Interpolating frames: ${generatedFrames.length} -> target ${GIF_TARGET_FPS} FPS`);
        framesToExport = await generateSmoothAnimation(generatedFrames, {
          interpolationFrames: DEFAULT_INTERPOLATION_FRAMES,
          easing: 'ease-in-out',
          loopMode: 'loop',
          targetFps: GIF_TARGET_FPS,
          originalFps: originalFps,
        });
        logger.debug(`APNG: Interpolation complete: ${framesToExport.length} frames`);
      }

      // Step 2: Load image data
      const { imagesData, width, height } = await loadImagesData(framesToExport);

      const buffers = imagesData.map((d) => d.data.buffer);

      // Calculate delay based on interpolated frame count
      const effectiveFps = config.enableInterpolation ? GIF_TARGET_FPS : originalFps;
      const delayMs = Math.round(1000 / effectiveFps);
      const delays = framesToExport.map(() => delayMs);

      const apngBuffer = UPNG.encode(buffers, width, height, 0, delays);

      const blob = new Blob([apngBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'animation.png';
      document.body.appendChild(link);
      link.click();
      // Use setTimeout to ensure download starts before revoking URL
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      logger.error('APNG Export failed', err);
      throw new Error('APNG 導出失敗');
    } finally {
      setIsExporting(false);
    }
  }, [generatedFrames, config.speed, config.enableInterpolation]);

  const handleDownloadGif = useCallback(async () => {
    if (generatedFrames.length === 0) return;

    setIsExporting(true);
    try {
      // Step 1: Generate smooth animation with frame interpolation
      const originalFps = Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER);

      let framesToExport = generatedFrames;

      // Apply frame interpolation for smoother animation (if enabled)
      if (config.enableInterpolation && generatedFrames.length >= 2) {
        logger.debug(`Interpolating frames: ${generatedFrames.length} -> target ${GIF_TARGET_FPS} FPS`);
        framesToExport = await generateSmoothAnimation(generatedFrames, {
          interpolationFrames: DEFAULT_INTERPOLATION_FRAMES,
          easing: 'ease-in-out',
          loopMode: 'loop',
          targetFps: GIF_TARGET_FPS,
          originalFps: originalFps,
        });
        logger.debug(`Interpolation complete: ${framesToExport.length} frames`);
      }

      // Step 2: Decode PNG to RGBA the same way as ZIP (raw PNG bytes via UPNG, no canvas)
      const imagesData = framesToExport.map((frame) => decodePngToRgba(frame));
      const width = imagesData[0].width;
      const height = imagesData[0].height;

      // Step 3: Create GIF from same RGBA as in the PNG files
      const gif = new GIFEncoder();
      const effectiveFps = config.enableInterpolation ? GIF_TARGET_FPS : originalFps;
      const delayMs = Math.round(1000 / effectiveFps);
      const GIF_FORMAT = 'rgba4444' as const;

      for (const { data } of imagesData) {
        const palette = quantize(data, 256, { format: GIF_FORMAT });
        const index = applyPalette(data, palette, GIF_FORMAT);

        let transparentIndex = 0;
        let minAlpha = 256;
        for (let i = 0; i < palette.length; i++) {
          const a = palette[i].length === 4 ? palette[i][3] : 255;
          if (a < minAlpha) {
            minAlpha = a;
            transparentIndex = i;
          }
        }
        const hasTransparency = minAlpha <= 127;

        gif.writeFrame(index, width, height, {
          palette: palette.map((c) => c.slice(0, 3)),
          delay: delayMs,
          transparent: hasTransparency,
          transparentIndex,
          dispose: 2,
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
      // Use setTimeout to ensure download starts before revoking URL
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      logger.error('GIF Export failed', err);
      throw new Error('GIF 導出失敗');
    } finally {
      setIsExporting(false);
    }
  }, [generatedFrames, config.speed, config.enableInterpolation]);

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
      // Use setTimeout to ensure download starts before revoking URL
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      logger.error('Zip Export failed', err);
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
