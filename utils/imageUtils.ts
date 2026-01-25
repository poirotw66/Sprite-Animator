/**
 * Utility functions for image processing and manipulation
 * 
 * @module imageUtils
 */

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
    const img = new Image();
    img.onload = () => {
      const frames: string[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }

      const totalWidth = img.width;
      const totalHeight = img.height;

      // Effective Grid Area: Reduced by padding (from both sides)
      const effectiveWidth = totalWidth - paddingX * 2;
      const effectiveHeight = totalHeight - paddingY * 2;

      if (effectiveWidth <= 0 || effectiveHeight <= 0) {
        resolve([]); // Invalid settings
        return;
      }

      const cellWidth = effectiveWidth / cols;
      const cellHeight = effectiveHeight / rows;

      const frameWidth = Math.floor(cellWidth);
      const frameHeight = Math.floor(cellHeight);

      if (frameWidth <= 0 || frameHeight <= 0) {
        resolve([]);
        return;
      }

      canvas.width = frameWidth;
      canvas.height = frameHeight;
      ctx.imageSmoothingEnabled = false;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.clearRect(0, 0, frameWidth, frameHeight);

          // Source X/Y = Start Position + Grid Index
          // Start Position = Padding (inset) + Shift (move)
          const startX = paddingX + shiftX;
          const startY = paddingY + shiftY;

          const sx = startX + c * cellWidth;
          const sy = startY + r * cellHeight;

          ctx.drawImage(img, sx, sy, cellWidth, cellHeight, 0, 0, frameWidth, frameHeight);

          // Background Removal
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

          frames.push(canvas.toDataURL('image/png'));
        }
      }
      resolve(frames);
    };
    img.onerror = (e) => reject(e);
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

  for (const frameSrc of frames) {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
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
      };
      img.onerror = reject;
      img.src = frameSrc;
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

      // Calculate fuzz tolerance (2% of 255 = ~5.1)
      const fuzz = (fuzzPercent / 100) * 255;

      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];

        // Calculate color distance from chroma key
        const rDiff = Math.abs(red - chromaKey.r);
        const gDiff = Math.abs(green - chromaKey.g);
        const bDiff = Math.abs(blue - chromaKey.b);

        // Use Euclidean distance for color matching
        const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

        // If within fuzz tolerance, make transparent
        if (distance <= fuzz) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
        }
      }

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
