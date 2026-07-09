import { isChromaLike, type RgbColor } from './chromaSimilarity';

/**
 * Resolve whether to use the guided (simplified) chroma path.
 * guided === true/false wins; undefined → light auto-detect.
 */
export function shouldUseGuidedChromaPath(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  key: RgbColor,
  guided: boolean | undefined
): boolean {
  if (guided === true) return true;
  if (guided === false) return false;

  // Auto: corners + mid-edge samples mostly chroma-like
  const samples: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];
  let like = 0;
  for (const [x, y] of samples) {
    const i = (y * width + x) * 4;
    if (isChromaLike(data[i]!, data[i + 1]!, data[i + 2]!, key, 'key')) like++;
  }
  if (like < 6) return false;

  const step = Math.max(1, Math.floor(Math.min(width, height) / 16));

  // Continuous vertical mid-seam band (gutter heuristic)
  const mx = Math.floor(width / 2);
  let vSeam = 0;
  for (let y = 0; y < height; y += step) {
    const i = (y * width + mx) * 4;
    if (isChromaLike(data[i]!, data[i + 1]!, data[i + 2]!, key, 'normalize')) vSeam++;
  }
  if (vSeam < 10) return false;

  // Continuous horizontal mid-seam band
  const my = Math.floor(height / 2);
  let hSeam = 0;
  for (let x = 0; x < width; x += step) {
    const i = (my * width + x) * 4;
    if (isChromaLike(data[i]!, data[i + 1]!, data[i + 2]!, key, 'normalize')) hSeam++;
  }
  if (hSeam < 10) return false;

  // Subject evidence: at least 2 of 4 cell-center samples must not be chroma-like
  const cellSamples: Array<[number, number]> = [
    [Math.floor(width * 0.25), Math.floor(height * 0.25)],
    [Math.floor(width * 0.75), Math.floor(height * 0.25)],
    [Math.floor(width * 0.25), Math.floor(height * 0.75)],
    [Math.floor(width * 0.75), Math.floor(height * 0.75)],
  ];
  let notChroma = 0;
  for (const [x, y] of cellSamples) {
    const i = (y * width + x) * 4;
    if (!isChromaLike(data[i]!, data[i + 1]!, data[i + 2]!, key, 'key')) notChroma++;
  }
  return notChroma >= 2;
}
