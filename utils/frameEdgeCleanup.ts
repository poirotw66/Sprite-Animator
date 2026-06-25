/**
 * Post-slice safety net for LINE sticker frames: erase residual cell-boundary
 * line fragments that survived the slice inset and still touch a frame edge.
 *
 * After chroma-key removal the background is transparent, so any opaque pixels
 * hugging the frame border are leftover divider/seam artifacts (the subject is
 * centered with margin thanks to the inset). We BFS inward from edge-touching
 * opaque pixels and clear them, bounded by maxDepthPx so a subject that happens
 * to reach near an edge can only be eroded by a few pixels at most.
 *
 * Pure function over RGBA bytes (no DOM) so it is unit-testable.
 */

export interface EdgeCleanupOptions {
  /** Max BFS penetration (in px) from the edge. Caps worst-case subject erosion. */
  maxDepthPx: number;
  /** Pixels with alpha <= this are treated as background (not erased, block the flood). Default 24. */
  alphaThreshold?: number;
}

/**
 * Mutates `data` (RGBA, length width*height*4): clears edge-connected opaque
 * residue within maxDepthPx. Returns the number of pixels cleared.
 */
export function clearEdgeConnectedResidue(
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  options: EdgeCleanupOptions
): number {
  const maxDepth = Math.max(1, Math.floor(options.maxDepthPx));
  const alphaThreshold = options.alphaThreshold ?? 24;
  if (width <= 0 || height <= 0) return 0;

  const total = width * height;
  const visited = new Uint8Array(total);
  // Ring buffer style queues of pixel indices, processed by BFS depth layers.
  let frontier: number[] = [];
  let cleared = 0;

  const isOpaque = (p: number) => data[p * 4 + 3] > alphaThreshold;
  const erase = (p: number) => {
    data[p * 4 + 3] = 0;
    cleared++;
  };

  // Seed: opaque pixels on any border.
  const seed = (x: number, y: number) => {
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isOpaque(p)) {
      erase(p);
      frontier.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }

  // BFS inward, one depth layer per iteration, stopping at maxDepth.
  for (let depth = 1; depth < maxDepth && frontier.length > 0; depth++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % width;
      const y = (p - x) / width;
      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ];
      for (const np of neighbors) {
        if (np < 0 || visited[np]) continue;
        visited[np] = 1;
        if (isOpaque(np)) {
          erase(np);
          next.push(np);
        }
      }
    }
    frontier = next;
  }

  return cleared;
}
