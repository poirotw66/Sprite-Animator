/**
 * Web Worker for chroma key removal processing.
 * Processes images in the background to avoid blocking the main thread.
 * Uses HSL color space for more accurate green screen detection.
 * 
 * @module chromaKeyWorker
 */

export interface ChromaKeyWorkerMessage {
  type: 'process' | 'cancel';
  data: number[]; // ImageData.data as array (cannot transfer ImageData directly)
  width: number;
  height: number;
  chromaKey: { r: number; g: number; b: number };
  fuzzPercent: number;
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
 * Green screen typically has hue between 80-160 degrees
 * Target color: #00B140 (RGB: 0, 177, 64, Hue: ~141°)
 */
function isGreenScreenHSL(r: number, g: number, b: number, tolerance: number): boolean {
  const { h, s, l } = rgbToHsl(r, g, b);

  // Green screen characteristics in HSL:
  // Hue: 80-160 degrees (wider range for AI variants)
  // Saturation: > 0.4 (moderately saturated)
  // Lightness: 0.25-0.75 (wider range)

  const hueInRange = h >= 80 - tolerance && h <= 160 + tolerance;
  const saturationOk = s > 0.4;
  const lightnessOk = l > 0.25 && l < 0.75;

  // RGB check: green must dominate
  const greenDominant = g > r * 1.3 && g > b * 1.3 && g > 80;

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
  onProgress: (progress: number) => void
): Uint8ClampedArray {
  const totalPixels = data.length / 4;
  const fuzz = (fuzzPercent / 100) * 255;
  const hueTolerance = fuzzPercent * 1.5; // Hue tolerance in degrees

  let transparentCount = 0;
  const reportInterval = Math.max(1, Math.floor(totalPixels / 100));

  // Detect the actual background color by sampling corners
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

      const isMagentaLike = hsl.h >= 270 && hsl.h <= 330 && hsl.s > 0.3;
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
  const targetIsMagenta = targetColorHsl.h >= 270 && targetColorHsl.h <= 330;
  const targetIsGreen = targetColorHsl.h >= 70 && targetColorHsl.h <= 170;

  // Calculate adaptive fuzz based on detected background
  // If we detected an actual background color, use larger tolerance for RGB matching
  const adaptiveFuzz = maxCount > 10 ? fuzz * 1.5 : fuzz;

  // Process each pixel - Pass 1: Connectivity-based Background Masking (The "Professional" Approach)
  // This identifies pixels that are actually part of the background by starting from the corners
  const bgMask = new Uint8Array(totalPixels); // 0: foreground, 1: potential background, 2: confirmed background
  const similarityMask = new Uint8Array(totalPixels);

  // Step 1.1: Identify all pixels that "look like" background
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const rDiff = r - targetColor.r;
    const gDiff = g - targetColor.g;
    const bDiff = b - targetColor.b;
    const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

    // Use a slightly more generous threshold for the initial mask
    let isMatch = distance <= adaptiveFuzz + 20;

    if (isMatch) {
      if (targetIsMagenta) {
        isMatch = r > g * 1.1 && b > g * 1.1;
      } else if (targetIsGreen) {
        isMatch = g > r * 1.05 && g > b * 1.05;
      }
    }

    similarityMask[i] = isMatch ? 1 : 0;
  }

  // Step 1.2: Flood Fill from corners to find connected background
  const queue: number[] = [];
  const corners = [
    0, // Top-left
    width - 1, // Top-right
    (height - 1) * width, // Bottom-left
    height * width - 1 // Bottom-right
  ];

  for (const startNode of corners) {
    if (similarityMask[startNode] === 1 && bgMask[startNode] === 0) {
      queue.push(startNode);
      bgMask[startNode] = 2; // Confirmed background
    }
  }

  // Also seed from edges (important for sprite sheets where character might not touch corners)
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

    // Check 4-connected neighbors
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

    // Performance optimization: prevent queue from exploding on huge images
    if (head % 5000 === 0) {
      // Yield if needed, but in worker we just stay synchronous for speed
    }
  }

  onProgress(20);

  // Step 1.3: Compute final Alpha based on confirmed Background Region + Hole Scavenging
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

    // Case A: Confirmed background (connected to edge)
    if (bgMask[i] === 2) {
      if (distance <= adaptiveFuzz) {
        alphaChannel[i] = 0;
      } else if (distance <= adaptiveFuzz + softness) {
        const ratio = (distance - adaptiveFuzz) / softness;
        alphaChannel[i] = Math.floor(255 * ratio);
      } else {
        alphaChannel[i] = 255;
      }
    }
    // Case B: Hole Scavenging (disconnected islands like holes in letters)
    else if (distance < adaptiveFuzz * 0.95) {
      // Enhanced check for disconnected holes: sensitive to dark residue in text
      let isCertainHole = false;
      if (targetIsMagenta) {
        // Look for magenta signature: R & B notably higher than G
        // Lowered brightness requirement (100) to catch dark residue inside small text
        isCertainHole = (r > g * 1.4 && b > g * 1.4 && (r + b) > 100) || (r > g * 3 || b > g * 3);
      } else if (targetIsGreen) {
        isCertainHole = (g > r * 1.4 && g > b * 1.4 && g > 80) || (g > r * 2.5);
      }

      if (isCertainHole) {
        alphaChannel[i] = 15; // Near transparent instead of 0 to keep text anti-aliasing smooth
      } else {
        alphaChannel[i] = 255;
      }
    }
    else {
      // Internal pixels stay fully opaque
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

  onProgress(60);

  // Pass 3: Final Decontamination (Targeting text residue)
  for (let i = 0; i < data.length; i += 4) {
    const pixelIdx = i / 4;
    const alpha = erodedAlpha[pixelIdx];
    data[i + 3] = alpha;

    if (alpha === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const avg = (r + g + b) / 3;
    const isEdge = alpha < 255;

    if (targetIsMagenta) {
      const magContrast = (r + b) / 2 - g;

      // NEW: Dark Detail Decontamination (Specially for Text)
      // If the pixel is dark (text-like) and has magenta tint, force it to neutral
      if (avg < 100 && magContrast > 4) {
        const decontamIntensity = isEdge ? 1.0 : 0.85;
        const gray = avg;
        data[i] = Math.round(r * (1 - decontamIntensity) + gray * decontamIntensity);
        data[i + 1] = Math.round(g * (1 - decontamIntensity) + gray * decontamIntensity);
        data[i + 2] = Math.round(b * (1 - decontamIntensity) + gray * decontamIntensity);
      }
      // Normal edge suppression
      else if (isEdge && magContrast > 5) {
        const spillIntensity = 0.95;
        data[i] = Math.round(r - (r - g) * spillIntensity);
        data[i + 2] = Math.round(b - (b - g) * spillIntensity);

        // Edge Gray-blend
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = Math.round(data[i] * 0.6 + gray * 0.4);
        data[i + 1] = Math.round(data[i + 1] * 0.6 + gray * 0.4);
        data[i + 2] = Math.round(data[i + 2] * 0.6 + gray * 0.4);
      }
      // Internal high-contrast correction (safe mode for character colors)
      else if (!isEdge && magContrast > 20) {
        const spillIntensity = Math.min(0.5, (magContrast - 15) / 40);
        data[i] = Math.round(r - (r - g) * spillIntensity);
        data[i + 2] = Math.round(b - (b - g) * spillIntensity);
      }
    } else if (targetIsGreen) {
      const greenContrast = g - (r + b) / 2;
      // Dark decontamination for green
      if (avg < 100 && greenContrast > 4) {
        const gray = avg;
        data[i] = Math.round(r * 0.15 + gray * 0.85);
        data[i + 1] = Math.round(g * 0.15 + gray * 0.85);
        data[i + 2] = Math.round(b * 0.15 + gray * 0.85);
      }
      else if (isEdge && greenContrast > 5) {
        const rbAvg = (r + b) / 2;
        data[i + 1] = Math.round(g - (g - rbAvg) * 0.95);
      }
    }

    if (i % (reportInterval * 32) === 0) {
      const progress = 70 + Math.min(30, Math.round((i / data.length) * 30));
      onProgress(progress);
    }
  }

  onProgress(100);
  return data;
}

// Worker message handler
self.onmessage = function (e: MessageEvent<ChromaKeyWorkerMessage>) {
  const { type, data, width, height, chromaKey, fuzzPercent, id } = e.data;

  if (type === 'cancel') {
    // Cancel processing (could implement cancellation logic here)
    return;
  }

  if (type === 'process' && data && width && height) {
    try {
      // Convert array to Uint8ClampedArray
      const imageData = new Uint8ClampedArray(data);

      const processed = processChromaKey(
        imageData,
        width,
        height,
        chromaKey,
        fuzzPercent,
        (progress) => {
          self.postMessage({
            type: 'progress',
            progress,
            id,
          } as ChromaKeyWorkerResponse);
        }
      );

      // Convert back to array for transfer
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
