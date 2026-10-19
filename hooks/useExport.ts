import { useState, useCallback } from 'react';
import { AnimationConfig } from '../types';
import { loadImagesData, generateSmoothAnimation } from '../utils/imageUtils';
import { ANIMATION_FPS_MULTIPLIER, GIF_TARGET_FPS, DEFAULT_INTERPOLATION_FRAMES } from '../utils/constants';
import { logger } from '../utils/logger';
import UPNG from 'upng-js';
import JSZip from 'jszip';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import {
  buildAsepriteExport,
  downloadBlob,
  timingFromPlaybackSpeed,
} from '../utils/engineExport';

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

function resolvePackGrid(config: AnimationConfig, frameCount: number): { cols?: number; rows?: number } {
  if (
    config.mode === 'sheet' &&
    config.gridCols >= 1 &&
    config.gridRows >= 1 &&
    config.gridCols * config.gridRows >= frameCount
  ) {
    return { cols: config.gridCols, rows: config.gridRows };
  }
  return {};
}

/**
 * Custom hook for exporting animation frames in various formats.
 * Supports APNG, GIF, ZIP (frames + Aseprite atlas/JSON), and direct Aseprite JSON.
 */
export const useExport = (generatedFrames: string[], config: AnimationConfig) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadApng = useCallback(async () => {
    if (generatedFrames.length === 0) return;

    setIsExporting(true);
    try {
      const originalFps = Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER);

      let framesToExport = generatedFrames;

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

      const { imagesData, width, height } = await loadImagesData(framesToExport);

      const buffers = imagesData.map((d) => d.data.buffer);

      const effectiveFps = config.enableInterpolation ? GIF_TARGET_FPS : originalFps;
      const delayMs = Math.round(1000 / effectiveFps);
      const delays = framesToExport.map(() => delayMs);

      const apngBuffer = UPNG.encode(buffers, width, height, 0, delays);

      downloadBlob(new Blob([apngBuffer], { type: 'image/png' }), 'animation.png');
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
      const originalFps = Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER);

      let framesToExport = generatedFrames;

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

      const imagesData = framesToExport.map((frame) => decodePngToRgba(frame));
      const width = imagesData[0].width;
      const height = imagesData[0].height;

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
      downloadBlob(new Blob([gif.bytes()], { type: 'image/gif' }), 'animation.gif');
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
      const timing = timingFromPlaybackSpeed(config.speed);
      const packGrid = resolvePackGrid(config, generatedFrames.length);
      const asepriteExport = buildAsepriteExport({
        frameDataUrls: generatedFrames,
        timing,
        ...packGrid,
      });

      generatedFrames.forEach((frame, index) => {
        const base64Data = frame.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        const fileName = `frames/frame_${String(index + 1).padStart(3, '0')}.png`;
        zip.file(fileName, base64Data, { base64: true });
      });

      zip.file(asepriteExport.sheetFileName, asepriteExport.sheetPngBytes);
      zip.file(asepriteExport.asepriteFileName, asepriteExport.asepriteJsonText);

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, 'sprite-export.zip');
    } catch (err) {
      logger.error('Zip Export failed', err);
      throw new Error('ZIP 打包失敗');
    } finally {
      setIsExporting(false);
    }
  }, [generatedFrames, config]);

  const handleDownloadAsepriteJson = useCallback(async () => {
    if (generatedFrames.length === 0) return;

    setIsExporting(true);
    try {
      const timing = timingFromPlaybackSpeed(config.speed);
      const packGrid = resolvePackGrid(config, generatedFrames.length);
      const asepriteExport = buildAsepriteExport({
        frameDataUrls: generatedFrames,
        timing,
        ...packGrid,
      });
      downloadBlob(
        new Blob([asepriteExport.asepriteJsonText], { type: 'application/json' }),
        asepriteExport.asepriteFileName,
      );
    } catch (err) {
      logger.error('Aseprite JSON export failed', err);
      throw new Error('Aseprite JSON export failed');
    } finally {
      setIsExporting(false);
    }
  }, [generatedFrames, config]);

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
    handleDownloadAsepriteJson,
    handleDownloadSpriteSheet,
  };
};
