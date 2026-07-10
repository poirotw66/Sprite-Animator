import { isStickerStrokeFringe, isStickerStrokeWhite, shouldPreserveStickerStroke } from './stickerStrokeWhite';

const DEFAULT_ALPHA_THRESHOLD = 24;

function readAlpha(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return data[(y * width + x) * 4 + 3]!;
}

function touchesTransparent(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  p: number,
  alphaThreshold: number = DEFAULT_ALPHA_THRESHOLD
): boolean {
  const x = p % width;
  const y = (p - x) / width;
  return (
    readAlpha(data, width, height, x - 1, y) <= alphaThreshold ||
    readAlpha(data, width, height, x + 1, y) <= alphaThreshold ||
    readAlpha(data, width, height, x, y - 1) <= alphaThreshold ||
    readAlpha(data, width, height, x, y + 1) <= alphaThreshold
  );
}

/**
 * Keep exterior stroke RGB pure white while preserving partial alpha from anti-alias.
 */
export function whitenExteriorStrokeRgb(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): void {
  const alphaThreshold = DEFAULT_ALPHA_THRESHOLD;
  const total = width * height;
  for (let p = 0; p < total; p++) {
    const idx = p * 4;
    if (data[idx + 3]! <= alphaThreshold) continue;
    if (!touchesTransparent(data, width, height, p, alphaThreshold)) continue;
    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    if (!shouldPreserveStickerStroke(r, g, b)) continue;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
  }
}

/**
 * Whitewash only the exterior sticker halo (stroke + JPEG fringe), not shirt interior.
 * Mutates RGBA in place.
 */
export function repairExteriorStrokeHalo(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  expandPx: number = 1
): void {
  const alphaThreshold = DEFAULT_ALPHA_THRESHOLD;
  const total = width * height;
  const exteriorStroke = new Uint8Array(total);

  for (let p = 0; p < total; p++) {
    if (readAlpha(data, width, height, p % width, (p - (p % width)) / width) <= alphaThreshold) continue;
    if (!touchesTransparent(data, width, height, p, alphaThreshold)) continue;
    const idx = p * 4;
    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    if (!isStickerStrokeWhite(r, g, b) && !isStickerStrokeFringe(r, g, b)) continue;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = 255;
    exteriorStroke[p] = 1;
  }

  const r = Math.max(0, Math.floor(expandPx));
  if (r === 0) return;

  const toFill: number[] = [];
  for (let p = 0; p < total; p++) {
    if (!exteriorStroke[p]) continue;
    const x = p % width;
    const y = (p - x) / width;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const np = ny * width + nx;
        if (readAlpha(data, width, height, nx, ny) > alphaThreshold) continue;
        toFill.push(np);
      }
    }
  }

  for (const p of toFill) {
    const idx = p * 4;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = 255;
  }
}

/**
 * Remove tiny disconnected stroke-white crumbs outside the main subject.
 */
export function clearDetachedStrokeCrumbs(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  maxCrumbSize: number = 80
): number {
  const alphaThreshold = DEFAULT_ALPHA_THRESHOLD;
  const total = width * height;
  const visited = new Uint8Array(total);
  const components: number[][] = [];

  const isOpaque = (p: number) => data[p * 4 + 3]! > alphaThreshold;

  for (let start = 0; start < total; start++) {
    if (!isOpaque(start) || visited[start]) continue;
    const island: number[] = [];
    const queue = [start];
    visited[start] = 1;
    let head = 0;
    while (head < queue.length) {
      const p = queue[head++]!;
      island.push(p);
      const x = p % width;
      const y = (p - x) / width;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const np = ny * width + nx;
        if (!isOpaque(np) || visited[np]) continue;
        visited[np] = 1;
        queue.push(np);
      }
    }
    components.push(island);
  }

  if (components.length <= 1) return 0;

  components.sort((a, b) => b.length - a.length);
  let cleared = 0;
  for (let i = 1; i < components.length; i++) {
    const island = components[i]!;
    if (island.length > maxCrumbSize) continue;
    const allStroke = island.every((p) => {
      const idx = p * 4;
      return isStickerStrokeWhite(data[idx]!, data[idx + 1]!, data[idx + 2]!);
    });
    if (!allStroke) continue;
    for (const p of island) {
      data[p * 4 + 3] = 0;
      cleared++;
    }
  }
  return cleared;
}
