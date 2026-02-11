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

  // Process each pixel - Pass 1: Alpha calculation with soft edges and erosion
  const alphaChannel = new Uint8Array(totalPixels);
  const softness = 12; // Range for alpha transition (fringe)

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const alpha = data[i + 3];

    if (alpha === 0) {
      alphaChannel[i / 4] = 0;
      continue;
    }

    // RGB distance check to detected background color
    const rDiff = red - targetColor.r;
    const gDiff = green - targetColor.g;
    const bDiff = blue - targetColor.b;
    const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

    let shouldRemove = false;
    let computedAlpha = 255;

    // Primary check: RGB distance
    if (distance <= adaptiveFuzz + softness) {
      if (targetIsMagenta) {
        const looksLikeMagenta = red > green * 1.2 && blue > green * 1.2;
        if (looksLikeMagenta) {
          if (distance <= adaptiveFuzz) {
            computedAlpha = 0;
            shouldRemove = true;
          } else {
            // Soft edge transition
            const ratio = (distance - adaptiveFuzz) / softness;
            computedAlpha = Math.floor(255 * ratio);
          }
        }
      } else if (targetIsGreen) {
        const looksLikeGreen = green > red * 1.1 && green > blue * 1.1;
        if (looksLikeGreen) {
          if (distance <= adaptiveFuzz) {
            computedAlpha = 0;
            shouldRemove = true;
          } else {
            const ratio = (distance - adaptiveFuzz) / softness;
            computedAlpha = Math.floor(255 * ratio);
          }
        }
      } else if (distance <= adaptiveFuzz) {
        computedAlpha = 0;
        shouldRemove = true;
      }
    }

    // HSL-based detection for more accuracy
    if (computedAlpha > 0) {
      const { h, s, l } = rgbToHsl(red, green, blue);
      if (targetIsMagenta) {
        const hDiff = Math.abs(h - targetColorHsl.h);
        const normalizedHDiff = hDiff > 180 ? 360 - hDiff : hDiff;

        if (normalizedHDiff < hueTolerance + 5 && s > 0.3) {
          if (normalizedHDiff < hueTolerance) {
            computedAlpha = 0;
          } else {
            const ratio = (normalizedHDiff - hueTolerance) / 5;
            computedAlpha = Math.min(computedAlpha, Math.floor(255 * ratio));
          }
        }
      } else if (targetIsGreen) {
        const hDiff = Math.abs(h - targetColorHsl.h);
        const normalizedHDiff = hDiff > 180 ? 360 - hDiff : hDiff;

        if (normalizedHDiff < hueTolerance + 10 && s > 0.2) {
          if (normalizedHDiff < hueTolerance) {
            computedAlpha = 0;
          } else {
            const ratio = (normalizedHDiff - hueTolerance) / 10;
            computedAlpha = Math.min(computedAlpha, Math.floor(255 * ratio));
          }
        }
      }
    }

    alphaChannel[i / 4] = computedAlpha;

    // Report progress
    if (i % (reportInterval * 16) === 0) {
      const progress = Math.min(30, Math.round((i / data.length) * 30));
      onProgress(progress);
    }
  }

  // Pass 2: Edge Erosion (Shrink the mask by 1 pixel to remove the halo)
  const erodedAlpha = new Uint8Array(alphaChannel);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (alphaChannel[i] > 0) {
        // Check 4-connectivity neighbors
        if (alphaChannel[i - 1] === 0 || alphaChannel[i + 1] === 0 ||
          alphaChannel[i - width] === 0 || alphaChannel[i + width] === 0) {
          // If a pixel is on the edge, reduce its alpha or make it transparent
          // This removes the "bleeding" edge
          erodedAlpha[i] = Math.floor(alphaChannel[i] * 0.5);
        }
      }
    }
    if (y % 100 === 0) onProgress(30 + Math.round((y / height) * 20));
  }

  // Pass 3: Apply alpha and Spill Suppression (Color Decontamination)
  for (let i = 0; i < data.length; i += 4) {
    const alpha = erodedAlpha[i / 4];
    data[i + 3] = alpha;

    if (alpha === 0) continue;

    // Spill suppression: Remove the background color tint from edge pixels
    // Most intensive on the semi-transparent edges
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];

    const spillIntensity = (255 - alpha) / 255; // Higher on edges

    if (targetIsMagenta) {
      // Magenta is high R and B. To suppress, we want to normalize R/B towards G
      // A common formula: R = min(R, G), B = min(B, G)
      // We'll use a weighted blend based on edge proximity
      if (red > green || blue > green) {
        const targetR = Math.min(red, green + (red - green) * (1 - spillIntensity));
        const targetB = Math.min(blue, green + (blue - green) * (1 - spillIntensity));

        data[i] = Math.round(targetR);
        data[i + 2] = Math.round(targetB);

        // Further desaturate if it's very pinkish
        if (spillIntensity > 0.3 && red > green * 1.5 && blue > green * 1.5) {
          const gray = (red + green * 2 + blue) / 4;
          data[i] = Math.round(data[i] * (1 - spillIntensity * 0.5) + gray * spillIntensity * 0.5);
          data[i + 1] = Math.round(data[i + 1] * (1 - spillIntensity * 0.5) + gray * spillIntensity * 0.5);
          data[i + 2] = Math.round(data[i + 2] * (1 - spillIntensity * 0.5) + gray * spillIntensity * 0.5);
        }
      }
    } else if (targetIsGreen) {
      // Green suppression: normalize G towards the average of R and B
      if (green > red || green > blue) {
        const rbAvg = (red + blue) / 2;
        const targetG = Math.min(green, rbAvg + (green - rbAvg) * (1 - spillIntensity));
        data[i + 1] = Math.round(targetG);
      }
    }

    if (i % (reportInterval * 16) === 0) {
      const progress = 50 + Math.min(50, Math.round((i / data.length) * 50));
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
