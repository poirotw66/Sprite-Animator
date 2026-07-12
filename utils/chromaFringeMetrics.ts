/**
 * Post-chroma fringe metrics for sticker QA (headless-safe).
 */

export interface ChromaFringeMetrics {
  /** Opaque green-tinted pixels within a few px of transparency. */
  edgeGreenCount: number;
  /** Opaque green-tinted pixels away from the outer edge (enclosed pockets). */
  pocketGreenCount: number;
  /** Olive / yellow-green AA pixels near transparency. */
  oliveFringeCount: number;
}

const ALPHA_BG = 15;
const NEAR_TRANSPARENT_RADIUS = 3;
const GREEN_EXCESS_MIN = 6;
const OLIVE_YELLOW_GREEN_MIN = 4;

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

/** Count green / olive fringe pixels on a sliced sticker frame. */
export function measureChromaFringe(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number
): ChromaFringeMetrics {
  let edgeGreenCount = 0;
  let pocketGreenCount = 0;
  let oliveFringeCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3]!;
      if (a <= ALPHA_BG) continue;

      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const greenExcess = g - Math.max(r, b);
      const atEdge = isNearTransparent(data, width, height, x, y, NEAR_TRANSPARENT_RADIUS);

      if (greenExcess > GREEN_EXCESS_MIN) {
        if (atEdge) edgeGreenCount++;
        else pocketGreenCount++;
        continue;
      }

      const yellowGreen = Math.min(r, g) - b;
      if (
        atEdge &&
        yellowGreen > OLIVE_YELLOW_GREEN_MIN &&
        g >= r - 4 &&
        r - g <= 12 &&
        (r + g + b) / 3 < 140
      ) {
        oliveFringeCount++;
      }
    }
  }

  return { edgeGreenCount, pocketGreenCount, oliveFringeCount };
}

export const CHROMA_FRINGE_WARN_EDGE_GREEN = 10;
/** Informational only — not used for QA warnings (see stickerFrameQa scoreChromaFringe). */
export const CHROMA_FRINGE_WARN_POCKET_GREEN = 8;
export const CHROMA_FRINGE_WARN_OLIVE = 12;
