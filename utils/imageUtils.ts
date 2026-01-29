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
 * Per-frame override for cutting position and crop size.
 * - offsetX, offsetY: Position offset in pixels from the cell center (-60 to 60).
 * - scale: Crop size ratio 0.25–1 (25%–100%), aspect ratio fixed to the cell.
 */
export interface FrameOverride {
  offsetX?: number;
  offsetY?: number;
  scale?: number;
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
  threshold: number = 230,
  frameOverrides?: FrameOverride[]
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
            const frameIndex = r * cols + c;
            const override = frameOverrides?.[frameIndex];

            // Apply per-frame overrides: position (offsetX, offsetY) and size (scale, aspect fixed)
            const scale = Math.max(0.25, Math.min(1, override?.scale ?? 1));
            const cropW = cellWidth * scale;
            const cropH = cellHeight * scale;
            const offX = override?.offsetX ?? 0;
            const offY = override?.offsetY ?? 0;

            // Base cell top-left
            const baseSx = startX + c * cellWidth;
            const baseSy = startY + r * cellHeight;
            // Center crop + position offset (allowed to overflow cell; samples from original sheet)
            const sx = baseSx + (cellWidth - cropW) / 2 + offX;
            const sy = baseSy + (cellHeight - cropH) / 2 + offY;

            // Intersect crop with image: overflow shows sheet, out-of-image stays transparent
            const srcLeft = Math.max(0, sx);
            const srcTop = Math.max(0, sy);
            const srcRight = Math.min(totalWidth, sx + cropW);
            const srcBottom = Math.min(totalHeight, sy + cropH);
            const srcW = srcRight - srcLeft;
            const srcH = srcBottom - srcTop;

            ctx.clearRect(0, 0, frameWidth, frameHeight);
            if (srcW > 0 && srcH > 0) {
              const dstX = ((srcLeft - sx) / cropW) * frameWidth;
              const dstY = ((srcTop - sy) / cropH) * frameHeight;
              const dstW = (srcW / cropW) * frameWidth;
              const dstH = (srcH / cropH) * frameHeight;
              ctx.drawImage(
                img,
                srcLeft, srcTop, srcW, srcH,
                dstX, dstY, dstW, dstH
              );
            }

            // Post-processing: Remove floor lines and optimize content
            const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
            const data = imageData.data;
            
            // Step 1: Remove ALL chroma key pixels throughout the frame
            // Supports both magenta (#FF00FF) and green (#00FF00) backgrounds
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];
              
              if (a === 0) continue;
              
              // Comprehensive magenta/pink detection
              const isPureMagenta = r > 200 && g < 50 && b > 200;
              const isMagentaLike = r > 180 && g < 100 && b > 100;
              const isPinkVariant = r > 200 && g < 150 && b > 150 && (r - g) > 80;
              const isLightPink = r > 220 && g < 180 && b > 180 && g < r && g < b;
              const isDarkMagenta = r > 150 && g < 80 && b > 150;
              
              // Comprehensive green screen detection - wider range
              const isPureGreen = g > 200 && r < 80 && b < 80;
              const isGreenLike = g > 150 && r < 120 && b < 120 && g > r && g > b;
              const isLightGreen = g > 180 && r < 180 && b < 180 && (g - r) > 50 && (g - b) > 50;
              const isYellowGreen = g > 150 && r < 180 && b < 100 && g > r && g > b;
              const isDarkGreen = g > 100 && r < 80 && b < 80 && g > r * 1.5;
              const isMintGreen = g > 180 && r < 200 && b < 200 && g > r && g > b && (g - Math.max(r, b)) > 30;
              const isNeonGreen = g > 200 && r < 150 && b < 100;
              
              const isMagentaFamily = isPureMagenta || isMagentaLike || isPinkVariant || isLightPink || isDarkMagenta;
              const isGreenFamily = isPureGreen || isGreenLike || isLightGreen || isYellowGreen || isDarkGreen || isMintGreen || isNeonGreen;
              
              if (isMagentaFamily || isGreenFamily) {
                data[i + 3] = 0; // Make transparent
              }
            }
            
            // Step 2: Extra pass for floor/ground area (bottom 30% of frame)
            // More aggressive removal for the foot region
            const floorRegionStartY = Math.floor(frameHeight * 0.7);
            
            for (let y = floorRegionStartY; y < frameHeight; y++) {
              for (let x = 0; x < frameWidth; x++) {
                const idx = (y * frameWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];
                
                if (a === 0) continue;
                
                // In foot region, be more aggressive with chroma key removal
                // Magenta variants
                const hasMoreRedThanGreen = r > g + 30;
                const hasMoreBlueThanGreen = b > g + 30;
                const isAnyPink = hasMoreRedThanGreen && hasMoreBlueThanGreen && r > 150 && b > 100;
                const isSubtleMagenta = r > 170 && g < 120 && b > 120;
                
                // Green variants - more aggressive for foot region
                const hasMoreGreenThanRed = g > r + 20;
                const hasMoreGreenThanBlue = g > b + 20;
                const isAnyGreen = hasMoreGreenThanRed && hasMoreGreenThanBlue && g > 120;
                const isSubtleGreen = g > 140 && r < 150 && b < 150 && g > r && g > b;
                const isBrightGreen = g > 180 && r < 180 && b < 180;
                
                if (isAnyPink || isSubtleMagenta || isAnyGreen || isSubtleGreen || isBrightGreen) {
                  data[idx + 3] = 0;
                }
              }
            }
            
            // Step 3: Legacy background removal (not used after chroma key removal, but kept for compatibility)
            if (removeBg) {
              for (let i = 0; i < data.length; i += 4) {
                const red = data[i];
                const green = data[i + 1];
                const blue = data[i + 2];
                if (red > threshold && green > threshold && blue > threshold) {
                  data[i + 3] = 0; // Set alpha to 0
                }
              }
            }
            
            // Put processed image data back
            ctx.putImageData(imageData, 0, 0);

            // Convert to base64
            // Note: All frames maintain uniform dimensions for consistent animation playback
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
/**
 * Returns the source rectangle (in sheet pixel coords) for a given frame index.
 * Uses the same formulas as sliceSpriteSheet so the crop box aligns with actual slicing.
 *
 * @param sheetWidth - Sprite sheet image width
 * @param sheetHeight - Sprite sheet image height
 * @param cols - Number of columns
 * @param rows - Number of rows
 * @param paddingX - Horizontal padding
 * @param paddingY - Vertical padding
 * @param shiftX - Horizontal shift
 * @param shiftY - Vertical shift
 * @param frameIndex - Frame index (0-based, row-major)
 * @returns { x, y, width, height } in sheet coords, or null if frameIndex is out of bounds
 */
export const getCellRectForFrame = (
  sheetWidth: number,
  sheetHeight: number,
  cols: number,
  rows: number,
  paddingX: number,
  paddingY: number,
  shiftX: number,
  shiftY: number,
  frameIndex: number
): { x: number; y: number; width: number; height: number } | null => {
  if (frameIndex < 0 || frameIndex >= cols * rows) return null;
  let startX = Math.round(paddingX + shiftX);
  let startY = Math.round(paddingY + shiftY);
  startX = Math.max(0, Math.min(startX, sheetWidth - 1));
  startY = Math.max(0, Math.min(startY, sheetHeight - 1));
  const remainingPaddingX = Math.max(0, paddingX - shiftX);
  const remainingPaddingY = Math.max(0, paddingY - shiftY);
  const effectiveWidth = sheetWidth - startX - remainingPaddingX;
  const effectiveHeight = sheetHeight - startY - remainingPaddingY;
  if (effectiveWidth <= 0 || effectiveHeight <= 0) return null;
  const cellWidth = effectiveWidth / cols;
  const cellHeight = effectiveHeight / rows;
  const r = Math.floor(frameIndex / cols);
  const c = frameIndex % cols;
  return {
    x: startX + c * cellWidth,
    y: startY + r * cellHeight,
    width: cellWidth,
    height: cellHeight,
  };
};

/** Clamp for centroid-derived offset to match OFFSET_MIN/MAX used in FrameGrid */
const CENTROID_OFFSET_CLAMP = 500;

/**
 * Computes the offset (offsetX, offsetY) so that the crop box centers on the
 * content bounding-box center within the given cell. More stable than centroid
 * when limbs extend. Pixels with alpha > 20 are content; magenta-like excluded.
 *
 * @param sheetBase64 - Base64 (or data URL) of the sprite sheet
 * @param cellRect - { x, y, width, height } in sheet coords
 * @returns { offsetX, offsetY } or { offsetX: 0, offsetY: 0 } if no content
 */
export const getContentCentroidOffset = async (
  sheetBase64: string,
  cellRect: { x: number; y: number; width: number; height: number }
): Promise<{ offsetX: number; offsetY: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const x0 = Math.max(0, Math.floor(cellRect.x));
        const y0 = Math.max(0, Math.floor(cellRect.y));
        const x1 = Math.min(img.width, Math.ceil(cellRect.x + cellRect.width));
        const y1 = Math.min(img.height, Math.ceil(cellRect.y + cellRect.height));
        if (x1 <= x0 || y1 <= y0) {
          resolve({ offsetX: 0, offsetY: 0 });
          return;
        }
        const w = x1 - x0;
        const h = y1 - y0;
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({ offsetX: 0, offsetY: 0 });
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(x0, y0, w, h);
        const data = imageData.data;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            const ix = x0 + dx;
            const iy = y0 + dy;
            const idx = (dy * w + dx) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (a <= 20) continue;
            const isMagentaLike = (r > 180 && g < 100 && b > 100) ||
              (r > 150 && g < 80 && b > 150) ||
              (r > 200 && g < 50 && b > 200);
            if (isMagentaLike) continue;
            const cellX = ix - cellRect.x;
            const cellY = iy - cellRect.y;
            minX = Math.min(minX, cellX);
            maxX = Math.max(maxX, cellX);
            minY = Math.min(minY, cellY);
            maxY = Math.max(maxY, cellY);
          }
        }
        if (minX === Infinity) {
          resolve({ offsetX: 0, offsetY: 0 });
          return;
        }
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        let offsetX = centerX - cellRect.width / 2;
        let offsetY = centerY - cellRect.height / 2;
        offsetX = Math.max(-CENTROID_OFFSET_CLAMP, Math.min(CENTROID_OFFSET_CLAMP, offsetX));
        offsetY = Math.max(-CENTROID_OFFSET_CLAMP, Math.min(CENTROID_OFFSET_CLAMP, offsetY));
        resolve({ offsetX, offsetY });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => reject(new Error('Failed to load sprite sheet for centroid'));
    img.crossOrigin = 'anonymous';
    img.src = sheetBase64;
  });
};

/**
 * Crops one cell from the sheet using the same logic as sliceSpriteSheet.
 * Used for template-matching search. No post-processing (floor line, removeBg).
 */
export function cropCellFromImage(
  img: HTMLImageElement,
  cellRect: { x: number; y: number; width: number; height: number },
  offsetX: number,
  offsetY: number,
  scale: number,
  sheetWidth: number,
  sheetHeight: number
): ImageData {
  const cellWidth = cellRect.width;
  const cellHeight = cellRect.height;
  const frameW = Math.round(cellWidth);
  const frameH = Math.round(cellHeight);
  const s = Math.max(0.25, Math.min(1, scale));
  const cropW = cellWidth * s;
  const cropH = cellHeight * s;
  const sx = cellRect.x + (cellWidth - cropW) / 2 + offsetX;
  const sy = cellRect.y + (cellHeight - cropH) / 2 + offsetY;
  const srcLeft = Math.max(0, sx);
  const srcTop = Math.max(0, sy);
  const srcRight = Math.min(sheetWidth, sx + cropW);
  const srcBottom = Math.min(sheetHeight, sy + cropH);
  const srcW = srcRight - srcLeft;
  const srcH = srcBottom - srcTop;

  const canvas = document.createElement('canvas');
  canvas.width = frameW;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new ImageData(1, 1); // fallback
  ctx.imageSmoothingEnabled = false;
  if (srcW > 0 && srcH > 0) {
    const dstX = ((srcLeft - sx) / cropW) * frameW;
    const dstY = ((srcTop - sy) / cropH) * frameH;
    const dstW = (srcW / cropW) * frameW;
    const dstH = (srcH / cropH) * frameH;
    ctx.drawImage(img, srcLeft, srcTop, srcW, srcH, dstX, dstY, dstW, dstH);
  }
  return ctx.getImageData(0, 0, frameW, frameH);
}

/** Alpha overlap: sum min(ref, cand) / (sum ref + 1e-6). Downscales to 32x32 for speed. */
function computeTemplateMatchScore(ref: ImageData, cand: ImageData): number {
  const DS = 32;
  let sumMin = 0;
  let sumRef = 0;
  for (let j = 0; j < DS; j++) {
    for (let i = 0; i < DS; i++) {
      const ri = Math.min(ref.width - 1, ((i * ref.width) / DS) | 0);
      const rj = Math.min(ref.height - 1, ((j * ref.height) / DS) | 0);
      const ci = Math.min(cand.width - 1, ((i * cand.width) / DS) | 0);
      const cj = Math.min(cand.height - 1, ((j * cand.height) / DS) | 0);
      const rA = ref.data[(rj * ref.width + ri) * 4 + 3];
      const cA = cand.data[(cj * cand.width + ci) * 4 + 3];
      sumMin += Math.min(rA, cA);
      sumRef += rA;
    }
  }
  return sumMin / (sumRef + 1e-6);
}

const TEMPLATE_MATCH_OFFSET_CLAMP = 500;

function runTemplateSearch(
  img: HTMLImageElement,
  cellRect: { x: number; y: number; width: number; height: number },
  refImageData: ImageData,
  scale: number,
  sheetWidth: number,
  sheetHeight: number,
  opts?: { prevOffsetX: number; prevOffsetY: number; maxDelta: number }
): { offsetX: number; offsetY: number } {
  const STEP = 2;
  let oxMin: number, oxMax: number, oyMin: number, oyMax: number;
  if (opts && opts.maxDelta > 0) {
    oxMin = opts.prevOffsetX - opts.maxDelta;
    oxMax = opts.prevOffsetX + opts.maxDelta;
    oyMin = opts.prevOffsetY - opts.maxDelta;
    oyMax = opts.prevOffsetY + opts.maxDelta;
  } else {
    const R = Math.min(80, Math.floor(cellRect.width / 2));
    oxMin = -R;
    oxMax = R;
    oyMin = -R;
    oyMax = R;
  }

  let bestScore = -1;
  let bestOx = opts?.prevOffsetX ?? 0;
  let bestOy = opts?.prevOffsetY ?? 0;

  for (let oy = oyMin; oy <= oyMax; oy += STEP) {
    for (let ox = oxMin; ox <= oxMax; ox += STEP) {
      const cand = cropCellFromImage(img, cellRect, ox, oy, scale, sheetWidth, sheetHeight);
      const score = computeTemplateMatchScore(refImageData, cand);
      if (score > bestScore) {
        bestScore = score;
        bestOx = ox;
        bestOy = oy;
      }
    }
  }

  // Refine: try ±2 around best for finer alignment
  for (const dox of [-2, -1, 0, 1, 2]) {
    for (const doy of [-2, -1, 0, 1, 2]) {
      if (dox === 0 && doy === 0) continue;
      const ox = bestOx + dox;
      const oy = bestOy + doy;
      if (ox < oxMin || ox > oxMax || oy < oyMin || oy > oyMax) continue;
      const cand = cropCellFromImage(img, cellRect, ox, oy, scale, sheetWidth, sheetHeight);
      const score = computeTemplateMatchScore(refImageData, cand);
      if (score > bestScore) {
        bestScore = score;
        bestOx = ox;
        bestOy = oy;
      }
    }
  }

  bestOx = Math.max(-TEMPLATE_MATCH_OFFSET_CLAMP, Math.min(TEMPLATE_MATCH_OFFSET_CLAMP, bestOx));
  bestOy = Math.max(-TEMPLATE_MATCH_OFFSET_CLAMP, Math.min(TEMPLATE_MATCH_OFFSET_CLAMP, bestOy));
  return { offsetX: bestOx, offsetY: bestOy };
}

/**
 * Finds (offsetX, offsetY) that best aligns the cell crop with the reference image
 * by template matching (alpha overlap). Accepts sheet as base64 string or
 * pre-loaded HTMLImageElement. When opts.prevOffsetX/Y and maxDelta are given,
 * searches within ±maxDelta of the previous offset.
 */
export const getBestOffsetByTemplateMatch = async (
  sheetBase64OrImage: string | HTMLImageElement,
  cellRect: { x: number; y: number; width: number; height: number },
  refImageData: ImageData,
  scale: number,
  sheetWidth: number,
  sheetHeight: number,
  opts?: { prevOffsetX: number; prevOffsetY: number; maxDelta: number }
): Promise<{ offsetX: number; offsetY: number }> => {
  if (typeof sheetBase64OrImage !== 'string') {
    try {
      return Promise.resolve(runTemplateSearch(sheetBase64OrImage, cellRect, refImageData, scale, sheetWidth, sheetHeight, opts));
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        resolve(runTemplateSearch(img, cellRect, refImageData, scale, sheetWidth, sheetHeight, opts));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => reject(new Error('Failed to load sprite sheet for template match'));
    img.crossOrigin = 'anonymous';
    img.src = sheetBase64OrImage;
  });
};

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

/**
 * Interpolation settings for frame blending
 */
export interface InterpolationSettings {
  /** Number of intermediate frames to generate between each keyframe */
  insertFrames: number;
  /** Easing function type: 'linear' | 'ease-in-out' | 'ease-in' | 'ease-out' */
  easing: 'linear' | 'ease-in-out' | 'ease-in' | 'ease-out';
  /** Whether to create a smooth loop (interpolate between last and first frame) */
  smoothLoop: boolean;
}

/**
 * Easing functions for smoother animation transitions
 */
const easingFunctions = {
  'linear': (t: number) => t,
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => t * (2 - t),
  'ease-in-out': (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};

/**
 * Blends two images together with pixel-level cross-fade interpolation.
 * Creates a smooth transition frame between two keyframes.
 * Uses proper alpha-aware blending for transparent sprites.
 * 
 * @param frame1Base64 - First frame (base64 encoded)
 * @param frame2Base64 - Second frame (base64 encoded)
 * @param t - Interpolation factor (0 = frame1, 1 = frame2)
 * @param easing - Easing function to apply
 * @returns Promise resolving to blended frame (base64 encoded)
 */
export const blendFrames = async (
  frame1Base64: string,
  frame2Base64: string,
  t: number,
  easing: 'linear' | 'ease-in-out' | 'ease-in' | 'ease-out' = 'ease-in-out'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img1 = new Image();
    const img2 = new Image();
    let loaded = 0;

    const onBothLoaded = () => {
      loaded++;
      if (loaded < 2) return;

      try {
        const width = Math.max(img1.width, img2.width);
        const height = Math.max(img1.height, img2.height);
        
        // Create canvases for both images
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        const outputCanvas = document.createElement('canvas');
        
        canvas1.width = canvas2.width = outputCanvas.width = width;
        canvas1.height = canvas2.height = outputCanvas.height = height;
        
        const ctx1 = canvas1.getContext('2d', { willReadFrequently: true });
        const ctx2 = canvas2.getContext('2d', { willReadFrequently: true });
        const ctxOut = outputCanvas.getContext('2d', { willReadFrequently: true });

        if (!ctx1 || !ctx2 || !ctxOut) {
          reject(new Error('Canvas context failed'));
          return;
        }

        // Draw both images
        ctx1.drawImage(img1, 0, 0, width, height);
        ctx2.drawImage(img2, 0, 0, width, height);

        // Get pixel data
        const imageData1 = ctx1.getImageData(0, 0, width, height);
        const imageData2 = ctx2.getImageData(0, 0, width, height);
        const outputData = ctxOut.createImageData(width, height);
        
        const data1 = imageData1.data;
        const data2 = imageData2.data;
        const dataOut = outputData.data;

        // Apply easing to the interpolation factor
        const easedT = easingFunctions[easing](t);

        // Pixel-level blending with proper alpha handling
        for (let i = 0; i < data1.length; i += 4) {
          const r1 = data1[i];
          const g1 = data1[i + 1];
          const b1 = data1[i + 2];
          const a1 = data1[i + 3];

          const r2 = data2[i];
          const g2 = data2[i + 1];
          const b2 = data2[i + 2];
          const a2 = data2[i + 3];

          // Alpha-aware blending
          const alpha1 = a1 / 255;
          const alpha2 = a2 / 255;
          
          // Interpolate alpha
          const outAlpha = alpha1 * (1 - easedT) + alpha2 * easedT;
          
          if (outAlpha > 0) {
            // Pre-multiplied alpha blending for correct color mixing
            const weight1 = alpha1 * (1 - easedT);
            const weight2 = alpha2 * easedT;
            const totalWeight = weight1 + weight2;
            
            if (totalWeight > 0) {
              dataOut[i] = Math.round((r1 * weight1 + r2 * weight2) / totalWeight);
              dataOut[i + 1] = Math.round((g1 * weight1 + g2 * weight2) / totalWeight);
              dataOut[i + 2] = Math.round((b1 * weight1 + b2 * weight2) / totalWeight);
            } else {
              dataOut[i] = 0;
              dataOut[i + 1] = 0;
              dataOut[i + 2] = 0;
            }
            dataOut[i + 3] = Math.round(outAlpha * 255);
          } else {
            dataOut[i] = 0;
            dataOut[i + 1] = 0;
            dataOut[i + 2] = 0;
            dataOut[i + 3] = 0;
          }
        }

        ctxOut.putImageData(outputData, 0, 0);
        resolve(outputCanvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img1.onload = onBothLoaded;
    img2.onload = onBothLoaded;
    img1.onerror = (e) => reject(new Error('Failed to load frame 1 for blending'));
    img2.onerror = (e) => reject(new Error('Failed to load frame 2 for blending'));
    
    img1.crossOrigin = 'anonymous';
    img2.crossOrigin = 'anonymous';
    img1.src = frame1Base64;
    img2.src = frame2Base64;
  });
};

/**
 * Generates interpolated frames between keyframes for smoother animation.
 * Uses pixel blending to create smooth transitions between poses.
 * 
 * @param keyframes - Array of keyframe images (base64 encoded)
 * @param settings - Interpolation settings
 * @returns Promise resolving to array of all frames including interpolated ones
 * 
 * @example
 * ```typescript
 * // Input: 6 keyframes, insert 2 frames between each
 * // Output: 6 + (6 * 2) = 18 frames (with loop) or 6 + (5 * 2) = 16 frames (no loop)
 * const smoothFrames = await interpolateFrames(keyframes, {
 *   insertFrames: 2,
 *   easing: 'ease-in-out',
 *   smoothLoop: true
 * });
 * ```
 */
export const interpolateFrames = async (
  keyframes: string[],
  settings: InterpolationSettings
): Promise<string[]> => {
  if (keyframes.length < 2) {
    return keyframes;
  }

  const { insertFrames, easing, smoothLoop } = settings;
  
  if (insertFrames <= 0) {
    return keyframes;
  }

  const result: string[] = [];
  const frameCount = keyframes.length;

  for (let i = 0; i < frameCount; i++) {
    // Add the keyframe
    result.push(keyframes[i]);

    // Determine the next frame (wrap around for loop)
    const nextIndex = (i + 1) % frameCount;
    
    // Skip interpolation for the last frame if not looping
    if (!smoothLoop && i === frameCount - 1) {
      continue;
    }

    // Generate intermediate frames
    for (let j = 1; j <= insertFrames; j++) {
      const t = j / (insertFrames + 1);
      try {
        const blendedFrame = await blendFrames(
          keyframes[i],
          keyframes[nextIndex],
          t,
          easing
        );
        result.push(blendedFrame);
      } catch (err) {
        logger.error(`Failed to blend frame ${i} -> ${nextIndex} at t=${t}`, err);
        // On error, skip this interpolated frame
      }
    }
  }

  return result;
};

/**
 * Creates a smooth looping animation by ensuring the last frame transitions well to the first.
 * Optionally duplicates the animation in reverse (ping-pong effect).
 * 
 * @param frames - Array of frame images (base64 encoded)
 * @param mode - 'loop' for standard loop, 'pingpong' for forward-then-backward
 * @returns Array of frames optimized for looping
 */
export const createLoopingAnimation = (
  frames: string[],
  mode: 'loop' | 'pingpong' = 'loop'
): string[] => {
  if (frames.length < 2) return frames;

  if (mode === 'pingpong') {
    // Forward + Backward (excluding first and last to avoid duplicate frames)
    const reversed = frames.slice(1, -1).reverse();
    return [...frames, ...reversed];
  }

  // Standard loop - frames already form a loop
  return frames;
};

/**
 * Generates a complete smooth animation from keyframes.
 * Combines interpolation and loop optimization.
 * 
 * @param keyframes - Original keyframe images
 * @param options - Animation generation options
 * @returns Promise resolving to smooth animation frames
 */
export const generateSmoothAnimation = async (
  keyframes: string[],
  options: {
    interpolationFrames?: number;
    easing?: 'linear' | 'ease-in-out' | 'ease-in' | 'ease-out';
    loopMode?: 'loop' | 'pingpong' | 'none';
    targetFps?: number;
    originalFps?: number;
  } = {}
): Promise<string[]> => {
  const {
    interpolationFrames = 2,
    easing = 'ease-in-out',
    loopMode = 'loop',
    targetFps = 24,
    originalFps = 12,
  } = options;

  // Calculate how many frames to insert based on FPS ratio
  let framesToInsert = interpolationFrames;
  if (targetFps && originalFps && targetFps > originalFps) {
    // Auto-calculate based on desired FPS increase
    framesToInsert = Math.max(1, Math.round(targetFps / originalFps) - 1);
  }

  // Step 1: Interpolate between keyframes
  const interpolatedFrames = await interpolateFrames(keyframes, {
    insertFrames: framesToInsert,
    easing,
    smoothLoop: loopMode === 'loop',
  });

  // Step 2: Apply loop mode
  if (loopMode === 'pingpong') {
    return createLoopingAnimation(interpolatedFrames, 'pingpong');
  }

  return interpolatedFrames;
};
