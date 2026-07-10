/**
 * Minimal green spill cleanup for forge chroma key — edge-only, white-border focused.
 */

const NEAR_WHITE_THRESHOLD = 200;
const GREEN_EXCESS_MIN = 3;

function isNearWhite(r: number, g: number, b: number): boolean {
  return r >= NEAR_WHITE_THRESHOLD && g >= NEAR_WHITE_THRESHOLD && b >= NEAR_WHITE_THRESHOLD;
}

function touchesTransparent(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
      if (data[(ny * width + nx) * 4 + 3]! === 0) return true;
    }
  }
  return false;
}

/**
 * Pull green spill off forge edge pixels (especially white sticker strokes).
 * Mutates `data` in place; only touches opaque pixels beside transparency.
 */
export function despillForgeGreenFringe(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3]!;
      if (a === 0) continue;
      if (!touchesTransparent(data, width, height, x, y)) continue;

      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const rbMax = Math.max(r, b);
      const greenExcess = g - rbMax;
      if (greenExcess <= GREEN_EXCESS_MIN) continue;

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
