/**
 * Utility functions for image processing and manipulation
 * 
 * @module imageUtils
 */

import { logger } from './logger';

/**
 * Configuration for slicing a sprite sheet into individual frames
 */
export interface SliceSettings {
  cols: number;
  rows: number;
  paddingX: number;
  paddingY: number;
  shiftX: number;
  shiftY: number;
  // Optional: Track which values were auto-optimized
  autoOptimized?: {
    paddingX?: boolean;
    paddingY?: boolean;
    shiftX?: boolean;
    shiftY?: boolean;
  };
}

/**
 * Slices a sprite sheet image into multiple individual frame images.
 * Supports padding (size reduction) and shift (position adjustment) for fine-tuning.
 * 
 * @param base64Image - Base64 encoded sprite sheet image
 * @param cols - Number of columns in the grid
 * @param rows - Number of rows in the grid
 * @param paddingX - Horizontal padding (reduces effective width from both sides)
 * @param paddingY - Vertical padding (reduces effective height from both sides)
 * @param shiftX - Horizontal shift offset
 * @param shiftY - Vertical shift offset
 * @param removeBg - Whether to remove white/light backgrounds
 * @param threshold - Color threshold for background removal (default: 230)
 * @returns Promise resolving to an array of base64 encoded frame images
 * 
 * @throws {Error} If canvas context creation fails or image loading fails
 * 
 * @example
 * ```typescript
 * const frames = await sliceSpriteSheet(
 *   spriteSheetBase64,
 *   4, 4,  // 4x4 grid
 *   10, 10, // 10px padding on each side
 *   5, 5,   // 5px shift
 *   true,   // Remove background
 *   230     // Threshold
 * );
 * ```
 */
/**
 * Slices a sprite sheet image into multiple individual frame images with industrial-grade precision.
 * Uses integer coordinates to prevent texture bleeding and ensure pixel-perfect alignment.
 * 
 * @param base64Image - Base64 encoded sprite sheet image
 * @param cols - Number of columns in the grid
 * @param rows - Number of rows in the grid
 * @param paddingX - Horizontal padding (reduces effective width from both sides)
 * @param paddingY - Vertical padding (reduces effective height from both sides)
 * @param shiftX - Horizontal shift offset
 * @param shiftY - Vertical shift offset
 * @param removeBg - Whether to remove white/light backgrounds (legacy, not used after chroma key removal)
 * @param threshold - Color threshold for background removal (default: 230)
 * @returns Promise resolving to an array of base64 encoded frame images
 * 
 * @throws {Error} If canvas context creation fails, image loading fails, or invalid parameters
 * 
 * @example
 * ```typescript
 * const frames = await sliceSpriteSheet(
 *   spriteSheetBase64,
 *   4, 4,  // 4x4 grid
 *   10, 10, // 10px padding on each side
 *   5, 5,   // 5px shift
 *   false,  // Background already removed
 *   230     // Threshold (not used)
 * );
 * ```
 */
export const sliceSpriteSheet = async (
  base64Image: string,
  cols: number,
  rows: number,
  paddingX: number,
  paddingY: number,
  shiftX: number,
  shiftY: number,
  removeBg: boolean,
  threshold: number = 230
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    // Input validation
    if (cols <= 0 || rows <= 0 || !Number.isInteger(cols) || !Number.isInteger(rows)) {
      reject(new Error(`Invalid grid dimensions: cols=${cols}, rows=${rows}. Must be positive integers.`));
      return;
    }

    if (paddingX < 0 || paddingY < 0) {
      reject(new Error(`Invalid padding: paddingX=${paddingX}, paddingY=${paddingY}. Must be non-negative.`));
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const frames: string[] = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { 
          willReadFrequently: true,
          alpha: true,
          desynchronized: false // Ensure consistent rendering
        });

        if (!ctx) {
          reject(new Error('Canvas context creation failed. Browser may not support canvas.'));
          return;
        }

        const totalWidth = img.width;
        const totalHeight = img.height;

        // Validate image dimensions
        if (totalWidth <= 0 || totalHeight <= 0) {
          reject(new Error(`Invalid image dimensions: ${totalWidth}x${totalHeight}`));
          return;
        }

        // Calculate start position first (before calculating effective area)
        let startX = Math.round(paddingX + shiftX);
        let startY = Math.round(paddingY + shiftY);

        // Auto-adjust start position if out of bounds (clamp to valid range)
        startX = Math.max(0, Math.min(startX, totalWidth - 1));
        startY = Math.max(0, Math.min(startY, totalHeight - 1));

        // Effective Grid Area: Reduced by padding from the start position
        // Account for remaining padding on the right/bottom after shift
        const remainingPaddingX = Math.max(0, paddingX - shiftX);
        const remainingPaddingY = Math.max(0, paddingY - shiftY);
        const effectiveWidth = totalWidth - startX - remainingPaddingX;
        const effectiveHeight = totalHeight - startY - remainingPaddingY;

        if (effectiveWidth <= 0 || effectiveHeight <= 0) {
          reject(new Error(`Invalid effective area: ${effectiveWidth}x${effectiveHeight}. Please adjust padding (${paddingX}, ${paddingY}) or shift (${shiftX}, ${shiftY}) values.`));
          return;
        }

        // Calculate cell dimensions with precise rounding
        // Use Math.round for better accuracy than Math.floor
        const cellWidth = effectiveWidth / cols;
        const cellHeight = effectiveHeight / rows;

        // Ensure frame dimensions are integers (pixel-perfect alignment)
        const frameWidth = Math.round(cellWidth);
        const frameHeight = Math.round(cellHeight);

        if (frameWidth <= 0 || frameHeight <= 0) {
          reject(new Error(`Invalid frame dimensions: ${frameWidth}x${frameHeight}`));
          return;
        }

        // Set canvas size once (reused for all frames)
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        
        // Disable image smoothing for pixel-perfect rendering
        ctx.imageSmoothingEnabled = false;
        ctx.imageSmoothingQuality = 'low';

        // Process each frame
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            // Clear canvas for this frame
            ctx.clearRect(0, 0, frameWidth, frameHeight);

            // Calculate source coordinates using integer rounding to prevent texture bleeding
            // This ensures pixel-perfect alignment and consistent behavior across browsers
            const sx = Math.round(startX + c * cellWidth);
            const sy = Math.round(startY + r * cellHeight);

            // Boundary checking: ensure source coordinates are within image bounds
            const sourceX = Math.max(0, Math.min(sx, totalWidth - 1));
            const sourceY = Math.max(0, Math.min(sy, totalHeight - 1));
            
            // Calculate actual source dimensions (may be reduced if near edges)
            const sourceWidth = Math.min(frameWidth, totalWidth - sourceX);
            const sourceHeight = Math.min(frameHeight, totalHeight - sourceY);

            // Draw the source region to canvas
            // Use integer coordinates for both source and destination to prevent texture bleeding
            ctx.drawImage(
              img,
              sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle (integer coords)
              0, 0, frameWidth, frameHeight // Destination rectangle
            );

            // Legacy background removal (not used after chroma key removal, but kept for compatibility)
            if (removeBg) {
              const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
              const data = imageData.data;

              for (let i = 0; i < data.length; i += 4) {
                const red = data[i];
                const green = data[i + 1];
                const blue = data[i + 2];
                if (red > threshold && green > threshold && blue > threshold) {
                  data[i + 3] = 0; // Set alpha to 0
                }
              }
              ctx.putImageData(imageData, 0, 0);
            }

            // Convert to base64
            frames.push(canvas.toDataURL('image/png'));
          }
        }

        resolve(frames);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(`Slicing failed: ${String(error)}`));
      }
    };
    
    img.onerror = (e) => {
      reject(new Error('Failed to load sprite sheet image. The image may be corrupted or in an unsupported format.'));
    };
    
    // Set crossOrigin to avoid CORS issues
    img.crossOrigin = 'anonymous';
    img.src = base64Image;
  });
};

/**
 * Automatically optimizes slice settings by analyzing the sprite sheet image.
 * Detects content boundaries and calculates optimal padding and shift values.
 * 
 * @param base64Image - Base64 encoded sprite sheet image
 * @param cols - Number of columns in the grid
 * @param rows - Number of rows in the grid
 * @returns Promise resolving to optimized slice settings
 * 
 * @example
 * ```typescript
 * const optimized = await optimizeSliceSettings(spriteSheetBase64, 4, 4);
 * // Returns: { paddingX: 10, paddingY: 10, shiftX: 5, shiftY: 5 }
 * ```
 */
export const optimizeSliceSettings = async (
  base64Image: string,
  cols: number,
  rows: number
): Promise<{ paddingX: number; paddingY: number; shiftX: number; shiftY: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          reject(new Error('Canvas context creation failed'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        // Helper function to check if pixel is transparent or background
        const isTransparent = (r: number, g: number, b: number, a: number) => {
          if (a < 10) return true; // Transparent
          // Magenta chroma key (#FF00FF or close)
          if (r > 180 && g < 100 && b > 100) return true;
          // Black background
          if (r < 30 && g < 30 && b < 30) return true;
          return false;
        };

        // Scan edges to find content boundaries
        // Top edge: find first non-transparent row
        let topPadding = 0;
        for (let y = 0; y < height; y++) {
          let hasContent = false;
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (!isTransparent(r, g, b, a)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            topPadding = y;
            break;
          }
        }

        // Bottom edge: find last non-transparent row
        let bottomPadding = 0;
        for (let y = height - 1; y >= 0; y--) {
          let hasContent = false;
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (!isTransparent(r, g, b, a)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            bottomPadding = height - 1 - y;
            break;
          }
        }

        // Left edge: find first non-transparent column
        let leftPadding = 0;
        for (let x = 0; x < width; x++) {
          let hasContent = false;
          for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (!isTransparent(r, g, b, a)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            leftPadding = x;
            break;
          }
        }

        // Right edge: find last non-transparent column
        let rightPadding = 0;
        for (let x = width - 1; x >= 0; x--) {
          let hasContent = false;
          for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (!isTransparent(r, g, b, a)) {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            rightPadding = width - 1 - x;
            break;
          }
        }

        // Calculate optimal padding (use minimum of left/right and top/bottom)
        // This ensures we don't cut off content
        const optimalPaddingX = Math.min(leftPadding, rightPadding);
        const optimalPaddingY = Math.min(topPadding, bottomPadding);

        // Calculate effective area after padding
        const effectiveWidth = width - optimalPaddingX * 2;
        const effectiveHeight = height - optimalPaddingY * 2;
        const cellWidth = effectiveWidth / cols;
        const cellHeight = effectiveHeight / rows;

        // Calculate optimal shift to center the grid
        // This centers the content within the available space
        const centerX = width / 2;
        const centerY = height / 2;
        const gridCenterX = optimalPaddingX + effectiveWidth / 2;
        const gridCenterY = optimalPaddingY + effectiveHeight / 2;
        const optimalShiftX = Math.round(centerX - gridCenterX);
        const optimalShiftY = Math.round(centerY - gridCenterY);

        // Clamp values to reasonable ranges
        const paddingX = Math.max(0, Math.min(optimalPaddingX, Math.floor(width * 0.1)));
        const paddingY = Math.max(0, Math.min(optimalPaddingY, Math.floor(height * 0.1)));
        const shiftX = Math.max(-50, Math.min(50, optimalShiftX));
        const shiftY = Math.max(-50, Math.min(50, optimalShiftY));

        logger.debug('Auto-optimized slice settings', {
          paddingX,
          paddingY,
          shiftX,
          shiftY,
          original: { left: leftPadding, right: rightPadding, top: topPadding, bottom: bottomPadding },
        });

        resolve({ paddingX, paddingY, shiftX, shiftY });
      } catch (error) {
        logger.error('Auto-optimization failed', error);
        // Return default values on error
        resolve({ paddingX: 0, paddingY: 0, shiftX: 0, shiftY: 0 });
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for optimization'));
    };

    img.crossOrigin = 'anonymous';
    img.src = base64Image;
  });
};

/**
 * Loads multiple images and extracts their raw pixel data for export processing.
 * 
 * @param frames - Array of base64 encoded image strings
 * @returns Promise resolving to image data including pixel arrays, width, and height
 * 
 * @throws {Error} If any image fails to load
 * 
 * @example
 * ```typescript
 * const { imagesData, width, height } = await loadImagesData(frameArray);
 * // imagesData contains Uint8ClampedArray pixel data for each frame
 * ```
 */
export const loadImagesData = async (
  frames: string[]
): Promise<{ imagesData: { data: Uint8ClampedArray; width: number; height: number }[]; width: number; height: number }> => {
  const imagesData: { data: Uint8ClampedArray; width: number; height: number }[] = [];
  let width = 0;
  let height = 0;

  for (let i = 0; i < frames.length; i++) {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          if (width === 0) {
            width = img.width;
            height = img.height;
          }
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, img.width, img.height);
            imagesData.push({ data: imgData.data, width: img.width, height: img.height });
          }
          resolve();
        } catch (err) {
          logger.error(`Error processing frame ${i + 1}:`, err);
          reject(err);
        }
      };
      img.onerror = (err) => {
        logger.error(`Failed to load frame ${i + 1}`, err);
        reject(new Error(`Failed to load frame ${i + 1}`));
      };
      // Set crossOrigin to avoid CORS issues
      img.crossOrigin = 'anonymous';
      img.src = frames[i];
    });
  }
  return { imagesData, width, height };
};

/**
 * Removes the data URL prefix from a base64 encoded image string.
 * 
 * @param base64 - Base64 string with optional data URL prefix
 * @returns Clean base64 string without prefix
 * 
 * @example
 * ```typescript
 * const clean = cleanBase64("data:image/png;base64,iVBORw0KG...");
 * // Returns: "iVBORw0KG..."
 * ```
 */
export const cleanBase64 = (base64: string): string => {
  return base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
};

/**
 * Removes chroma key (magenta #FF00FF) background from an image using fuzz tolerance.
 * Similar to ImageMagick's: magick sprite.png -fuzz 2% -transparent "#FF00FF" output.png
 * 
 * @param base64Image - Base64 encoded image with chroma key background
 * @param chromaKey - RGB color to remove (default: {r: 255, g: 0, b: 255} for #FF00FF)
 * @param fuzzPercent - Tolerance percentage (0-100, default: 2)
 * @returns Promise resolving to base64 encoded image with transparent background
 * 
 * @example
 * ```typescript
 * const processed = await removeChromaKey(spriteSheetBase64, {r: 255, g: 0, b: 255}, 2);
 * ```
 */
export const removeChromaKey = async (
  base64Image: string,
  chromaKey: { r: number; g: number; b: number } = { r: 255, g: 0, b: 255 },
  fuzzPercent: number = 2
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }

      // Draw the image
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calculate total pixels first
      const totalPixels = data.length / 4;

      // First pass: Detect the actual background color by sampling corners and edges
      // These areas are most likely to be background
      const width = canvas.width;
      const height = canvas.height;
      const sampleSize = Math.min(100, Math.floor(Math.sqrt(totalPixels) / 10));
      const colorMap = new Map<string, number>();
      
      // Sample corners and edges for background color detection
      const samplePoints: Array<[number, number]> = [];
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          // Top-left corner
          samplePoints.push([x, y]);
          // Top-right corner
          samplePoints.push([width - 1 - x, y]);
          // Bottom-left corner
          samplePoints.push([x, height - 1 - y]);
          // Bottom-right corner
          samplePoints.push([width - 1 - x, height - 1 - y]);
        }
      }
      
      // Count color occurrences in sample areas
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
      
      // Find the most common color (likely the background)
      let mostCommonColor = chromaKey;
      let maxCount = 0;
      for (const [key, count] of colorMap.entries()) {
        if (count > maxCount) {
          const [r, g, b] = key.split(',').map(Number);
          // Check if it's magenta-like (high R, low G, high B)
          if (r > 180 && g < 100 && b > 100) {
            mostCommonColor = { r, g, b };
            maxCount = count;
          }
        }
      }
      
      logger.debug('Background color detection', {
        color: mostCommonColor,
        count: maxCount,
      });
      
      // Use detected color or fallback to provided chromaKey
      const targetColor = maxCount > 10 ? mostCommonColor : chromaKey;
      
      // Calculate fuzz tolerance - use a more permissive approach
      const fuzz = (fuzzPercent / 100) * 255;
      
      let transparentCount = 0;
      let samplePixels: Array<{ r: number; g: number; b: number; distance?: number }> = [];
      let sampleCount = 0;

      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        const alpha = data[i + 3];

        // Skip if already transparent
        if (alpha === 0) {
          transparentCount++;
          continue;
        }

        // Sample first 10 pixels for debugging
        if (sampleCount < 10) {
          const rDiff = red - targetColor.r;
          const gDiff = green - targetColor.g;
          const bDiff = blue - targetColor.b;
          const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
          samplePixels.push({ r: red, g: green, b: blue, distance });
          sampleCount++;
        }

        // Calculate Euclidean distance from detected background color
        const rDiff = red - targetColor.r;
        const gDiff = green - targetColor.g;
        const bDiff = blue - targetColor.b;
        const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

        // More permissive matching: Check if it's close to detected background color
        // Also check if it follows magenta-like pattern (high R, low G, high B)
        const rClose = Math.abs(red - targetColor.r) <= fuzz;
        const gClose = Math.abs(green - targetColor.g) <= fuzz;
        const bClose = Math.abs(blue - targetColor.b) <= fuzz;
        
        // Pattern-based matching for magenta-like colors
        const isMagentaLike = red > 180 && green < 100 && blue > 100;
        const isWithinDistance = distance <= fuzz;
        const isCloseToTarget = rClose && gClose && bClose;
        
        // Match if it's close to detected color OR follows magenta pattern
        if (isCloseToTarget || isWithinDistance || (isMagentaLike && distance < fuzz * 5)) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
          transparentCount++;
        }
      }
      
      // Debug: Log processing results (only in development)
      logger.debug('Chroma key removal', {
        targetColor,
        fuzz: fuzz.toFixed(1),
        transparentPixels: transparentCount,
        totalPixels,
        percentage: ((transparentCount/totalPixels)*100).toFixed(1),
        samplePixels: samplePixels.slice(0, 3), // Only log first 3 in dev
      });

      // Put processed data back
      ctx.putImageData(imageData, 0, 0);

      // Return as base64
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => reject(e);
    img.src = base64Image;
  });
};

/**
 * Removes white/light background from an image (legacy method).
 * Used for preview display before proper chroma key removal.
 * 
 * @param base64Image - Base64 encoded image
 * @param threshold - Color threshold (default: 230)
 * @returns Promise resolving to base64 encoded image with transparent background
 */
export const removeWhiteBackground = async (
  base64Image: string,
  threshold: number = 230
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        if (red > threshold && green > threshold && blue > threshold) {
          data[i + 3] = 0; // Set alpha to 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => reject(e);
    img.src = base64Image;
  });
};
