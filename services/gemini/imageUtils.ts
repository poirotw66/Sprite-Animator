/**
 * Image utilities: chroma key normalization and aspect ratio selection.
 */

import { logger } from '../../utils/logger';
import type { ChromaKeyColorType } from '../../types';

/**
 * Normalizes background color in AI-generated images to exact chroma key color.
 * Replaces similar shades with the exact target so chroma key removal works.
 */
export async function normalizeBackgroundColor(
  base64Image: string,
  targetColor: { r: number; g: number; b: number },
  colorType: ChromaKeyColorType
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const tolerance = 100;
      let normalizedCount = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const a = data[i + 3]!;

        if (a === 0) continue;

        let isBackgroundColor = false;

        if (colorType === 'magenta') {
          const isPureMagenta = r > 200 && g < 60 && b > 200 && r + b > g * 3;
          const isMagentaScreen =
            r > 180 && g < 80 && b > 180 && r - g > 120 && b - g > 120;
          const isBrightMagentaScreen =
            r > 220 && g < 100 && b > 220 && r + b > g * 4;
          const isNeonMagenta = r > 230 && g < 80 && b > 230;

          const distance = Math.sqrt(
            Math.pow(r - targetColor.r, 2) +
              Math.pow(g - targetColor.g, 2) +
              Math.pow(b - targetColor.b, 2)
          );

          isBackgroundColor =
            isPureMagenta ||
            isMagentaScreen ||
            isBrightMagentaScreen ||
            isNeonMagenta ||
            distance < tolerance;
        } else if (colorType === 'green') {
          const isPureGreen = g > 150 && r < 100 && b < 100;
          const isStandardGreenScreen =
            g > 100 && r < 130 && b < 130 && g > r * 1.2 && g > b * 1.2;
          const isBrightGreenScreen =
            g > 140 && r < 120 && b < 120 && g > r + 40 && g > b + 40;
          const isNeonGreen = g > 180 && r < 100 && b < 100;
          const isGreenVariant =
            g > 80 && g > r * 1.3 && g > b * 1.3 && r < 150 && b < 150;

          const distance = Math.sqrt(
            Math.pow(r - targetColor.r, 2) +
              Math.pow(g - targetColor.g, 2) +
              Math.pow(b - targetColor.b, 2)
          );

          isBackgroundColor =
            isPureGreen ||
            isStandardGreenScreen ||
            isBrightGreenScreen ||
            isNeonGreen ||
            isGreenVariant ||
            distance < tolerance;
        }

        if (isBackgroundColor) {
          data[i] = targetColor.r;
          data[i + 1] = targetColor.g;
          data[i + 2] = targetColor.b;
          normalizedCount++;
        }
      }

      logger.debug('Color normalization completed', {
        totalPixels: data.length / 4,
        normalizedPixels: normalizedCount,
        percentage: ((normalizedCount / (data.length / 4)) * 100).toFixed(2) + '%',
      });

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () =>
      reject(new Error('Failed to load image for color normalization'));
    img.src = base64Image;
  });
}

/**
 * Returns the closest supported Gemini aspect ratio for a cols×rows grid.
 */
export function getBestAspectRatio(cols: number, rows: number): string {
  const targetRatio = cols / rows;

  const supported = [
    { str: '1:1', val: 1.0 },
    { str: '3:4', val: 0.75 },
    { str: '4:3', val: 1.333 },
    { str: '9:16', val: 0.5625 },
    { str: '16:9', val: 1.778 },
  ];

  return supported.reduce((prev, curr) =>
    Math.abs(curr.val - targetRatio) < Math.abs(prev.val - targetRatio)
      ? curr
      : prev
  ).str;
}
