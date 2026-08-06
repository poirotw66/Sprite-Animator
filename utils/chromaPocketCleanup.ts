/**
 * Guided-mode enclosed chroma-screen pocket cleanup.
 *
 * Clears key-dominant chroma residue inside the subject silhouette without
 * touching neutral gray / black line art (spread < 12) or intentional interior
 * key-colored accents (excess >= the intentional threshold, e.g. 4×4 props).
 *
 * Green residue is "G above both R and B" (one channel over two); magenta
 * residue is "R and B both above G" (two channels over one), so the magenta
 * predicate uses min(r, b) - g and additionally requires the two dominant
 * channels to stay balanced — real magenta spill inherits the (255,0,255) key,
 * while pink/rose ink, lips and blush lean red and violet hair leans blue.
 */

export type ChromaPocketTarget = 'green' | 'magenta';

export interface GuidedChromaPocketOptions {
  key: { r: number; g: number; b: number };
  keyMax: number;
  alphaThreshold?: number;
  /** Defaults to 'green' so existing green call sites keep their behaviour. */
  target?: ChromaPocketTarget;
}

const INTENTIONAL_GREEN_EXCESS = 45;

/**
 * Magenta counterparts of the green pocket constants. Derived by analogy only —
 * the green values were tuned against real sticker failures (armpit / hair-gap
 * residue), these have NOT been tuned against real magenta failures, so each is
 * set to be equally or more conservative (keeps more pixels) than its green
 * counterpart. Retune when real magenta hard cases exist.
 */
/** Green counterpart: greenExcess > 6. Raised so faint pink casts survive. */
const MAGENTA_POCKET_MIN_EXCESS = 10;
/** Green counterpart: INTENTIONAL_GREEN_EXCESS = 45. Lowered so more magenta reads as intentional. */
const INTENTIONAL_MAGENTA_EXCESS = 38;
/** Max |R − B| for spill: mirrors the `b <= r + 40` magenta direction gate in chromaSimilarity. */
const MAGENTA_POCKET_BALANCE = 40;
/** Green counterpart: >= 2 same-class neighbours. Raised so lone/paired pixels stay. */
const MAGENTA_POCKET_MIN_NEIGHBORS = 3;

function isPocketGreenResidue(r: number, g: number, b: number): boolean {
  const greenExcess = g - Math.max(r, b);
  return greenExcess > 6 && greenExcess < INTENTIONAL_GREEN_EXCESS && g > r && g > b;
}

function isPocketMagentaResidue(r: number, g: number, b: number): boolean {
  if (r <= g || b <= g) return false;
  if (Math.abs(r - b) > MAGENTA_POCKET_BALANCE) return false;
  const magentaExcess = Math.min(r, b) - g;
  return magentaExcess > MAGENTA_POCKET_MIN_EXCESS && magentaExcess < INTENTIONAL_MAGENTA_EXCESS;
}

/** Same-class neighbour test used for the 5×5 cluster count, per key color. */
function isNeighborSpill(target: ChromaPocketTarget, r: number, g: number, b: number): boolean {
  if (target === 'magenta') {
    return (
      r > g &&
      b > g &&
      Math.abs(r - b) <= MAGENTA_POCKET_BALANCE &&
      Math.min(r, b) - g > MAGENTA_POCKET_MIN_EXCESS
    );
  }
  return g > r && g > b && g - Math.max(r, b) > 6;
}

function countSpillNeighbors(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  x: number,
  y: number,
  alphaThreshold: number,
  target: ChromaPocketTarget
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
      if (isNeighborSpill(target, nr, ng, nb)) count++;
    }
  }
  return count;
}

/**
 * Mutates RGBA buffer in place. Returns pixels cleared.
 */
export function clearGuidedChromaPockets(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  options: GuidedChromaPocketOptions
): number {
  const alphaThreshold = options.alphaThreshold ?? 15;
  const target = options.target ?? 'green';
  const minNeighbors = target === 'magenta' ? MAGENTA_POCKET_MIN_NEIGHBORS : 2;
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

      const isResidue =
        target === 'magenta' ? isPocketMagentaResidue(r, g, b) : isPocketGreenResidue(r, g, b);
      if (!isResidue) continue;

      const spillNeighbors = countSpillNeighbors(
        data,
        width,
        height,
        x,
        y,
        alphaThreshold,
        target
      );
      // Lone neon accent inside the subject (0–1 spill neighbors) stays;
      // pocket clusters (armpit / hair gaps) have >= 2 spill neighbors
      // (>= 3 for magenta, which has no tuned failure cases yet).
      if (spillNeighbors < minNeighbors) continue;

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
