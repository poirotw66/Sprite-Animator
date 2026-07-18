/** Post-chroma fringe metrics for sticker QA (headless-safe). */

import type { ChromaKeyColorType } from '../types';

export interface ChromaFringeMetrics {
  chromaKeyColor: ChromaKeyColorType;
  edgeChromaCount: number;
  pocketChromaCount: number;
  chromaFringeCount: number;
  /** @deprecated Green-only compatibility aliases. */
  edgeGreenCount: number;
  /** @deprecated Green-only compatibility aliases. */
  pocketGreenCount: number;
  /** @deprecated Green-only compatibility aliases. */
  oliveFringeCount: number;
}

const ALPHA_BG = 15;
const NEAR_TRANSPARENT_RADIUS = 3;
const KEY_EXCESS_MIN = 6;
const DESPILLED_KEY_MIN = 8;

function isNearTransparent(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (data[(ny * width + nx) * 4 + 3]! <= ALPHA_BG) return true;
    }
  }
  return false;
}

/** Count key-color and despilled fringe pixels on a sliced sticker frame. */
export function measureChromaFringe(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  chromaKeyColor: ChromaKeyColorType = 'green'
): ChromaFringeMetrics {
  let edgeChromaCount = 0;
  let pocketChromaCount = 0;
  let chromaFringeCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3]!;
      if (a <= ALPHA_BG) continue;

      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const keyExcess = chromaKeyColor === 'green'
        ? g - Math.max(r, b)
        : Math.min(r, b) - g;
      const atEdge = isNearTransparent(data, width, height, x, y, NEAR_TRANSPARENT_RADIUS);

      if (keyExcess > KEY_EXCESS_MIN) {
        if (atEdge) edgeChromaCount++;
        else pocketChromaCount++;
        continue;
      }

      // Detect darker, partially despilled key color left on an alpha edge.
      const despilledKey = chromaKeyColor === 'green'
        ? Math.min(r, g) - b
        : Math.min(r, b) - g;
      if (
        atEdge &&
        despilledKey > DESPILLED_KEY_MIN &&
        (chromaKeyColor === 'magenta' || g >= r) &&
        (r + g + b) / 3 < 140
      ) {
        chromaFringeCount++;
      }
    }
  }

  return {
    chromaKeyColor,
    edgeChromaCount,
    pocketChromaCount,
    chromaFringeCount,
    edgeGreenCount: chromaKeyColor === 'green' ? edgeChromaCount : 0,
    pocketGreenCount: chromaKeyColor === 'green' ? pocketChromaCount : 0,
    oliveFringeCount: chromaKeyColor === 'green' ? chromaFringeCount : 0,
  };
}

export const CHROMA_FRINGE_WARN_EDGE = 10;
export const CHROMA_FRINGE_WARN_POCKET = 8;
export const CHROMA_FRINGE_WARN_DESPILL = 12;
/** @deprecated Green-only compatibility aliases. */
export const CHROMA_FRINGE_WARN_EDGE_GREEN = CHROMA_FRINGE_WARN_EDGE;
/** @deprecated Green-only compatibility aliases. */
export const CHROMA_FRINGE_WARN_POCKET_GREEN = CHROMA_FRINGE_WARN_POCKET;
/** @deprecated Green-only compatibility aliases. */
export const CHROMA_FRINGE_WARN_OLIVE = CHROMA_FRINGE_WARN_DESPILL;
