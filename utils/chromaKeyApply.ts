/**
 * Dispatch chroma-key removal to forge (RGB flood) or core (HSL multi-pass).
 */

import type { ChromaKeyAlgorithm } from '../types';
import {
  CHROMA_KEY_FUZZ,
  CHROMA_KEY_EDGE_BAND_RADIUS,
  CHROMA_KEY_EDGE_BLEND,
  CHROMA_KEY_FORGE_THRESHOLD,
  CHROMA_KEY_FORGE_EDGE_THRESHOLD,
  DEFAULT_CHROMA_KEY_ALGORITHM,
} from './constants';
import { processChromaKey } from './chromaKeyCore';
import { processChromaKeyForge } from './chromaKeyForge';
import { despillForgeGreenFringe } from './chromaForgeGreenFringe';

export interface ApplyChromaKeyOptions {
  algorithm?: ChromaKeyAlgorithm;
  guided?: boolean;
  fuzzPercent?: number;
  edgeBandRadius?: number;
  edgeBlend?: number;
  forgeThreshold?: number;
  forgeEdgeThreshold?: number;
  onProgress?: (progress: number) => void;
}

export function applyChromaKey(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  chromaKey: { r: number; g: number; b: number },
  options: ApplyChromaKeyOptions = {}
): Uint8ClampedArray {
  const algorithm = options.algorithm ?? DEFAULT_CHROMA_KEY_ALGORITHM;

  if (algorithm === 'forge') {
    processChromaKeyForge(data, width, height, chromaKey, {
      threshold: options.forgeThreshold ?? CHROMA_KEY_FORGE_THRESHOLD,
      edgeThreshold: options.forgeEdgeThreshold ?? CHROMA_KEY_FORGE_EDGE_THRESHOLD,
    });
    if (chromaKey.g === 255 && chromaKey.r === 0 && chromaKey.b === 0) {
      despillForgeGreenFringe(data, width, height);
    }
    return data;
  }

  return processChromaKey(
    data,
    width,
    height,
    chromaKey,
    options.fuzzPercent ?? CHROMA_KEY_FUZZ,
    options.onProgress ?? (() => {}),
    options.edgeBandRadius ?? CHROMA_KEY_EDGE_BAND_RADIUS,
    options.edgeBlend ?? CHROMA_KEY_EDGE_BLEND,
    { guided: options.guided }
  );
}
