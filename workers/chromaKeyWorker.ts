/**
 * Web Worker for chroma key removal processing.
 * Processes images in the background to avoid blocking the main thread.
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
 * Process chroma key removal with progress reporting
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
  
  let transparentCount = 0;
  const reportInterval = Math.max(1, Math.floor(totalPixels / 100)); // Report every 1%

  // First pass: Detect the actual background color by sampling corners
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
  
  // Detect if we're looking for magenta or green based on chromaKey
  const lookingForMagenta = chromaKey.r > 200 && chromaKey.g < 100 && chromaKey.b > 200;
  const lookingForGreen = chromaKey.g > 100 && chromaKey.r < 100;
  
  for (const [key, count] of colorMap.entries()) {
    if (count > maxCount) {
      const [r, g, b] = key.split(',').map(Number);
      // Match magenta-like colors (high R, low G, high B)
      const isMagentaLike = r > 180 && g < 100 && b > 100;
      // Match green screen colors (low R, high G, low-medium B)
      // Standard green screen #00B140 = R:0, G:177, B:64
      const isGreenLike = g > 80 && r < 120 && b < 150 && g > r && g > b;
      
      if ((lookingForMagenta && isMagentaLike) || (lookingForGreen && isGreenLike)) {
        mostCommonColor = { r, g, b };
        maxCount = count;
      }
    }
  }
  
  const targetColor = maxCount > 10 ? mostCommonColor : chromaKey;

  // Process each pixel with progress reporting
  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const alpha = data[i + 3];

    if (alpha === 0) {
      transparentCount++;
      continue;
    }

    const rDiff = red - targetColor.r;
    const gDiff = green - targetColor.g;
    const bDiff = blue - targetColor.b;
    const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

    const rClose = Math.abs(red - targetColor.r) <= fuzz;
    const gClose = Math.abs(green - targetColor.g) <= fuzz;
    const bClose = Math.abs(blue - targetColor.b) <= fuzz;
    
    // Detect if target is magenta-like or green-like
    const targetIsMagenta = targetColor.r > 200 && targetColor.g < 100 && targetColor.b > 200;
    // For green screen #00B140: G=177, R=0, B=64 - also match #00FF00
    const targetIsGreen = targetColor.g > 100 && targetColor.r < 100;
    
    // Conservative magenta detection (when target is magenta):
    // IMPORTANT: Only detect PURE magenta screen colors, not character pinks/purples
    // Magenta screen is typically very saturated magenta with high R and B, low G
    const isPureMagenta = red > 200 && green < 60 && blue > 200 && (red + blue) > (green * 3);
    const isMagentaScreen = red > 180 && green < 80 && blue > 180 && (red - green) > 120 && (blue - green) > 120;
    const isBrightMagentaScreen = red > 220 && green < 100 && blue > 220 && (red + blue) > green * 4;
    const isNeonMagenta = red > 230 && green < 80 && blue > 230;
    // For edges/anti-aliasing of magenta screen - still quite strict
    const isMagentaEdge = red > 150 && green < 100 && blue > 150 && (red - green) > 80 && (blue - green) > 80;
    
    // Expanded green detection (when target is green)
    // IMPORTANT: Only detect green SCREEN colors, not character greens (eyes, clothes, etc.)
    // Standard green screen #00B140 = R:0, G:177, B:64
    // Key: Green screen has VERY LOW red and relatively low blue
    
    // Pure bright green (like #00FF00) - very low R and B
    const isPureGreen = green > 180 && red < 50 && blue < 50;
    // Standard green screen (#00B140 range) - R must be very low
    const isStandardGreenScreen = green > 120 && red < 50 && blue < 100 && (green - red) > 100 && (green - blue) > 50;
    // Bright green screen variations - strict conditions
    const isBrightGreenScreen = green > 150 && red < 60 && blue < 80 && green > red * 3 && green > blue * 2;
    // Neon/saturated green - almost pure green channel
    const isNeonGreen = green > 200 && red < 60 && blue < 60;
    // Darker green screen - still needs very low R
    const isDarkGreenScreen = green > 100 && green < 200 && red < 40 && blue < 80 && green > (red + blue) * 1.5;
    // For edges/anti-aliasing of green screen - stricter
    const isGreenEdge = green > 100 && red < 60 && blue < 90 && (green - red) > 60 && (green - blue) > 30;
    
    const isWithinDistance = distance <= fuzz;
    const isCloseToTarget = rClose && gClose && bClose;
    
    // Apply appropriate detection based on target color
    const magentaMatch = targetIsMagenta && (isPureMagenta || 
        isMagentaScreen ||
        isBrightMagentaScreen ||
        isNeonMagenta ||
        isMagentaEdge ||
        (distance < fuzz * 1.5));
    
    const greenMatch = targetIsGreen && (isPureGreen ||
        isStandardGreenScreen ||
        isBrightGreenScreen ||
        isNeonGreen ||
        isDarkGreenScreen ||
        isGreenEdge ||
        (distance < fuzz * 1.8));
    
    // Remove if: close to target color, within fuzz distance, or matches color family
    if (isCloseToTarget || isWithinDistance || magentaMatch || greenMatch) {
      data[i + 3] = 0;
      transparentCount++;
    }

    // Report progress periodically
    if (i % (reportInterval * 4) === 0) {
      const progress = Math.min(100, Math.round((i / data.length) * 100));
      onProgress(progress);
    }
  }

  // Second pass: Edge cleanup - remove background color tint from semi-transparent pixels
  // This handles anti-aliasing artifacts at character edges
  const targetIsMagenta = targetColor.r > 200 && targetColor.g < 100 && targetColor.b > 200;
  const targetIsGreen = targetColor.g > 150 && targetColor.r < 150 && targetColor.b < 150;
  
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
