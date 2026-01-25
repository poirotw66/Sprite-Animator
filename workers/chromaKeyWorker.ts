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
    
    const isMagentaLike = red > 180 && green < 100 && blue > 100;
    const isWithinDistance = distance <= fuzz;
    const isCloseToTarget = rClose && gClose && bClose;
    
    if (isCloseToTarget || isWithinDistance || (isMagentaLike && distance < fuzz * 5)) {
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
