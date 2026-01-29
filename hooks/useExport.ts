import { useState, useCallback } from 'react';
import { AnimationConfig } from '../types';
import { loadImagesData, generateSmoothAnimation } from '../utils/imageUtils';
import { ANIMATION_FPS_MULTIPLIER, GIF_TARGET_FPS, DEFAULT_INTERPOLATION_FRAMES, ENABLE_FRAME_INTERPOLATION } from '../utils/constants';
import { logger } from '../utils/logger';
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
      // Step 1: Generate smooth animation with frame interpolation
      const originalFps = Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER);
      
      let framesToExport = generatedFrames;
      
      // Apply frame interpolation for smoother animation
      if (ENABLE_FRAME_INTERPOLATION && generatedFrames.length >= 2) {
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
      const effectiveFps = ENABLE_FRAME_INTERPOLATION ? GIF_TARGET_FPS : originalFps;
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
  }, [generatedFrames, config.speed]);

  const handleDownloadGif = useCallback(async () => {
    if (generatedFrames.length === 0) return;

    setIsExporting(true);
    try {
      // Step 1: Generate smooth animation with frame interpolation
      const originalFps = Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER);
      
      let framesToExport = generatedFrames;
      
      // Apply frame interpolation for smoother animation
      if (ENABLE_FRAME_INTERPOLATION && generatedFrames.length >= 2) {
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

      // Step 2: Load image data for all frames
      const { imagesData, width, height } = await loadImagesData(framesToExport);

      // Step 3: Create GIF with optimized settings
      const gif = new GIFEncoder();
      
      // Calculate delay based on interpolated frame count
      // Target smooth playback at GIF_TARGET_FPS
      const effectiveFps = ENABLE_FRAME_INTERPOLATION ? GIF_TARGET_FPS : originalFps;
      const delayMs = Math.round(1000 / effectiveFps);

      for (const { data } of imagesData) {
        // Use 256 colors for best quality
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        
        gif.writeFrame(index, width, height, {
          palette,
          delay: delayMs,
          transparent: true,
          transparentIndex: 0, // Specify transparent color index
          dispose: 2, // Restore to background - prevents ghosting artifacts
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
