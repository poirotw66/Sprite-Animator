/**
 * Minimal green spill cleanup for forge chroma key — edge-only.
 * Pass 1: erase isolated green chroma specks near transparency.
 * Pass 2: pull green tint off white / light edge pixels.
 */

const NEAR_WHITE_THRESHOLD = 200;
const GREEN_EXCESS_MIN = 3;
const EDGE_RADIUS = 2;
const TRANSPARENT_ALPHA_MAX = 20;
const CHROMA_ERASE_DISTANCE = 100;
const CHROMA_ERASE_GREEN_EXCESS = 4;
const MAX_GREEN_SPILL_NEIGHBORS = 2;

function isNearWhite(r: number, g: number, b: number): boolean {
  return r >= NEAR_WHITE_THRESHOLD && g >= NEAR_WHITE_THRESHOLD && b >= NEAR_WHITE_THRESHOLD;
}

function greenExcess(r: number, g: number, b: number): number {
  return g - Math.max(r, b);
}

function distanceToGreenKey(r: number, g: number, b: number): number {
  return Math.sqrt(r * r + (g - 255) ** 2 + b * b);
}

function isNearTransparency(
  alphaGrid: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number = EDGE_RADIUS
): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
      if (alphaGrid[ny * width + nx]! <= TRANSPARENT_ALPHA_MAX) return true;
    }
  }
  return false;
}

function countGreenSpillNeighbors(
  data: Uint8ClampedArray,
  alphaGrid: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  let count = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (alphaGrid[ny * width + nx]! <= TRANSPARENT_ALPHA_MAX) continue;
      const ni = (ny * width + nx) * 4;
      const nr = data[ni]!;
      const ng = data[ni + 1]!;
      const nb = data[ni + 2]!;
      if (ng > nr && ng > nb && greenExcess(nr, ng, nb) > CHROMA_ERASE_GREEN_EXCESS) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Pull green spill off forge edge pixels and erase isolated green specks.
 * Mutates `data` in place.
 */
export function despillForgeGreenFringe(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const total = width * height;
  const alphaGrid = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    alphaGrid[p] = data[p * 4 + 3]!;
  }

  const eraseMask = new Uint8Array(total);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const a = data[i + 3]!;
      if (a <= TRANSPARENT_ALPHA_MAX) continue;
      if (!isNearTransparency(alphaGrid, width, height, x, y)) continue;

      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const excess = greenExcess(r, g, b);
      if (excess <= CHROMA_ERASE_GREEN_EXCESS && distanceToGreenKey(r, g, b) >= CHROMA_ERASE_DISTANCE) {
        continue;
      }

      const spillNeighbors = countGreenSpillNeighbors(data, alphaGrid, width, height, x, y);
      const chromaLike =
        distanceToGreenKey(r, g, b) < CHROMA_ERASE_DISTANCE ||
        (g > r && g > b && excess > CHROMA_ERASE_GREEN_EXCESS);

      if (chromaLike && spillNeighbors <= MAX_GREEN_SPILL_NEIGHBORS && !isNearWhite(r, g, b)) {
        eraseMask[p] = 1;
      }
    }
  }

  for (let p = 0; p < total; p++) {
    if (eraseMask[p] !== 1) continue;
    data[p * 4 + 3] = 0;
    alphaGrid[p] = 0;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const a = data[i + 3]!;
      if (a <= TRANSPARENT_ALPHA_MAX) continue;
      if (!isNearTransparency(alphaGrid, width, height, x, y)) continue;

      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const excess = greenExcess(r, g, b);
      if (excess <= GREEN_EXCESS_MIN) continue;

      const rbMax = Math.max(r, b);
      if (isNearWhite(r, g, b)) {
        data[i + 1] = rbMax;
        continue;
      }

      if (g > r && g > b) {
        data[i + 1] = Math.round(Math.min(g, rbMax + 2));
      }
    }
  }
}
