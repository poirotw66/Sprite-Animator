import type { ChromaKeyColorType } from '../types';

export type RequestedChromaKeyColor = ChromaKeyColorType | 'auto';

export interface ChromaReferenceImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ChromaConflictScore {
  green: number;
  magenta: number;
  sampledPixels: number;
}

export interface ChromaSelectionResult extends ChromaConflictScore {
  color: ChromaKeyColorType;
  requested: RequestedChromaKeyColor;
}

function pixelConflict(r: number, g: number, b: number): { green: number; magenta: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max > 0 ? (max - min) / max : 0;
  if (saturation < 0.16) return { green: 0, magenta: 0 };

  // Dominance scores intentionally ignore neutral white/gray/black artwork.
  const greenDominance = Math.max(0, g - Math.max(r, b));
  const magentaDominance = Math.max(0, Math.min(r, b) - g);
  return {
    green: greenDominance >= 20 ? (greenDominance / 255) * saturation : 0,
    magenta: magentaDominance >= 20 ? (magentaDominance / 255) * saturation : 0,
  };
}

/** Measure how much character/reference artwork conflicts with each chroma key. */
export function measureChromaConflicts(
  images: readonly ChromaReferenceImage[]
): ChromaConflictScore {
  let green = 0;
  let magenta = 0;
  let sampledPixels = 0;

  for (const image of images) {
    const pixelCount = image.width * image.height;
    const stride = Math.max(1, Math.ceil(Math.sqrt(pixelCount / 120_000)));
    for (let y = 0; y < image.height; y += stride) {
      for (let x = 0; x < image.width; x += stride) {
        const i = (y * image.width + x) * 4;
        const a = image.data[i + 3] ?? 255;
        if (a < 64) continue;
        const conflict = pixelConflict(
          image.data[i] ?? 0,
          image.data[i + 1] ?? 0,
          image.data[i + 2] ?? 0
        );
        green += conflict.green;
        magenta += conflict.magenta;
        sampledPixels++;
      }
    }
  }

  if (sampledPixels === 0) return { green: 0, magenta: 0, sampledPixels: 0 };
  return {
    green: green / sampledPixels,
    magenta: magenta / sampledPixels,
    sampledPixels,
  };
}

/** Resolve `auto` to the less-conflicting chroma; explicit colors are preserved. */
export function selectChromaKeyColor(
  requested: RequestedChromaKeyColor,
  images: readonly ChromaReferenceImage[]
): ChromaSelectionResult {
  if (requested !== 'auto' && requested !== 'green' && requested !== 'magenta') {
    throw new Error(`Invalid chromaKeyColor: ${String(requested)}`);
  }
  const score = measureChromaConflicts(images);
  const color =
    requested === 'auto'
      ? score.green <= score.magenta
        ? 'green'
        : 'magenta'
      : requested;
  return { requested, color, ...score };
}

/** Detect the dominant chroma on a generated sheet border for legacy `auto` configs. */
export function detectSheetChromaKeyColor(image: ChromaReferenceImage): ChromaKeyColorType {
  const border = Math.max(1, Math.round(Math.min(image.width, image.height) * 0.025));
  let green = 0;
  let magenta = 0;
  let sampled = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (x >= border && x < image.width - border && y >= border && y < image.height - border) {
        continue;
      }
      const i = (y * image.width + x) * 4;
      if ((image.data[i + 3] ?? 255) < 64) continue;
      const conflict = pixelConflict(
        image.data[i] ?? 0,
        image.data[i + 1] ?? 0,
        image.data[i + 2] ?? 0
      );
      green += conflict.green;
      magenta += conflict.magenta;
      sampled++;
    }
  }
  if (sampled === 0) return 'green';
  return magenta > green ? 'magenta' : 'green';
}
