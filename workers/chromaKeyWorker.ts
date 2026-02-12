/**
 * Web Worker for chroma key removal processing.
 * Processes images in the background to avoid blocking the main thread.
 * Uses HSL color space for more accurate green screen detection.
 *
 * Edge / spill handling (reduces background color halo on character borders):
 * - Edge band: pixels within 2px of semi-transparent are treated as edge for spill suppression.
 * - Despill: magenta R/B pulled toward G (cap at G); green G capped at max(R,B)+margin (Wikipedia-style).
 * - Edge color sampling: edge band pixels blend 22% toward opaque neighbor average to pull tint toward foreground.
 *
 * @module chromaKeyWorker
 */

export interface ChromaKeyWorkerMessage {
  type: 'process' | 'cancel';
  data: number[];
  width: number;
  height: number;
  chromaKey: { r: number; g: number; b: number };
  fuzzPercent: number;
  /** Edge band radius (px); default 2. */
  edgeBandRadius?: number;
  /** Edge color blend 0–1; default 0.22. */
  edgeBlend?: number;
  id?: string;
}

export interface ChromaKeyWorkerResponse {
  type: 'progress' | 'complete' | 'error';
  progress?: number; // 0-100
  data?: number[]; // Processed data as array
  width?: number;
  height?: number;
  error?: string;
  id?: string;
}

/**
 * Convert RGB to HSL color space
 * H: 0-360 (hue), S: 0-1 (saturation), L: 0-1 (lightness)
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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

/**
 * Check if a color is in the green screen hue range using HSL
 * Green screen typically has hue between 70-170 degrees
 * Target color: #00FF00 (RGB: 0, 255, 0, Hue: 120°)
 */
function isGreenScreenHSL(r: number, g: number, b: number, tolerance: number): boolean {
  const { h, s, l } = rgbToHsl(r, g, b);

  // Green screen characteristics in HSL:
  // Hue: 70-170 degrees (wider range for AI variants)
  // Saturation: > 0.2 (more tolerant of muddy AI backgrounds)
  // Lightness: 0.15-0.85 (wider range for dark/light grain)

  const hueInRange = h >= 70 - tolerance && h <= 170 + tolerance;
  const saturationOk = s > 0.2;
  const lightnessOk = l > 0.15 && l < 0.85;

  // RGB check: green must be notably higher than red and blue
  const greenDominant = g > r * 1.1 && g > b * 1.1 && g > 40;

  return hueInRange && saturationOk && lightnessOk && greenDominant;
}

/**
 * Check if a color is magenta screen using HSL
 * Magenta has hue around 300 degrees (295-305)
 * Target color: #FF00FF (RGB: 255, 0, 255, Hue: 300°)
 * Strict detection - rely on RGB distance matching for variants
 */
function isMagentaScreenHSL(r: number, g: number, b: number, tolerance: number): boolean {
  const { h, s, l } = rgbToHsl(r, g, b);

  // Strict HSL check for pure magenta
  const hueInRange = h >= 295 - tolerance && h <= 305 + tolerance;
  const saturationOk = s > 0.7;
  const lightnessOk = l > 0.35 && l < 0.75;

  const magentaPattern = r > 180 && b > 180 && g < 100 && Math.abs(r - b) < 80;

  return hueInRange && saturationOk && lightnessOk && magentaPattern;
}

const DEFAULT_EDGE_BAND_RADIUS = 2;
const DEFAULT_EDGE_BLEND = 0.22;

/**
 * Process chroma key removal with progress reporting
 * Uses HSL color space for accurate green/magenta detection
 */
function processChromaKey(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  chromaKey: { r: number; g: number; b: number },
  fuzzPercent: number,
  onProgress: (progress: number) => void,
  edgeBandRadius: number = DEFAULT_EDGE_BAND_RADIUS,
  edgeBlend: number = DEFAULT_EDGE_BLEND
): Uint8ClampedArray {
  const totalPixels = data.length / 4;
  const fuzz = (fuzzPercent / 100) * 255;
  const radius = Math.max(1, Math.min(5, Math.round(edgeBandRadius)));
  const blend = Math.max(0, Math.min(1, Number(edgeBlend)));

  let transparentCount = 0;
  const reportInterval = Math.max(1, Math.floor(totalPixels / 100));

  // Detect the actual background color by sampling corners, edges, and center (so middle cells are represented)
  const sampleSize = Math.min(100, Math.floor(Math.sqrt(totalPixels) / 10));
  const colorMap = new Map<string, number>();

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
      const key = `${r},${g},${b}`;
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
      const [r, g, b] = key.split(',').map(Number);
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

  // Magenta-like pixel: catches #FF00FF and AI variants like #E91E63 (pink) so middle cells are removed
  const isMagentaLikePixel = (r: number, g: number, b: number): boolean => {
    const { h, s } = rgbToHsl(r, g, b);
    const hueOk = (h >= 270 && h <= 360) || (h >= 0 && h <= 35);
    return hueOk && s > 0.25 && r > g * 1.2 && b > g && (r > 100 || b > 80);
  };

  // Calculate adaptive fuzz based on detected background
  const adaptiveFuzz = maxCount > 10 ? fuzz * 1.5 : fuzz;

  // Pass 1: Connectivity-based Background Masking
  const bgMask = new Uint8Array(totalPixels); // 0: foreground, 1: potential background, 2: confirmed background
  const similarityMask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const rDiff = r - targetColor.r;
    const gDiff = g - targetColor.g;
    const bDiff = b - targetColor.b;
    const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

    let isMatch = distance <= adaptiveFuzz + 20;
    if (isMatch) {
      if (targetIsMagenta) {
        isMatch = r > g * 1.1 && b > g * 1.1;
      } else if (targetIsGreen) {
        isMatch = g > r * 1.01 && g > b * 1.01;
      }
    }
    // So middle cells with #E91E63 etc. are treated as background even when far from corner target
    if (targetIsMagenta && isMagentaLikePixel(r, g, b)) isMatch = true;

    similarityMask[i] = isMatch ? 1 : 0;
  }

  const queue: number[] = [];
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
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
  const MAX_ISLAND_SIZE = 400;

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
  const alphaChannel = new Uint8Array(totalPixels);
  const softness = 10;

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

    const rDiff = r - targetColor.r;
    const gDiff = g - targetColor.g;
    const bDiff = b - targetColor.b;
    const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

    if (bgMask[i] === 2) {
      if (distance <= adaptiveFuzz) {
        alphaChannel[i] = 0;
      } else if (distance <= adaptiveFuzz + softness) {
        const ratio = (distance - adaptiveFuzz) / softness;
        alphaChannel[i] = Math.floor(255 * ratio);
      } else {
        alphaChannel[i] = 255;
      }
    } else if (targetIsMagenta && isMagentaLikePixel(r, g, b)) {
      // Middle cells may be disconnected by white grid lines; remove magenta/pink anyway
      alphaChannel[i] = 0;
    }
    else if (distance < adaptiveFuzz * 0.95) {
      let isCertainHole = false;
      if (targetIsMagenta) {
        isCertainHole = (r > g * 1.4 && b > g * 1.4 && (r + b) > 100) || (r > g * 3 || b > g * 3);
      } else if (targetIsGreen) {
        isCertainHole = (g > r * 1.4 && g > b * 1.4 && g > 80) || (g > r * 2.5);
      }

      if (isCertainHole) {
        alphaChannel[i] = 15;
      } else {
        alphaChannel[i] = 255;
      }
    }
    else {
      alphaChannel[i] = 255;
    }
  }

  onProgress(40);

  // Pass 2: Edge Erosion
  const erodedAlpha = new Uint8Array(alphaChannel);
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
          if (targetIsMagenta) isSpill = r > g * 1.1 && b > g * 1.1;
          else if (targetIsGreen) isSpill = g > r * 1.1;

          if (isSpill) {
            erodedAlpha[i] = 160;
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

  // Pass 3: Final Decontamination (spill suppression) with full edge band
  // Despill formulas: green g' = min(g, max(r,b)) style; magenta: pull R,B toward G (Wikipedia / industry)
  for (let i = 0; i < data.length; i += 4) {
    const pixelIdx = i / 4;
    const alpha = erodedAlpha[pixelIdx];
    data[i + 3] = alpha;

    if (alpha === 0) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const avg = (r + g + b) / 3;
    const isEdge = alpha < 255;
    const inEdgeBand = edgeBand[pixelIdx] === 1;
    const applyStrongDespill = isEdge || inEdgeBand;

    if (targetIsMagenta) {
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
      if (avg < 100 && greenContrast > 4) {
        const gray = avg;
        data[i] = Math.round(r * 0.15 + gray * 0.85);
        data[i + 1] = Math.round(g * 0.15 + gray * 0.85);
        data[i + 2] = Math.round(b * 0.15 + gray * 0.85);
      }
      else if (applyStrongDespill && greenContrast > 3) {
        // Despill: cap green at max(r,b) + small margin (Wikipedia: (r, min(g,b), b) style; we use max(r,b) for natural look)
        const rbMax = Math.max(r, b);
        const gCapped = Math.min(g, rbMax + 15);
        data[i + 1] = Math.round(gCapped);
        if (inEdgeBand && greenContrast > 10) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = Math.round(data[i] * 0.85 + gray * 0.15);
          data[i + 1] = Math.round(data[i + 1] * 0.85 + gray * 0.15);
          data[i + 2] = Math.round(data[i + 2] * 0.85 + gray * 0.15);
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
  const sampled = new Uint8ClampedArray(data.length);
  sampled.set(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const pixelIdx = i / 4;
      if (edgeBand[pixelIdx] === 0) continue;
      const alpha = sampled[i + 3];
      if (alpha === 0) continue;

      let sumR = 0, sumG = 0, sumB = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = ((y + dy) * width + (x + dx)) * 4;
          if (sampled[ni + 3] >= 250) {
            sumR += sampled[ni];
            sumG += sampled[ni + 1];
            sumB += sampled[ni + 2];
            count++;
          }
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

  onProgress(100);
  return data;
}

// Worker message handler
self.onmessage = function (e: MessageEvent<ChromaKeyWorkerMessage>) {
  const { type, data, width, height, chromaKey, fuzzPercent, edgeBandRadius, edgeBlend, id } = e.data;

  if (type === 'cancel') return;

  if (type === 'process' && data && width && height) {
    try {
      const imageData = new Uint8ClampedArray(data);
      const processed = processChromaKey(
        imageData,
        width,
        height,
        chromaKey,
        fuzzPercent,
        (progress) => {
          self.postMessage({ type: 'progress', progress, id } as ChromaKeyWorkerResponse);
        },
        edgeBandRadius,
        edgeBlend
      );

      self.postMessage({
        type: 'complete',
        data: Array.from(processed),
        width,
        height,
        id,
      } as ChromaKeyWorkerResponse);
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        id,
      } as ChromaKeyWorkerResponse);
    }
  }
};
