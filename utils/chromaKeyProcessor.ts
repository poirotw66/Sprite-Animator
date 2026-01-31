/**
 * Chroma key removal processor using Web Worker for background processing.
 * Provides progress callbacks and non-blocking image processing.
 * Uses HSL color space for more accurate chroma key detection.
 * 
 * @module chromaKeyProcessor
 */

import { logger } from './logger';

export interface ChromaKeyProgress {
  progress: number; // 0-100
  stage: 'detecting' | 'processing' | 'complete';
}

/**
 * Convert RGB to HSL color space
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    default:
      h = ((r - g) / d + 4) * 60;
      break;
  }
  
  return { h, s, l };
}

/**
 * Check if a color is in the green screen hue range using HSL
 * Target color: #00B140 (RGB: 0, 177, 64, Hue: ~141°)
 */
function isGreenScreenHSL(r: number, g: number, b: number, tolerance: number): boolean {
  const { h, s, l } = rgbToHsl(r, g, b);
  
  const hueInRange = h >= 135 - tolerance && h <= 147 + tolerance;
  const saturationOk = s > 0.65;
  const lightnessOk = l > 0.3 && l < 0.7;
  const greenDominant = g > r * 2.0 && g > b * 2.0 && g > 120;
  const rgbLowEnough = r < 100 && b < 100;
  
  return hueInRange && saturationOk && lightnessOk && greenDominant && rgbLowEnough;
}

/**
 * Check if a color is magenta screen using HSL
 * Target color: #FF00FF (RGB: 255, 0, 255, Hue: 300°)
 * Strict detection - rely on RGB distance matching for variants
 */
function isMagentaScreenHSL(r: number, g: number, b: number, tolerance: number): boolean {
  const { h, s, l } = rgbToHsl(r, g, b);
  
  // Strict HSL check for pure magenta
  const hueInRange = h >= 295 - tolerance && h <= 305 + tolerance;
  const saturationOk = s > 0.7;
  const lightnessOk = l > 0.35 && l < 0.75;
  const magentaPattern = r > 180 && b > 180 && g < 100 && Math.abs(r - b) < 80;
  
  return hueInRange && saturationOk && lightnessOk && magentaPattern;
}

/**
 * Removes chroma key background using Web Worker for non-blocking processing.
 * Falls back to main thread processing if Web Worker is not available.
 * 
 * @param base64Image - Base64 encoded image with chroma key background
 * @param chromaKey - RGB color to remove (default: {r: 255, g: 0, b: 255} for #FF00FF)
 * @param fuzzPercent - Tolerance percentage (0-100, default: 10)
 * @param onProgress - Optional callback for progress updates (0-100)
 * @returns Promise resolving to base64 encoded image with transparent background
 */
export const removeChromaKeyWithWorker = async (
  base64Image: string,
  chromaKey: { r: number; g: number; b: number } = { r: 255, g: 0, b: 255 },
  fuzzPercent: number = 10,
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          reject(new Error('Canvas context failed'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (typeof Worker !== 'undefined') {
          try {
            const processed = await processWithWorker(
              imageData,
              chromaKey,
              fuzzPercent,
              onProgress
            );
            ctx.putImageData(processed, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (workerError) {
            logger.warn('Web Worker processing failed, falling back to main thread', workerError);
            const processed = await processInMainThread(
              imageData,
              chromaKey,
              fuzzPercent,
              onProgress
            );
            ctx.putImageData(processed, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          }
        } else {
          logger.warn('Web Worker not supported, using main thread');
          const processed = await processInMainThread(
            imageData,
            chromaKey,
            fuzzPercent,
            onProgress
          );
          ctx.putImageData(processed, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Processing failed'));
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.crossOrigin = 'anonymous';
    img.src = base64Image;
  });
};

/**
 * Process image using Web Worker
 */
function processWithWorker(
  imageData: ImageData,
  chromaKey: { r: number; g: number; b: number },
  fuzzPercent: number,
  onProgress?: (progress: number) => void
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(
        new URL('../workers/chromaKeyWorker.ts', import.meta.url),
        { type: 'module' }
      );

      const requestId = `chroma-key-${Date.now()}-${Math.random()}`;

      worker.onmessage = (e: MessageEvent) => {
        const { type, progress, data: processedData, width, height, error, id } = e.data;

        if (id !== requestId) return;

        if (type === 'progress' && progress !== undefined) {
          onProgress?.(progress);
        } else if (type === 'complete' && processedData && width && height) {
          worker.terminate();
          const result = new ImageData(
            new Uint8ClampedArray(processedData),
            width,
            height
          );
          resolve(result);
        } else if (type === 'error') {
          worker.terminate();
          reject(new Error(error || 'Worker processing failed'));
        }
      };

      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };

      worker.postMessage({
        type: 'process',
        data: Array.from(imageData.data),
        width: imageData.width,
        height: imageData.height,
        chromaKey,
        fuzzPercent,
        id: requestId,
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Process image in main thread (fallback) using HSL color space
 */
function processInMainThread(
  imageData: ImageData,
  chromaKey: { r: number; g: number; b: number },
  fuzzPercent: number,
  onProgress?: (progress: number) => void
): Promise<ImageData> {
  return new Promise((resolve) => {
    const data = imageData.data;
    const totalPixels = data.length / 4;
    const fuzz = (fuzzPercent / 100) * 255;
    const hueTolerance = fuzzPercent * 1.5;
    const chunkSize = 50000;
    let startIndex = 0;
    let targetColor = chromaKey;
    let colorDetected = false;
    let targetIsMagenta = false;
    let targetIsGreen = false;

    // Background color detection using HSL
    const detectBackgroundColor = () => {
      const width = imageData.width;
      const height = imageData.height;
      const sampleSize = Math.min(100, Math.floor(Math.sqrt(totalPixels) / 10));
      const colorMap = new Map<string, number>();
      
      // Sample corners
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const points = [
            [x, y],
            [width - 1 - x, y],
            [x, height - 1 - y],
            [width - 1 - x, height - 1 - y]
          ];
          for (const [px, py] of points) {
            const idx = (py * width + px) * 4;
            if (idx < data.length) {
              const key = `${data[idx]},${data[idx + 1]},${data[idx + 2]}`;
              colorMap.set(key, (colorMap.get(key) || 0) + 1);
            }
          }
        }
      }
      
      let maxCount = 0;
      const chromaHsl = rgbToHsl(chromaKey.r, chromaKey.g, chromaKey.b);
      const lookingForMagenta = chromaHsl.h >= 270 && chromaHsl.h <= 330;
      const lookingForGreen = chromaHsl.h >= 70 && chromaHsl.h <= 170;
      
      for (const [key, count] of colorMap.entries()) {
        if (count > maxCount) {
          const [r, g, b] = key.split(',').map(Number);
          const hsl = rgbToHsl(r, g, b);
          
          const isMagentaLike = hsl.h >= 270 && hsl.h <= 330 && hsl.s > 0.3;
          const isGreenLike = hsl.h >= 70 && hsl.h <= 170 && hsl.s > 0.2 && g > r && g > b;
          
          if ((lookingForMagenta && isMagentaLike) || (lookingForGreen && isGreenLike)) {
            targetColor = { r, g, b };
            maxCount = count;
          }
        }
      }
      
      const targetHsl = rgbToHsl(targetColor.r, targetColor.g, targetColor.b);
      targetIsMagenta = targetHsl.h >= 270 && targetHsl.h <= 330;
      targetIsGreen = targetHsl.h >= 70 && targetHsl.h <= 170;
      colorDetected = true;
    };

    const processChunk = () => {
      const endIndex = Math.min(startIndex + chunkSize * 4, data.length);

      if (!colorDetected) {
        detectBackgroundColor();
      }
      
      // Calculate adaptive fuzz based on detected background
      const adaptiveFuzz = colorDetected ? fuzz * 1.5 : fuzz;

      // Process chunk using HSL-based detection
      for (let i = startIndex; i < endIndex; i += 4) {
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        const alpha = data[i + 3];

        if (alpha === 0) continue;

        // RGB distance check to detected background color
        const rDiff = red - targetColor.r;
        const gDiff = green - targetColor.g;
        const bDiff = blue - targetColor.b;
        const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
        
        let shouldRemove = false;
        
        // Primary check: RGB distance to detected background color
        // Only remove if the pixel looks like the background (not just close in RGB)
        if (distance <= adaptiveFuzz) {
          // Additional safety check: ensure it's actually magenta-ish or green-ish
          if (targetIsMagenta) {
            // For magenta: R and B should be notably higher than G
            // Stricter check to avoid removing character colors
            const looksLikeMagenta = red > green * 1.3 && blue > green * 1.3 && 
                                     (red + blue) > (green * 3) && green < 150;
            shouldRemove = looksLikeMagenta;
          } else if (targetIsGreen) {
            // For green: G should be notably higher than R and B
            // Stricter check to avoid removing character colors
            const looksLikeGreen = green > red * 1.3 && green > blue * 1.3 && 
                                   green > (red + blue) && red < 150 && blue < 150;
            shouldRemove = looksLikeGreen;
          } else {
            shouldRemove = true;
          }
        }
        
        // HSL-based detection - the ONLY secondary detection method
        // This is the single source of truth for chroma key detection
        if (!shouldRemove) {
          if (targetIsMagenta) {
            shouldRemove = isMagentaScreenHSL(red, green, blue, hueTolerance);
          } else if (targetIsGreen) {
            shouldRemove = isGreenScreenHSL(red, green, blue, hueTolerance);
          }
        }
        
        // NO fallback patterns - HSL detection is authoritative
        
        if (shouldRemove) {
          data[i + 3] = 0;
        }
      }
      
      // Edge cleanup pass - only for semi-transparent pixels, use HSL detection
      for (let i = startIndex; i < endIndex; i += 4) {
        const alpha = data[i + 3];
        if (alpha === 0 || alpha === 255) continue;
        
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        
        // Use the same strict HSL detection for edge cleanup
        let isChromaEdge = false;
        if (targetIsMagenta) {
          isChromaEdge = isMagentaScreenHSL(red, green, blue, hueTolerance * 1.5);
        } else if (targetIsGreen) {
          isChromaEdge = isGreenScreenHSL(red, green, blue, hueTolerance * 1.5);
        }
        
        if (isChromaEdge) {
          data[i + 3] = Math.floor(alpha * 0.3); // Reduce alpha significantly
        }
      }

      // Report progress
      const progress = Math.min(100, Math.round((endIndex / data.length) * 100));
      onProgress?.(progress);

      // Continue processing or finish
      if (endIndex < data.length) {
        startIndex = endIndex;
        // Use requestIdleCallback if available for better performance, otherwise setTimeout
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => processChunk(), { timeout: 100 });
        } else {
          setTimeout(() => processChunk(), 0);
        }
      } else {
        onProgress?.(100);
        resolve(imageData);
      }
    };

    processChunk();
  });
}
