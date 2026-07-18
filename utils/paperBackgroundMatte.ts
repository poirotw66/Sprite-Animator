import { featherAlphaEdge } from './alphaEdgeFeather';

export interface PaperMatteCleanupResult {
  haloPixelsCleared: number;
  crumbPixelsCleared: number;
  tinyArtifactPixelsCleared: number;
  strokePixelsAdded: number;
}

export interface PaperMatteCleanupOptions {
  haloDepth?: number;
  maxCrumbSize?: number;
  maxTinyArtifactSize?: number;
  whiteStrokePx?: number;
  feather?: boolean;
}

const ALPHA_BG = 8;

function isNeutralPaperWhite(r: number, g: number, b: number): boolean {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 218 && max - min <= 20;
}

function isColoredOrDarkInk(r: number, g: number, b: number): boolean {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return (r + g + b) / 3 < 185 || max - min > 38;
}

function touchesTransparent(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
      if (data[(ny * width + nx) * 4 + 3]! <= ALPHA_BG) return true;
    }
  }
  return false;
}

function hasNearbyInk(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const idx = (ny * width + nx) * 4;
      if (data[idx + 3]! <= ALPHA_BG) continue;
      if (isColoredOrDarkInk(data[idx]!, data[idx + 1]!, data[idx + 2]!)) return true;
    }
  }
  return false;
}

/**
 * Remove the thin neutral-white shell baked between paper and dark/coloured ink.
 * Broad white fills are safe because they are not simultaneously exterior-facing
 * and close to ink through the paper side.
 */
export function peelNeutralPaperHalo(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  maxDepth = 2
): number {
  let cleared = 0;
  for (let depth = 0; depth < Math.max(1, maxDepth); depth++) {
    const toClear: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const idx = p * 4;
        if (data[idx + 3]! <= ALPHA_BG) continue;
        if (!isNeutralPaperWhite(data[idx]!, data[idx + 1]!, data[idx + 2]!)) continue;
        if (!touchesTransparent(data, width, height, x, y)) continue;
        if (!hasNearbyInk(data, width, height, x, y, 3)) continue;
        toClear.push(p);
      }
    }
    if (toClear.length === 0) break;
    for (const p of toClear) data[p * 4 + 3] = 0;
    cleared += toClear.length;
  }
  return cleared;
}

/** Remove detached neutral-white dust while preserving dark punctuation and motion lines. */
export function clearDetachedNeutralPaperCrumbs(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  maxCrumbSize = 8
): number {
  const total = width * height;
  const visited = new Uint8Array(total);
  let cleared = 0;

  for (let start = 0; start < total; start++) {
    if (visited[start] || data[start * 4 + 3]! <= ALPHA_BG) continue;
    const component: number[] = [];
    const queue = [start];
    visited[start] = 1;
    let allNeutralWhite = true;
    let head = 0;
    while (head < queue.length) {
      const p = queue[head++]!;
      component.push(p);
      const idx = p * 4;
      if (!isNeutralPaperWhite(data[idx]!, data[idx + 1]!, data[idx + 2]!)) {
        allNeutralWhite = false;
      }
      const x = p % width;
      const y = (p - x) / width;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const np = ny * width + nx;
        if (visited[np] || data[np * 4 + 3]! <= ALPHA_BG) continue;
        visited[np] = 1;
        queue.push(np);
      }
    }
    if (!allNeutralWhite || component.length > maxCrumbSize) continue;
    for (const p of component) data[p * 4 + 3] = 0;
    cleared += component.length;
  }
  return cleared;
}

/** Remove only microscopic detached dust; 8-connectivity keeps diagonal ink together. */
export function clearDetachedTinyArtifacts(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  maxSize = 2
): number {
  if (maxSize <= 0) return 0;
  const total = width * height;
  const visited = new Uint8Array(total);
  let cleared = 0;
  for (let start = 0; start < total; start++) {
    if (visited[start] || data[start * 4 + 3]! <= ALPHA_BG) continue;
    const component: number[] = [];
    const queue = [start];
    visited[start] = 1;
    let head = 0;
    while (head < queue.length) {
      const p = queue[head++]!;
      component.push(p);
      const x = p % width;
      const y = (p - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (visited[np] || data[np * 4 + 3]! <= ALPHA_BG) continue;
          visited[np] = 1;
          queue.push(np);
        }
      }
    }
    if (component.length > maxSize) continue;
    for (const p of component) data[p * 4 + 3] = 0;
    cleared += component.length;
  }
  return cleared;
}

function markExteriorTransparent(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const exterior = new Uint8Array(width * height);
  const queue: number[] = [];
  const seed = (x: number, y: number): void => {
    const p = y * width + x;
    if (exterior[p] || data[p * 4 + 3]! > ALPHA_BG) return;
    exterior[p] = 1;
    queue.push(p);
  };
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }
  let head = 0;
  while (head < queue.length) {
    const p = queue[head++]!;
    const x = p % width;
    const y = (p - x) / width;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      seed(nx, ny);
    }
  }
  return exterior;
}

/** Add a clean, continuous white stroke outside the matte instead of preserving baked halo. */
export function addExteriorWhiteStroke(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  radius = 2
): number {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return 0;
  const exterior = markExteriorTransparent(data, width, height);
  const sourceAlpha = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) sourceAlpha[p] = data[p * 4 + 3]!;
  const toFill: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!exterior[p]) continue;
      let nearForeground = false;
      for (let dy = -r; dy <= r && !nearForeground; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (sourceAlpha[ny * width + nx]! > ALPHA_BG) {
            nearForeground = true;
            break;
          }
        }
      }
      if (nearForeground) toFill.push(p);
    }
  }
  for (const p of toFill) {
    const idx = p * 4;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = 255;
  }
  return toFill.length;
}

function clearTransparentRgb(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): void {
  for (let p = 0; p < width * height; p++) {
    const idx = p * 4;
    if (data[idx + 3]! > ALPHA_BG) continue;
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 0;
  }
}

function restoreInkAlphaAfterFeather(
  data: Uint8ClampedArray | Uint8Array,
  originalAlpha: Uint8Array,
  width: number,
  height: number
): void {
  for (let p = 0; p < width * height; p++) {
    const idx = p * 4;
    if (originalAlpha[p]! <= ALPHA_BG) continue;
    if (!isColoredOrDarkInk(data[idx]!, data[idx + 1]!, data[idx + 2]!)) continue;
    data[idx + 3] = Math.max(data[idx + 3]!, originalAlpha[p]!);
  }
}

/** Clean baked halo, rebuild a continuous white stroke, and create a soft outer edge. */
export function cleanPaperBackgroundMatte(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: PaperMatteCleanupOptions = {}
): PaperMatteCleanupResult {
  const haloPixelsCleared = peelNeutralPaperHalo(data, width, height, options.haloDepth ?? 2);
  const crumbPixelsCleared = clearDetachedNeutralPaperCrumbs(
    data,
    width,
    height,
    options.maxCrumbSize ?? 8
  );
  const tinyArtifactPixelsCleared = clearDetachedTinyArtifacts(
    data,
    width,
    height,
    options.maxTinyArtifactSize ?? 2
  );
  const strokePixelsAdded = addExteriorWhiteStroke(
    data,
    width,
    height,
    options.whiteStrokePx ?? 0
  );
  if (options.feather !== false) {
    const originalAlpha = new Uint8Array(width * height);
    for (let p = 0; p < width * height; p++) originalAlpha[p] = data[p * 4 + 3]!;
    featherAlphaEdge(data, width, height, { erodePx: 0, blurRadiusPx: 1 });
    // One-pixel ink, punctuation, whiskers, and motion lines must not fade just
    // because every pixel in the stroke touches transparency.
    restoreInkAlphaAfterFeather(data, originalAlpha, width, height);
  }
  clearTransparentRgb(data, width, height);
  return {
    haloPixelsCleared,
    crumbPixelsCleared,
    tinyArtifactPixelsCleared,
    strokePixelsAdded,
  };
}
