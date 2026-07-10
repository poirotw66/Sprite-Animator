/**
 * Web Worker entry for chroma key removal. The algorithm lives in
 * utils/chromaKeyCore (shared with the main-thread fallback); this file only
 * handles message passing and transferable buffers.
 *
 * @module chromaKeyWorker
 */

import { applyChromaKey } from '../utils/chromaKeyApply';
import type { ChromaKeyAlgorithm } from '../types';

/** Inbound: chroma key job (pixel buffer is transferred and detached on the sender). */
export interface ChromaKeyWorkerProcessMessage {
  type: 'process';
  /** RGBA pixel buffer (transferred from main thread). */
  pixelBuffer: ArrayBuffer;
  /** Byte offset into `pixelBuffer` (default 0). */
  byteOffset?: number;
  /** Byte length of the RGBA region (typically width * height * 4). */
  byteLength: number;
  width: number;
  height: number;
  chromaKey: { r: number; g: number; b: number };
  fuzzPercent: number;
  /** Edge band radius (px); default 2. */
  edgeBandRadius?: number;
  /** Edge color blend 0–1; default 0.22. */
  edgeBlend?: number;
  /** Guided sheet path: skip aggressive hole/clothing specials (core only). */
  guided?: boolean;
  algorithm?: ChromaKeyAlgorithm;
  forgeThreshold?: number;
  forgeEdgeThreshold?: number;
  id?: string;
}

export interface ChromaKeyWorkerCancelMessage {
  type: 'cancel';
  id?: string;
}

export type ChromaKeyWorkerMessage = ChromaKeyWorkerProcessMessage | ChromaKeyWorkerCancelMessage;

export interface ChromaKeyWorkerResponse {
  type: 'progress' | 'complete' | 'error';
  progress?: number; // 0-100
  /** Processed RGBA buffer (transferred to main thread). */
  pixelBuffer?: ArrayBuffer;
  byteOffset?: number;
  byteLength?: number;
  width?: number;
  height?: number;
  error?: string;
  id?: string;
}

// Worker message handler
self.onmessage = function (e: MessageEvent<ChromaKeyWorkerMessage>) {
  if (e.data.type === 'cancel') return;

  if (e.data.type !== 'process') return;

  const {
    id,
    pixelBuffer,
    byteOffset = 0,
    byteLength,
    width,
    height,
    chromaKey,
    fuzzPercent,
    edgeBandRadius,
    edgeBlend,
    guided,
    algorithm,
    forgeThreshold,
    forgeEdgeThreshold,
  } = e.data;

  const expectedBytes = width * height * 4;
  if (!pixelBuffer || byteLength < expectedBytes) {
    self.postMessage({
      type: 'error',
      error: 'Invalid pixel buffer or dimensions',
      id,
    } as ChromaKeyWorkerResponse);
    return;
  }

  try {
    const imageData = new Uint8ClampedArray(pixelBuffer, byteOffset, byteLength);
    const processed = applyChromaKey(
      imageData,
      width,
      height,
      chromaKey,
      {
        algorithm,
        fuzzPercent,
        onProgress: (progress) => {
          self.postMessage({ type: 'progress', progress, id } as ChromaKeyWorkerResponse);
        },
        edgeBandRadius,
        edgeBlend,
        guided,
        forgeThreshold,
        forgeEdgeThreshold,
      }
    );

    self.postMessage(
      {
        type: 'complete',
        pixelBuffer: processed.buffer,
        byteOffset: processed.byteOffset,
        byteLength: processed.byteLength,
        width,
        height,
        id,
      } as ChromaKeyWorkerResponse,
      { transfer: [processed.buffer as ArrayBuffer] }
    );
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      id,
    } as ChromaKeyWorkerResponse);
  }
};
