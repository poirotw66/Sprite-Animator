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
  for (const [key, count] of colorMap.entries()) {
    if (count > maxCount) {
      const [r, g, b] = key.split(',').map(Number);
      if (r > 180 && g < 100 && b > 100) {
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
    const targetIsGreen = targetColor.g > 150 && targetColor.r < 150 && targetColor.b < 150;
    
    // Expanded magenta/pink detection (when target is magenta):
    const isPureMagenta = red > 200 && green < 50 && blue > 200;
    const isMagentaLike = red > 180 && green < 100 && blue > 100;
    const isPinkVariant = red > 200 && green < 150 && blue > 150 && (red - green) > 80;
    const isLightPink = red > 220 && green < 180 && blue > 180 && green < red && green < blue;
    // Additional detection for pink border lines
    const isPinkBorder = red > 180 && blue > 150 && green < 170 && (red + blue) > (green * 2 + 50);
    const isRosePink = red > 200 && green < 160 && blue > 140 && red > blue;
    const isSoftPink = red > 190 && green < 175 && blue > 160 && (red - green) > 40;
    const isFadedMagenta = red > 170 && green < 150 && blue > 130 && red > green && blue > green;
    
    // Expanded green detection (when target is green) - much wider range:
    const isPureGreen = green > 200 && red < 80 && blue < 80;
    const isGreenLike = green > 150 && red < 120 && blue < 120 && green > red && green > blue;
    const isLightGreen = green > 180 && red < 180 && blue < 180 && (green - red) > 50 && (green - blue) > 50;
    const isYellowGreen = green > 150 && red < 180 && blue < 100 && green > red && green > blue;
    const isDarkGreen = green > 100 && red < 80 && blue < 80 && green > red * 1.5;
    const isMintGreen = green > 180 && red < 200 && blue < 200 && green > red && green > blue && (green - Math.max(red, blue)) > 30;
    const isNeonGreen = green > 200 && red < 150 && blue < 100;
    
    const isWithinDistance = distance <= fuzz;
    const isCloseToTarget = rClose && gClose && bClose;
    
    // Apply appropriate detection based on target color
    const magentaMatch = targetIsMagenta && (isPureMagenta || 
        isMagentaLike ||
        isPinkVariant ||
        isLightPink ||
        isPinkBorder ||
        isRosePink ||
        isSoftPink ||
        isFadedMagenta ||
        (distance < fuzz * 2));
    
    const greenMatch = targetIsGreen && (isPureGreen ||
        isGreenLike ||
        isLightGreen ||
        isYellowGreen ||
        isDarkGreen ||
        isMintGreen ||
        isNeonGreen ||
        (distance < fuzz * 2));
    
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
