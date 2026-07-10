/**
 * agent-sprite-forge style chroma key: RGB distance hard key + border flood fill.
 * Ported from https://github.com/0x0funky/agent-sprite-forge remove_bg_magenta.
 */

export interface ChromaKeyForgeOptions {
  threshold?: number;
  edgeThreshold?: number;
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  key: { r: number; g: number; b: number }
): number {
  return Math.sqrt((r - key.r) ** 2 + (g - key.g) ** 2 + (b - key.b) ** 2);
}

/**
 * Remove chroma background in place (hard alpha, no despill).
 * Mutates `data` and returns the same buffer.
 */
export function processChromaKeyForge(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  chromaKey: { r: number; g: number; b: number },
  options: ChromaKeyForgeOptions = {}
): Uint8ClampedArray {
  const threshold = options.threshold ?? 100;
  const edgeThreshold = options.edgeThreshold ?? 150;
  const totalPixels = width * height;
  const dist = (r: number, g: number, b: number): number =>
    colorDistance(r, g, b, chromaKey);

  for (let p = 0; p < totalPixels; p++) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    if (dist(data[i]!, data[i + 1]!, data[i + 2]!) < threshold) {
      data[i + 3] = 0;
    }
  }

  const visited = new Uint8Array(totalPixels);
  const queue: number[] = [];

  const push = (x: number, y: number): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    queue.push(p);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const p = queue[head++]!;
    const x = p % width;
    const y = (p - x) / width;
    const i = p * 4;
    const a = data[i + 3]!;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;

    if (a === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          push(x + dx, y + dy);
        }
      }
      continue;
    }

    if (dist(r, g, b) < edgeThreshold) {
      data[i + 3] = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          push(x + dx, y + dy);
        }
      }
    }
  }

  return data;
}
