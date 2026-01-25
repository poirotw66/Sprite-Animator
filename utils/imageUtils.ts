/**
 * Utility functions for image processing
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
 * Slice a sprite sheet image into multiple frames
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
 * Load images and extract their raw data
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
 * Clean base64 data URL prefix
 */
export const cleanBase64 = (base64: string): string => {
  return base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
};
