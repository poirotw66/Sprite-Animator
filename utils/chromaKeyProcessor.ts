/**
 * Chroma key removal processor using Web Worker for background processing.
 * Provides progress callbacks and non-blocking image processing.
 * Uses HSL color space for more accurate chroma key detection.
 * 
 * @module chromaKeyProcessor
 */

import { logger } from './logger';
import { createAbortError, isAbortError, throwIfAborted } from './abort';
import { applyChromaKey } from './chromaKeyApply';
import type { ChromaKeyAlgorithm } from '../types';

export interface ChromaKeyProgress {
  progress: number; // 0-100
  stage: 'detecting' | 'processing' | 'complete';
}


/** Optional tuning for edge spill suppression; exposed on frontend. */
export interface ChromaKeyOptions {
  /** `forge` (default) or `core` chroma removal. */
  algorithm?: ChromaKeyAlgorithm;
  /** Edge band radius in pixels (1–5). Default from CHROMA_KEY_EDGE_BAND_RADIUS. */
  edgeBandRadius?: number;
  /** Edge color blend strength 0–1 toward opaque neighbors. Default from CHROMA_KEY_EDGE_BLEND. */
  edgeBlend?: number;
  /** Guided sheet path: skip aggressive hole/clothing specials (core only). */
  guided?: boolean;
  forgeThreshold?: number;
  forgeEdgeThreshold?: number;
}

/**
 * Removes chroma key background using Web Worker for non-blocking processing.
 * Falls back to main thread processing if Web Worker is not available.
 *
 * @param base64Image - Base64 encoded image with chroma key background
 * @param chromaKey - RGB color to remove (default: {r: 255, g: 0, b: 255} for #FF00FF)
 * @param fuzzPercent - Tolerance percentage (0-100, default: 10)
 * @param onProgress - Optional callback for progress updates (0-100)
 * @param options - Optional edge tuning (edgeBandRadius, edgeBlend)
 * @returns Promise resolving to base64 encoded image with transparent background
 */
export const removeChromaKeyWithWorker = async (
  base64Image: string,
  chromaKey: { r: number; g: number; b: number } = { r: 255, g: 0, b: 255 },
  fuzzPercent: number = 10,
  onProgress?: (progress: number) => void,
  options?: ChromaKeyOptions,
  signal?: AbortSignal
): Promise<string> => {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const handleAbort = () => {
      img.src = '';
      reject(createAbortError());
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    img.onload = async () => {
      signal?.removeEventListener('abort', handleAbort);
      try {
        throwIfAborted(signal);
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
        const refetchImageData = () => ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (typeof Worker !== 'undefined') {
          try {
            const processed = await processWithWorker(
              imageData,
              refetchImageData,
              chromaKey,
              fuzzPercent,
              onProgress,
              options,
              signal
            );
            ctx.putImageData(processed, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (workerError) {
            if (isAbortError(workerError)) {
              throw workerError;
            }
            logger.warn('Web Worker processing failed, falling back to main thread', workerError);
            const freshImageData = refetchImageData();
            const processed = await processInMainThread(
              freshImageData,
              chromaKey,
              fuzzPercent,
              onProgress,
              options,
              signal
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
            onProgress,
            options,
            signal
          );
          ctx.putImageData(processed, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Processing failed'));
      }
    };

    img.onerror = () => {
      signal?.removeEventListener('abort', handleAbort);
      reject(new Error('Failed to load image'));
    };

    img.crossOrigin = 'anonymous';
    img.src = base64Image;
  });
};

/**
 * Prepare RGBA buffer for postMessage transfer. When the full backing buffer is
 * used by the ImageData view, transfer avoids a copy; otherwise slice() keeps
 * a valid view on the main thread for fallback paths.
 */
function getPixelBufferTransferSource(data: Uint8ClampedArray): {
  buffer: ArrayBuffer;
  byteOffset: number;
  byteLength: number;
  transferList: [ArrayBuffer];
} {
  const { buffer, byteOffset, byteLength } = data;
  if (byteOffset === 0 && byteLength === buffer.byteLength) {
    return { buffer, byteOffset: 0, byteLength, transferList: [buffer] };
  }
  const copy = data.slice();
  return {
    buffer: copy.buffer,
    byteOffset: 0,
    byteLength: copy.byteLength,
    transferList: [copy.buffer],
  };
}

/**
 * Process image using Web Worker
 */
function processWithWorker(
  imageData: ImageData,
  refetchImageData: () => ImageData,
  chromaKey: { r: number; g: number; b: number },
  fuzzPercent: number,
  onProgress?: (progress: number) => void,
  options?: ChromaKeyOptions,
  signal?: AbortSignal
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(
        new URL('../workers/chromaKeyWorker.ts', import.meta.url),
        { type: 'module' }
      );

      const requestId = `chroma-key-${Date.now()}-${Math.random()}`;
      const handleAbort = () => {
        worker.terminate();
        reject(createAbortError());
      };

      signal?.addEventListener('abort', handleAbort, { once: true });

      worker.onmessage = (e: MessageEvent) => {
        const {
          type,
          progress,
          pixelBuffer,
          byteOffset: outByteOffset,
          byteLength: outByteLength,
          width,
          height,
          error,
          id,
        } = e.data as {
          type: string;
          progress?: number;
          pixelBuffer?: ArrayBuffer;
          byteOffset?: number;
          byteLength?: number;
          width?: number;
          height?: number;
          error?: string;
          id?: string;
        };

        if (id !== requestId) return;

        if (type === 'progress' && progress !== undefined) {
          onProgress?.(progress);
        } else if (
          type === 'complete' &&
          pixelBuffer &&
          width !== undefined &&
          height !== undefined
        ) {
          signal?.removeEventListener('abort', handleAbort);
          worker.terminate();
          const bytes = outByteLength ?? width * height * 4;
          const pixels = new Uint8ClampedArray(
            pixelBuffer,
            outByteOffset ?? 0,
            bytes
          );
          const result = new ImageData(pixels, width, height);
          resolve(result);
        } else if (type === 'error') {
          signal?.removeEventListener('abort', handleAbort);
          worker.terminate();
          reject(new Error(error || 'Worker processing failed'));
        }
      };

      worker.onerror = (error) => {
        signal?.removeEventListener('abort', handleAbort);
        worker.terminate();
        reject(error);
      };

      const { buffer, byteOffset, byteLength, transferList } = getPixelBufferTransferSource(
        imageData.data
      );

      worker.postMessage(
        {
          type: 'process',
          pixelBuffer: buffer,
          byteOffset,
          byteLength,
          width: imageData.width,
          height: imageData.height,
          chromaKey,
          fuzzPercent,
          edgeBandRadius: options?.edgeBandRadius,
          edgeBlend: options?.edgeBlend,
          guided: options?.guided,
          algorithm: options?.algorithm,
          forgeThreshold: options?.forgeThreshold,
          forgeEdgeThreshold: options?.forgeEdgeThreshold,
          id: requestId,
        },
        transferList
      );
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
  onProgress?: (progress: number) => void,
  options?: ChromaKeyOptions,
  signal?: AbortSignal
): Promise<ImageData> {
  // Fallback when Web Workers are unavailable. Runs the SAME shared algorithm
  // as the worker (synchronously); the brief main-thread block is acceptable
  // because workers are near-universally supported and this path is rare.
  return new Promise((resolve, reject) => {
    try {
      throwIfAborted(signal);
      applyChromaKey(
        imageData.data,
        imageData.width,
        imageData.height,
        chromaKey,
        {
          algorithm: options?.algorithm,
          fuzzPercent,
          onProgress: (progress) => onProgress?.(progress),
          edgeBandRadius: options?.edgeBandRadius,
          edgeBlend: options?.edgeBlend,
          guided: options?.guided,
          forgeThreshold: options?.forgeThreshold,
          forgeEdgeThreshold: options?.forgeEdgeThreshold,
        }
      );
      resolve(imageData);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
