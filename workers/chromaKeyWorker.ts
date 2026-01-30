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
 * Green screen typically has hue between 135-147 degrees
 * Target color: #00B140 (RGB: 0, 177, 64, Hue: ~141°)
 */
function isGreenScreenHSL(r: number, g: number, b: number, tolerance: number): boolean {
  const { h, s, l } = rgbToHsl(r, g, b);
  
  // Green screen characteristics in HSL (very strict):
  // Hue: 135-147 degrees (narrow range ±6° around #00B140)
  // Saturation: > 0.65 (very highly saturated)
  // Lightness: 0.3-0.7 (exclude very dark or bright)
  
  const hueInRange = h >= 135 - tolerance && h <= 147 + tolerance;
  const saturationOk = s > 0.65;
  const lightnessOk = l > 0.3 && l < 0.7;
  
  // Very strict RGB check: green must dominate AND r,b must be low
  const greenDominant = g > r * 2.0 && g > b * 2.0 && g > 120;
  const rgbLowEnough = r < 100 && b < 100;
  
  return hueInRange && saturationOk && lightnessOk && greenDominant && rgbLowEnough;
}

/**
 * Check if a color is magenta screen using HSL
 * Magenta has hue around 300 degrees (295-305)
 * Target color: #FF00FF (RGB: 255, 0, 255, Hue: 300°)
 */
function isMagentaScreenHSL(r: number, g: number, b: number, tolerance: number): boolean {
  const { h, s, l } = rgbToHsl(r, g, b);
  
  // Magenta characteristics in HSL (stricter):
  // Hue: 295-305 degrees (centered around #FF00FF)
  // Saturation: > 0.7 (very highly saturated)
  // Lightness: 0.35-0.75 (avoid very dark or very bright)
  
  const hueInRange = h >= 295 - tolerance && h <= 305 + tolerance;
  const saturationOk = s > 0.7;
  const lightnessOk = l > 0.35 && l < 0.75;
  
  // Additional RGB check: R and B must be high and similar, G must be very low
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

  // Process each pixel
  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const alpha = data[i + 3];

    if (alpha === 0) {
      transparentCount++;
      continue;
    }

    // RGB distance check
    const rDiff = red - targetColor.r;
    const gDiff = green - targetColor.g;
    const bDiff = blue - targetColor.b;
    const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
    
    let shouldRemove = false;
    
    // Primary check: RGB distance to target
    if (distance <= fuzz) {
      shouldRemove = true;
    }
    
    // HSL-based detection for better accuracy
    if (!shouldRemove) {
      if (targetIsMagenta) {
        shouldRemove = isMagentaScreenHSL(red, green, blue, hueTolerance);
      } else if (targetIsGreen) {
        shouldRemove = isGreenScreenHSL(red, green, blue, hueTolerance);
      }
    }
    
    // Fallback RGB pattern matching
    if (!shouldRemove && targetIsMagenta) {
      // Pure magenta patterns
      const isPureMagenta = red > 200 && green < 80 && blue > 200;
      const isMagentaScreen = red > 180 && green < 100 && blue > 180 && (red - green) > 100 && (blue - green) > 100;
      shouldRemove = isPureMagenta || isMagentaScreen;
    }
    
    if (!shouldRemove && targetIsGreen) {
      // Strict green screen patterns - green must strongly dominate
      // Character greens (eyes, clothes) typically have more balanced RGB
      const greenRatio = green / (Math.max(1, red) + Math.max(1, blue));
      const isPureGreenScreen = greenRatio > 1.5 && green > 100 && red < 80 && blue < 100;
      const isStrongGreen = green > 120 && red < 60 && blue < 80 && green > (red + blue) * 1.3;
      shouldRemove = isPureGreenScreen || isStrongGreen;
    }
    
    if (shouldRemove) {
      data[i + 3] = 0;
      transparentCount++;
    }

    // Report progress
    if (i % (reportInterval * 4) === 0) {
      const progress = Math.min(100, Math.round((i / data.length) * 100));
      onProgress(progress);
    }
  }

  // Second pass: Edge cleanup for semi-transparent pixels
  
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    
    // Skip fully transparent pixels
    if (alpha === 0) continue;
    
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    
    // More aggressive edge cleanup for semi-transparent AND opaque edge pixels
    if (targetIsMagenta) {
      // Check for magenta/pink tint - more aggressive detection
      const hasMagentaTint = red > 120 && blue > 80 && green < 120 && (red + blue) > (green * 2);
      const hasStrongMagentaTint = red > 180 && blue > 150 && green < 100;
      
      if (hasStrongMagentaTint) {
        data[i + 3] = 0; // Remove completely
      } else if (hasMagentaTint) {
        const tintStrength = (red + blue) / (green + 1);
        if (tintStrength > 3.0) {
          data[i + 3] = 0; // Remove completely if strong tint
        } else if (tintStrength > 2.0) {
          data[i + 3] = Math.floor(alpha * 0.4); // Reduce alpha by 60%
        } else if (alpha < 255) {
          data[i + 3] = Math.floor(alpha * 0.6); // Reduce alpha by 40%
        }
      }
    } else if (targetIsGreen) {
      // Check for green tint - more aggressive detection
      const hasGreenTint = green > 100 && red < 120 && blue < 120 && (green - red) > 40 && (green - blue) > 20;
      const hasStrongGreenTint = green > 150 && red < 80 && blue < 100 && (green - red) > 70;
      
      if (hasStrongGreenTint) {
        data[i + 3] = 0; // Remove completely
      } else if (hasGreenTint) {
        const tintStrength = green / ((red + blue) / 2 + 1);
        if (tintStrength > 2.0) {
          data[i + 3] = 0; // Remove completely if strong tint
        } else if (tintStrength > 1.5) {
          data[i + 3] = Math.floor(alpha * 0.4); // Reduce alpha by 60%
        } else if (alpha < 255) {
          data[i + 3] = Math.floor(alpha * 0.6); // Reduce alpha by 40%
        }
      }
    }
  }
  
  // Third pass: Desaturate remaining edge pixels to remove color tint
  // This ensures clean edges without colored halos
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    
    // Skip fully transparent pixels and process semi-transparent ones
    if (alpha === 0 || alpha === 255) continue;
    
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    
    // Detect remaining tint
    let hasTint = false;
    
    if (targetIsMagenta) {
      hasTint = (red > 100 || blue > 100) && green < 100 && (red + blue) > (green * 1.8);
    } else if (targetIsGreen) {
      hasTint = green > 80 && (green - red) > 30 && (green - blue) > 15;
    }
    
    if (hasTint) {
      // Desaturate by averaging with grayscale equivalent
      const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
      data[i] = Math.round((red + gray) / 2);
      data[i + 1] = Math.round((green + gray) / 2);
      data[i + 2] = Math.round((blue + gray) / 2);
    }
  }

  onProgress(100);
  return data;
}

// Worker message handler
self.onmessage = function(e: MessageEvent<ChromaKeyWorkerMessage>) {
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
