/**
 * Shared chroma-key removal core (chroma-similarity detection, connectivity
 * masking, despill, halo removal). Pure array math, no DOM — imported by both
 * the Web Worker and the main-thread fallback so both run the SAME algorithm.
 * @module chromaKeyCore
 */

import {
  isChromaLike,
  isChromaSoftEdge,
  fuzzPercentToKeyMax,
  chromaDistanceToKey,
  CHROMA_LIKE_SOFT_EXTRA,
} from './chromaSimilarity';
import { shouldUseGuidedChromaPath } from './chromaGuidedDetect';
import { clearGuidedGreenPockets } from './chromaPocketCleanup';

/**
 * Convert RGB to HSL color space
 * H: 0-360 (hue), S: 0-1 (saturation), L: 0-1 (lightness)
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    default:
      h = ((r - g) / d + 4) * 60;
      break;
  }

  return { h, s, l };
}

const DEFAULT_EDGE_BAND_RADIUS = 2;
const DEFAULT_EDGE_BLEND = 0.22;

/** Pixels with all channels above this are treated as near-white (e.g. white borders); we skip spill/blend to avoid color residue. */
const NEAR_WHITE_THRESHOLD = 240;

function isNearWhite(r: number, g: number, b: number): boolean {
  return r >= NEAR_WHITE_THRESHOLD && g >= NEAR_WHITE_THRESHOLD && b >= NEAR_WHITE_THRESHOLD;
}

export interface ProcessChromaKeyOptions {
  /** true/false wins; undefined → auto-detect regular gutters. */
  guided?: boolean;
  keyMaxOverride?: number;
}

/**
 * Process chroma key removal with progress reporting.
 * Similarity uses shared Y-normalized chroma distance (see chromaSimilarity).
 */
export function processChromaKey(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  chromaKey: { r: number; g: number; b: number },
  fuzzPercent: number,
  onProgress: (progress: number) => void,
  edgeBandRadius: number = DEFAULT_EDGE_BAND_RADIUS,
  edgeBlend: number = DEFAULT_EDGE_BLEND,
  options: ProcessChromaKeyOptions = {}
): Uint8ClampedArray {
  const totalPixels = data.length / 4;
  const keyMax = options.keyMaxOverride ?? fuzzPercentToKeyMax(fuzzPercent);
  const radius = Math.max(1, Math.min(5, Math.round(edgeBandRadius)));
  const blend = Math.max(0, Math.min(1, Number(edgeBlend)));
  const useGuided = shouldUseGuidedChromaPath(
    data,
    width,
    height,
    chromaKey,
    options.guided
  );

  let transparentCount = 0;
  const reportInterval = Math.max(1, Math.floor(totalPixels / 100));

  // Detect the actual background color by sampling corners, edges, and center (so middle cells are represented)
  const sampleSize = Math.min(100, Math.floor(Math.sqrt(totalPixels) / 10));
  // Numeric color key (0xRRGGBB) avoids per-sample string alloc / parsing.
  const colorMap = new Map<number, number>();

  const samplePoints: Array<[number, number]> = [];
  for (let y = 0; y < sampleSize; y++) {
    for (let x = 0; x < sampleSize; x++) {
      samplePoints.push([x, y]);
      samplePoints.push([width - 1 - x, y]);
      samplePoints.push([x, height - 1 - y]);
      samplePoints.push([width - 1 - x, height - 1 - y]);
    }
  }
  // Add center and grid so middle cells (e.g. 4x4 sprite) contribute to dominant color
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  samplePoints.push([cx, cy]);
  samplePoints.push([Math.floor(width * 0.25), cy]);
  samplePoints.push([Math.floor(width * 0.75), cy]);
  samplePoints.push([cx, Math.floor(height * 0.25)]);
  samplePoints.push([cx, Math.floor(height * 0.75)]);

  for (const [x, y] of samplePoints) {
    const idx = (y * width + x) * 4;
    if (idx < data.length) {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const key = (r << 16) | (g << 8) | b;
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }
  }

  let mostCommonColor = chromaKey;
  let maxCount = 0;

  // Detect target type using HSL
  const targetHsl = rgbToHsl(chromaKey.r, chromaKey.g, chromaKey.b);
  const lookingForMagenta = targetHsl.h >= 270 && targetHsl.h <= 330;
  const lookingForGreen = targetHsl.h >= 70 && targetHsl.h <= 170;

  for (const [key, count] of colorMap.entries()) {
    if (count > maxCount) {
      const r = (key >> 16) & 255;
      const g = (key >> 8) & 255;
      const b = key & 255;
      const hsl = rgbToHsl(r, g, b);

      const isMagentaLike = ((hsl.h >= 270 && hsl.h <= 360) || (hsl.h >= 0 && hsl.h <= 35)) && hsl.s > 0.25 && r > g * 1.2 && b > g;
      const isGreenLike = hsl.h >= 70 && hsl.h <= 170 && hsl.s > 0.2 && g > r && g > b;

      if ((lookingForMagenta && isMagentaLike) || (lookingForGreen && isGreenLike)) {
        mostCommonColor = { r, g, b };
        maxCount = count;
      }
    }
  }

  const targetColor = maxCount > 10 ? mostCommonColor : chromaKey;
  const targetColorHsl = rgbToHsl(targetColor.r, targetColor.g, targetColor.b);

  // Determine if target is magenta or green based on detected color
  const targetIsMagenta = (targetColorHsl.h >= 270 && targetColorHsl.h <= 360) || (targetColorHsl.h >= 0 && targetColorHsl.h <= 35);
  const targetIsGreen = targetColorHsl.h >= 70 && targetColorHsl.h <= 170;

  // Pass 1: Connectivity-based Background Masking
  const bgMask = new Uint8Array(totalPixels); // 0: foreground, 1: potential background, 2: confirmed background
  const similarityMask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    similarityMask[i] = isChromaLike(r, g, b, targetColor, 'key', keyMax) ? 1 : 0;
  }

  const queue: number[] = [];
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  // Design §4.2: flood seeds include corners, edges, and center grid so middle
  // cells (e.g. 4x4 sprite gutters) are represented even when not edge-reachable.
  const centerIdx = cy * width + cx;
  const centerGrid = [
    Math.floor(width * 0.25) + cy * width,
    Math.floor(width * 0.75) + cy * width,
    cx + Math.floor(height * 0.25) * width,
    cx + Math.floor(height * 0.75) * width,
    centerIdx,
  ];

  for (const startNode of corners) {
    if (similarityMask[startNode] === 1 && bgMask[startNode] === 0) {
      queue.push(startNode);
      bgMask[startNode] = 2;
    }
  }
  for (const startNode of centerGrid) {
    if (startNode >= 0 && startNode < totalPixels && similarityMask[startNode] === 1 && bgMask[startNode] === 0) {
      queue.push(startNode);
      bgMask[startNode] = 2;
    }
  }

  // Seed from edges
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 20))) {
    const top = x;
    const bottom = (height - 1) * width + x;
    if (similarityMask[top] === 1 && bgMask[top] === 0) { queue.push(top); bgMask[top] = 2; }
    if (similarityMask[bottom] === 1 && bgMask[bottom] === 0) { queue.push(bottom); bgMask[bottom] = 2; }
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 20))) {
    const left = y * width;
    const right = y * width + (width - 1);
    if (similarityMask[left] === 1 && bgMask[left] === 0) { queue.push(left); bgMask[left] = 2; }
    if (similarityMask[right] === 1 && bgMask[right] === 0) { queue.push(right); bgMask[right] = 2; }
  }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const x = curr % width;
    const y = Math.floor(curr / width);

    const neighbors = [];
    if (x > 0) neighbors.push(curr - 1);
    if (x < width - 1) neighbors.push(curr + 1);
    if (y > 0) neighbors.push(curr - width);
    if (y < height - 1) neighbors.push(curr + width);

    for (const next of neighbors) {
      if (similarityMask[next] === 1 && bgMask[next] === 0) {
        bgMask[next] = 2;
        queue.push(next);
      }
    }
  }

  onProgress(20);

  // Step 1.2.5: Noise Reduction (Speckle Removal)
  const foregroundMask = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    if (bgMask[i] === 0) foregroundMask[i] = 1;
  }

  const visited = new Uint8Array(totalPixels);
  const MAX_ISLAND_SIZE = useGuided ? 80 : 400;

  for (let i = 0; i < totalPixels; i++) {
    if (foregroundMask[i] === 1 && visited[i] === 0) {
      const island = [];
      const islandQueue = [i];
      visited[i] = 1;
      let islandHead = 0;

      while (islandHead < islandQueue.length && islandQueue.length <= MAX_ISLAND_SIZE) {
        const curr = islandQueue[islandHead++];
        island.push(curr);
        const x = curr % width;
        const y = Math.floor(curr / width);

        const neighbors = [];
        if (x > 0) neighbors.push(curr - 1);
        if (x < width - 1) neighbors.push(curr + 1);
        if (y > 0) neighbors.push(curr - width);
        if (y < height - 1) neighbors.push(curr + width);

        for (const next of neighbors) {
          if (foregroundMask[next] === 1 && visited[next] === 0) {
            visited[next] = 1;
            islandQueue.push(next);
          }
        }
      }

      if (islandQueue.length <= MAX_ISLAND_SIZE) {
        for (const pixelIdx of island) {
          bgMask[pixelIdx] = 2;
        }
      }
    }
  }

  onProgress(25);

  // Step 1.3: Compute final Alpha
  // Guided (flag or auto-detect) skips certain-hole so in-cell accents survive.
  const useCertainHole = !useGuided;
  const alphaChannel = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const alpha = data[idx + 3];

    if (alpha === 0) {
      alphaChannel[i] = 0;
      continue;
    }

    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const distance = chromaDistanceToKey(r, g, b, targetColor);

    if (bgMask[i] === 2) {
      if (distance <= keyMax) {
        alphaChannel[i] = 0;
      } else if (isChromaSoftEdge(r, g, b, targetColor, keyMax)) {
        // Soft band includes hard matches; only reach here when d > keyMax.
        const ratio = (distance - keyMax) / CHROMA_LIKE_SOFT_EXTRA;
        alphaChannel[i] = Math.floor(255 * Math.min(1, Math.max(0, ratio)));
      } else {
        alphaChannel[i] = 255;
      }
    }
    // Non-guided: punch strong chroma-like pixels not reached by connectivity
    // (enclosed bg pockets). Guided path skips this (Task 4).
    else if (useCertainHole && distance < keyMax * 0.95) {
      let isCertainHole = false;
      if (targetIsMagenta) {
        // Magenta-shaped only; exclude strong red (blush/lips) via g < 80 on extreme clause.
        isCertainHole =
          (r > g * 1.4 && b > g * 1.4 && (r + b) > 100) ||
          ((r > g * 3 || b > g * 3) && g < 80);
      } else if (targetIsGreen) {
        isCertainHole = (g > r * 1.4 && g > b * 1.4 && g > 80) || (g > r * 2.5);
      }

      if (isCertainHole) {
        alphaChannel[i] = 15;
      } else {
        alphaChannel[i] = 255;
      }
    } else {
      alphaChannel[i] = 255;
    }
  }

  onProgress(40);

  // Pass 2: Edge Erosion (non-guided clothing-direction spill only)
  const erodedAlpha = new Uint8Array(alphaChannel);
  if (!useGuided) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (alphaChannel[i] > 200 && bgMask[i] === 0) {
          const hasBgNeighbor =
            bgMask[i - 1] === 2 || bgMask[i + 1] === 2 ||
            bgMask[i - width] === 2 || bgMask[i + width] === 2;

          if (hasBgNeighbor) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            let isSpill = false;
            if (targetIsMagenta) isSpill = r > g * 1.1 && b > g * 1.1 && b <= r + 30 && g < 100;
            else if (targetIsGreen) isSpill = g > r * 1.1;

            if (isSpill) {
              erodedAlpha[i] = 160;
            }
          }
        }
      }
    }
  }

  onProgress(55);

  // Build edge band mask: pixels within radius px of semi-transparent or transparent (for spill suppression)
  const edgeBand = new Uint8Array(totalPixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (erodedAlpha[i] < 255) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              edgeBand[ny * width + nx] = 1;
            }
          }
        }
      }
    }
  }

  onProgress(60);

  // Wider ring than edgeBand: strong green that fails YCbCr key often sits 3–6px
  // inside the opaque mass (sticker-09 mark2 gray hair spike).
  const strongSpillRadius = Math.max(radius + 3, 5);
  const nearTransparentForSpill = new Uint8Array(totalPixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (erodedAlpha[i] >= 40) continue;
      for (let dy = -strongSpillRadius; dy <= strongSpillRadius; dy++) {
        for (let dx = -strongSpillRadius; dx <= strongSpillRadius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          nearTransparentForSpill[ny * width + nx] = 1;
        }
      }
    }
  }

  // Pass 2b (guided green key only): clear enclosed pockets before despill grays them.
  if (useGuided && targetIsGreen) {
    for (let p = 0; p < totalPixels; p++) {
      data[p * 4 + 3] = erodedAlpha[p]!;
    }
    clearGuidedGreenPockets(data, width, height, { key: targetColor, keyMax });
    for (let p = 0; p < totalPixels; p++) {
      erodedAlpha[p] = data[p * 4 + 3]!;
    }
  }

  // Pass 3: Final Decontamination (spill suppression) with full edge band
  // Despill formulas: green g' = min(g, max(r,b)) style; magenta: pull R,B toward G (Wikipedia / industry)
  // Skip color modification for near-white pixels (e.g. white borders) to avoid green/magenta residue.
  for (let i = 0; i < data.length; i += 4) {
    const pixelIdx = i / 4;
    const alpha = erodedAlpha[pixelIdx];
    data[i + 3] = alpha;

    if (alpha === 0) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (isNearWhite(r, g, b)) continue; // preserve white borders; avoid tint residue from spill/blend

    const avg = (r + g + b) / 3;
    const isEdge = alpha < 255;
    const inEdgeBand = edgeBand[pixelIdx] === 1;
    const nearTransparentSpill = nearTransparentForSpill[pixelIdx] === 1;
    const applyStrongDespill = isEdge || inEdgeBand;

    if (targetIsMagenta) {
      // Non-guided: skip despill on blue-dominant pixels (character blue edges).
      // Guided: rely on shared similarity + generic edge-band despill only.
      if (!useGuided && b > r + 30) continue;
      const magContrast = (r + b) / 2 - g;
      if (avg < 100 && magContrast > 4) {
        const decontamIntensity = applyStrongDespill ? 1.0 : 0.85;
        const gray = avg;
        data[i] = Math.round(r * (1 - decontamIntensity) + gray * decontamIntensity);
        data[i + 1] = Math.round(g * (1 - decontamIntensity) + gray * decontamIntensity);
        data[i + 2] = Math.round(b * (1 - decontamIntensity) + gray * decontamIntensity);
      }
      else if (applyStrongDespill && magContrast > 3) {
        // Full-strength spill suppression on edge band (k=1.0); cap R,B at G to avoid overshoot
        const spillK = inEdgeBand ? 1.0 : 0.95;
        const newR = Math.max(g, Math.round(r - (r - g) * spillK));
        const newB = Math.max(g, Math.round(b - (b - g) * spillK));
        data[i] = newR;
        data[i + 2] = newB;
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = Math.round(data[i] * 0.6 + gray * 0.4);
        data[i + 1] = Math.round(data[i + 1] * 0.6 + gray * 0.4);
        data[i + 2] = Math.round(data[i + 2] * 0.6 + gray * 0.4);
      }
      else if (!applyStrongDespill && magContrast > 20) {
        const spillIntensity = Math.min(0.5, (magContrast - 15) / 40);
        data[i] = Math.round(r - (r - g) * spillIntensity);
        data[i + 2] = Math.round(b - (b - g) * spillIntensity);
      }
    } else if (targetIsGreen) {
      const greenContrast = g - (r + b) / 2;
      // sticker-09 mark2: raw (54,148,36)/(53,81,32) fail YCbCr key (d≈52) so stay
      // opaque; despill then leaves a gray hair spike. Erase strong spill near
      // transparency (wider than edgeBand) instead of only recoloring.
      if (
        nearTransparentSpill &&
        g > r &&
        g > b &&
        greenContrast > 32
      ) {
        // Only erase thin edge spikes — keep interior green props (4×4 block has
        // ≥3 same-class neighbors in 5×5; a lone hair AA pixel has 0–2).
        let greenSpillNeighbors = 0;
        const x = pixelIdx % width;
        const y = (pixelIdx - x) / width;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (erodedAlpha[ny * width + nx]! <= 40) continue;
            const ni = (ny * width + nx) * 4;
            const nr = data[ni]!;
            const ng = data[ni + 1]!;
            const nb = data[ni + 2]!;
            const nContrast = ng - (nr + nb) / 2;
            if (ng > nr && ng > nb && nContrast > 32) greenSpillNeighbors++;
          }
        }
        if (greenSpillNeighbors < 3) {
          data[i + 3] = 0;
          erodedAlpha[pixelIdx] = 0;
          continue;
        }
      }
      if (avg < 100 && greenContrast > 4) {
        // Gray from R/B only — including G in the average re-bakes spill into dark
        // olive fringes (e.g. 47,158,30 → 74,90,71 still green-dominant).
        const spillFreeGray = (r + b) / 2;
        data[i] = Math.round(r * 0.25 + spillFreeGray * 0.75);
        data[i + 1] = Math.round(Math.min(g, Math.max(r, b)));
        data[i + 2] = Math.round(b * 0.25 + spillFreeGray * 0.75);
        if (inEdgeBand && greenContrast > 12) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = Math.round(data[i] * 0.55 + gray * 0.45);
          data[i + 1] = Math.round(data[i + 1] * 0.55 + gray * 0.45);
          data[i + 2] = Math.round(data[i + 2] * 0.55 + gray * 0.45);
        }
      }
      else if (applyStrongDespill && greenContrast > 3) {
        // Edge band: hard-cap G at max(R,B) — muted olive AA (e.g. 70,103,69) fails
        // YCbCr key match (~distance 90) so despill is the only cleanup path.
        // Interior soft edges keep a small +8 margin to avoid flattening hair/cloth.
        const rbMax = Math.max(r, b);
        const gMargin = inEdgeBand ? 0 : 8;
        data[i + 1] = Math.round(Math.min(g, rbMax + gMargin));
        if (inEdgeBand && greenContrast > 8) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const pull = greenContrast > 18 ? 0.45 : 0.28;
          data[i] = Math.round(data[i] * (1 - pull) + gray * pull);
          data[i + 1] = Math.round(data[i + 1] * (1 - pull) + gray * pull);
          data[i + 2] = Math.round(data[i + 2] * (1 - pull) + gray * pull);
        }
      }
    }

    if (i % (reportInterval * 32) === 0) {
      const progress = 70 + Math.min(20, Math.round((i / data.length) * 20));
      onProgress(progress);
    }
  }

  onProgress(90);

  // Pass 4: Edge color sampling - blend edge band pixels toward opaque neighbor colors to reduce halo
  // Pass 4b: Dark edge lift - stronger blend for pixels darker than neighbors (removes black/dark ring)
  // Skip blending for near-white pixels so white borders are not tinted by neighbor average.
  const sampled = new Uint8ClampedArray(data.length);
  sampled.set(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const pixelIdx = i / 4;
      if (edgeBand[pixelIdx] === 0) continue;
      const alpha = sampled[i + 3];
      if (alpha === 0) continue;
      if (isNearWhite(sampled[i], sampled[i + 1], sampled[i + 2])) continue;

      let sumR = 0, sumG = 0, sumB = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = ((y + dy) * width + (x + dx)) * 4;
          if (sampled[ni + 3] < 250) continue;
          const nR = sampled[ni];
          const nG = sampled[ni + 1];
          const nB = sampled[ni + 2];
          // Skip spill-tinted neighbors so Pass 4 cannot reintroduce green/magenta
          // fringe after despill (olive AA clusters share the same tint).
          if (
            targetIsGreen &&
            (nG - Math.max(nR, nB) > 4 ||
              (Math.min(nR, nG) - nB > 4 && Math.abs(nR - nG) <= 16))
          ) {
            continue;
          }
          if (targetIsMagenta && (nR + nB) / 2 - nG > 12) continue;
          sumR += nR;
          sumG += nG;
          sumB += nB;
          count++;
        }
      }
      if (count > 0) {
        const nR = sumR / count;
        const nG = sumG / count;
        const nB = sumB / count;
        const lumP = (sampled[i] + sampled[i + 1] + sampled[i + 2]) / 3;
        const lumN = (nR + nG + nB) / 3;
        // Dark edge: pixel darker than foreground neighbors -> stronger blend to remove black ring / anti-alias tint
        const ratio = lumN > 15 ? lumP / lumN : 1;
        let effectiveBlend = blend;
        if (lumP < 75 && lumN > 60) {
          effectiveBlend = Math.min(0.85, blend + 0.65); // near-black residue (e.g. black background bleed) -> very strong lift
        } else if (ratio < 0.82) {
          effectiveBlend = Math.min(0.78, blend + 0.52); // clearly dark fringe
        } else if (ratio < 0.92) {
          effectiveBlend = Math.min(0.65, blend + 0.38); // moderate dark halo
        } else if (ratio < 0.98) {
          effectiveBlend = Math.min(0.52, blend + 0.24); // slight dark tint (anti-aliasing)
        } else if (ratio < 1.0) {
          effectiveBlend = Math.min(0.40, blend + 0.14); // barely darker -> minimal extra pull
        }
        data[i] = Math.round(sampled[i] * (1 - effectiveBlend) + nR * effectiveBlend);
        data[i + 1] = Math.round(sampled[i + 1] * (1 - effectiveBlend) + nG * effectiveBlend);
        data[i + 2] = Math.round(sampled[i + 2] * (1 - effectiveBlend) + nB * effectiveBlend);
      }
    }
  }

  // Pass 4c: clamp green spill near transparency. Olive AA often sits 3px past
  // the soft edge (outside radius-2 edgeBand), so scan a slightly wider ring.
  if (targetIsGreen) {
    const clampRadius = Math.max(radius + 6, 8);
    const nearTransparent = new Uint8Array(totalPixels);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (data[i * 4 + 3] >= 40) continue;
        for (let dy = -clampRadius; dy <= clampRadius; dy++) {
          for (let dx = -clampRadius; dx <= clampRadius; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
            nearTransparent[ny * width + nx] = 1;
          }
        }
      }
    }
    for (let i = 0; i < totalPixels; i++) {
      if (nearTransparent[i] === 0) continue;
      const idx = i * 4;
      if (data[idx + 3] === 0) continue;
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];
      const rbMax = Math.max(r, b);
      if (g > rbMax) {
        g = rbMax;
        data[idx + 1] = g;
      }
      // Yellow-green olive AA: R≈G and both above B (e.g. 56,59,49 hair or
      // 251,255,240 white-edge tint). Skip true brown (R clearly above G).
      const yellowGreenExcess = Math.min(r, g) - b;
      if (yellowGreenExcess > 2 && g >= r - 4 && r - g <= 12) {
        data[idx] = b;
        data[idx + 1] = Math.min(data[idx + 1], b);
      }
    }
  }

  onProgress(100);
  return data;
}
