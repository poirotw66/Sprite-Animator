/**
 * Chroma key removal processor using Web Worker for background processing.
 * Provides progress callbacks and non-blocking image processing.
 * 
 * @module chromaKeyProcessor
 */

import { logger } from './logger';

export interface ChromaKeyProgress {
  progress: number; // 0-100
  stage: 'detecting' | 'processing' | 'complete';
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
 * 
 * @example
 * ```typescript
 * const processed = await removeChromaKeyWithWorker(
 *   spriteSheetBase64,
 *   {r: 255, g: 0, b: 255},
 *   10,
 *   (progress) => console.log(`Progress: ${progress}%`)
 * );
 * ```
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

        // Draw the image
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Check if Web Worker is supported
        if (typeof Worker !== 'undefined') {
          try {
            // Use Web Worker for processing
            const processed = await processWithWorker(
              imageData,
              chromaKey,
              fuzzPercent,
              onProgress
            );

            // Put processed data back
            ctx.putImageData(processed, 0, 0);

            // Return as base64
            resolve(canvas.toDataURL('image/png'));
          } catch (workerError) {
            logger.warn('Web Worker processing failed, falling back to main thread', workerError);
            // Fallback to main thread processing
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
          // Web Worker not supported, use main thread
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
 * Note: ImageData cannot be transferred directly, so we send the raw data
 */
function processWithWorker(
  imageData: ImageData,
  chromaKey: { r: number; g: number; b: number },
  fuzzPercent: number,
  onProgress?: (progress: number) => void
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    try {
      // Create worker
      const worker = new Worker(
        new URL('../workers/chromaKeyWorker.ts', import.meta.url),
        { type: 'module' }
      );

      const requestId = `chroma-key-${Date.now()}-${Math.random()}`;

      // Handle worker messages
      worker.onmessage = (e: MessageEvent) => {
        const { type, progress, data: processedData, width, height, error, id } = e.data;

        if (id !== requestId) return;

        if (type === 'progress' && progress !== undefined) {
          onProgress?.(progress);
        } else if (type === 'complete' && processedData && width && height) {
          worker.terminate();
          // Reconstruct ImageData from processed data
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

      // Send processing request with raw data (ImageData cannot be transferred)
      worker.postMessage({
        type: 'process',
        data: Array.from(imageData.data), // Convert to regular array for transfer
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
 * Process image in main thread (fallback)
 * Uses chunked processing to avoid blocking the UI
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
    const chunkSize = 50000; // Process 50000 pixels at a time (larger chunks for better performance)
    let startIndex = 0;
    let targetColor = chromaKey;
    let colorDetected = false;

    // Background color detection (only once)
    const detectBackgroundColor = () => {
      const width = imageData.width;
      const height = imageData.height;
      const sampleSize = Math.min(100, Math.floor(Math.sqrt(totalPixels) / 10));
      const colorMap = new Map<string, number>();
      
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const idx = (y * width + x) * 4;
          if (idx < data.length) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const key = `${r},${g},${b}`;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
          }
        }
      }
      
      let maxCount = 0;
      
      // Detect if we're looking for magenta or green based on chromaKey
      const lookingForMagenta = chromaKey.r > 200 && chromaKey.g < 100 && chromaKey.b > 200;
      const lookingForGreen = chromaKey.g > 100 && chromaKey.r < 100;
      
      for (const [key, count] of colorMap.entries()) {
        if (count > maxCount) {
          const [r, g, b] = key.split(',').map(Number);
          // Match magenta-like colors (high R, low G, high B)
          const isMagentaLike = r > 180 && g < 100 && b > 100;
          // Match green screen colors (low R, high G, low-medium B)
          // Standard green screen #00B140 = R:0, G:177, B:64
          const isGreenLike = g > 80 && r < 120 && b < 150 && g > r && g > b;
          
          if ((lookingForMagenta && isMagentaLike) || (lookingForGreen && isGreenLike)) {
            targetColor = { r, g, b };
            maxCount = count;
          }
        }
      }
      colorDetected = true;
    };

    const processChunk = () => {
      const endIndex = Math.min(startIndex + chunkSize * 4, data.length);

      // Detect background color on first chunk
      if (!colorDetected) {
        detectBackgroundColor();
      }

      // Detect if target is magenta-like or green-like (outside loop for edge cleanup)
      const targetIsMagenta = targetColor.r > 200 && targetColor.g < 100 && targetColor.b > 200;
      const targetIsGreen = targetColor.g > 100 && targetColor.r < 100;

      // Process chunk
      for (let i = startIndex; i < endIndex; i += 4) {
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        const alpha = data[i + 3];

        if (alpha === 0) continue;

        const rDiff = red - targetColor.r;
        const gDiff = green - targetColor.g;
        const bDiff = blue - targetColor.b;
        const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

        const rClose = Math.abs(red - targetColor.r) <= fuzz;
        const gClose = Math.abs(green - targetColor.g) <= fuzz;
        const bClose = Math.abs(blue - targetColor.b) <= fuzz;
        
        // Conservative magenta detection (when target is magenta):
        // IMPORTANT: Only detect PURE magenta screen colors, not character pinks/purples
        // Magenta screen is typically very saturated magenta with high R and B, low G
        const isPureMagenta = red > 200 && green < 60 && blue > 200 && (red + blue) > (green * 3);
        const isMagentaScreen = red > 180 && green < 80 && blue > 180 && (red - green) > 120 && (blue - green) > 120;
        const isBrightMagentaScreen = red > 220 && green < 100 && blue > 220 && (red + blue) > green * 4;
        const isNeonMagenta = red > 230 && green < 80 && blue > 230;
        // For edges/anti-aliasing of magenta screen - still quite strict
        const isMagentaEdge = red > 150 && green < 100 && blue > 150 && (red - green) > 80 && (blue - green) > 80;
        
        // Expanded green detection (when target is green)
        // IMPORTANT: Only detect green SCREEN colors, not character greens (eyes, clothes, etc.)
        // Standard green screen #00B140 = R:0, G:177, B:64
        // Key: Green screen has VERY LOW red and relatively low blue
        
        // Pure bright green (like #00FF00) - very low R and B
        const isPureGreen = green > 180 && red < 50 && blue < 50;
        // Standard green screen (#00B140 range) - R must be very low
        const isStandardGreenScreen = green > 120 && red < 50 && blue < 100 && (green - red) > 100 && (green - blue) > 50;
        // Bright green screen variations - strict conditions
        const isBrightGreenScreen = green > 150 && red < 60 && blue < 80 && green > red * 3 && green > blue * 2;
        // Neon/saturated green - almost pure green channel
        const isNeonGreen = green > 200 && red < 60 && blue < 60;
        // Darker green screen - still needs very low R
        const isDarkGreenScreen = green > 100 && green < 200 && red < 40 && blue < 80 && green > (red + blue) * 1.5;
        // For edges/anti-aliasing of green screen - stricter
        const isGreenEdge = green > 100 && red < 60 && blue < 90 && (green - red) > 60 && (green - blue) > 30;
        
        const isWithinDistance = distance <= fuzz;
        const isCloseToTarget = rClose && gClose && bClose;
        
        // Apply appropriate detection based on target color
        const magentaMatch = targetIsMagenta && (isPureMagenta || 
            isMagentaScreen ||
            isBrightMagentaScreen ||
            isNeonMagenta ||
            isMagentaEdge ||
            (distance < fuzz * 1.5));
        
        const greenMatch = targetIsGreen && (isPureGreen ||
            isStandardGreenScreen ||
            isBrightGreenScreen ||
            isNeonGreen ||
            isDarkGreenScreen ||
            isGreenEdge ||
            (distance < fuzz * 1.8));
        
        if (isCloseToTarget || isWithinDistance || magentaMatch || greenMatch) {
          data[i + 3] = 0;
        }
      }
      
      // Edge cleanup pass for this chunk: remove background color tint from semi-transparent pixels
      for (let i = startIndex; i < endIndex; i += 4) {
        const alpha = data[i + 3];
        
        // Skip fully transparent or fully opaque pixels
        if (alpha === 0 || alpha === 255) continue;
        
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        
        // Check if this semi-transparent pixel has background color tint
        if (targetIsMagenta) {
          // Check for magenta/pink tint in semi-transparent pixels
          const hasMagentaTint = red > 150 && blue > 100 && green < 120 && (red + blue) > (green * 2.5);
          if (hasMagentaTint) {
            // Make it more transparent or fully transparent based on how strong the tint is
            const tintStrength = (red + blue) / (green + 1);
            if (tintStrength > 3.5) {
              data[i + 3] = 0; // Remove completely if strong tint
            } else {
              data[i + 3] = Math.floor(alpha * 0.5); // Reduce alpha by 50%
            }
          }
        } else if (targetIsGreen) {
          // Check for green tint in semi-transparent pixels
          const hasGreenTint = green > 120 && red < 100 && blue < 100 && (green - red) > 50 && (green - blue) > 50;
          if (hasGreenTint) {
            // Make it more transparent or fully transparent based on how strong the tint is
            const tintStrength = green / ((red + blue) / 2 + 1);
            if (tintStrength > 2.5) {
              data[i + 3] = 0; // Remove completely if strong tint
            } else {
              data[i + 3] = Math.floor(alpha * 0.5); // Reduce alpha by 50%
            }
          }
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
