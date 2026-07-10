/**
 * Guided-mode enclosed green-screen pocket cleanup.
 *
 * Clears green-dominant chroma residue inside the subject silhouette without
 * touching neutral gray / black line art (spread < 12) or intentional interior
 * greens (greenExcess >= 45, e.g. 4×4 props).
 */

export interface GuidedGreenPocketOptions {
  key: { r: number; g: number; b: number };
  keyMax: number;
  alphaThreshold?: number;
}

function countGreenSpillNeighbors(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  x: number,
  y: number,
  alphaThreshold: number
): number {
  let count = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = (ny * width + nx) * 4;
      if (data[ni + 3]! <= alphaThreshold) continue;
      const nr = data[ni]!;
      const ng = data[ni + 1]!;
      const nb = data[ni + 2]!;
      if (ng > nr && ng > nb && ng - Math.max(nr, nb) > 6) count++;
    }
  }
  return count;
}

const INTENTIONAL_GREEN_EXCESS = 45;

function isPocketGreenResidue(r: number, g: number, b: number): boolean {
  const greenExcess = g - Math.max(r, b);
  return greenExcess > 6 && greenExcess < INTENTIONAL_GREEN_EXCESS && g > r && g > b;
}

/**
 * Mutates RGBA buffer in place. Returns pixels cleared.
 */
export function clearGuidedGreenPockets(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  options: GuidedGreenPocketOptions
): number {
  const alphaThreshold = options.alphaThreshold ?? 15;
  const total = width * height;
  const clearMask = new Uint8Array(total);
  let cleared = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const idx = p * 4;
      if (data[idx + 3]! <= alphaThreshold) continue;

      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (spread < 12) continue;

      if (Math.max(r, g, b) < 18) continue;

      if (!isPocketGreenResidue(r, g, b)) continue;

      const greenNeighbors = countGreenSpillNeighbors(
        data,
        width,
        height,
        x,
        y,
        alphaThreshold
      );
      // Lone neon accent inside the subject (0–1 green neighbors) stays;
      // pocket clusters (armpit / hair gaps) have >= 2 green neighbors.
      if (greenNeighbors < 2) continue;

      clearMask[p] = 1;
    }
  }

  for (let p = 0; p < total; p++) {
    if (clearMask[p] !== 1) continue;
    data[p * 4 + 3] = 0;
    cleared++;
  }

  return cleared;
}
