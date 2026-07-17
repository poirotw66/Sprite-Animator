/**
 * Manual divider-line bounds for user-drawn sprite sheet slicing.
 * Bounds are inclusive edge lists: [0, ..., sheetSize], sorted ascending.
 */

export interface ManualGridBounds {
  xBounds: number[];
  yBounds: number[];
}

export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Only outer edges — no interior cuts (1×1 cell covering the sheet). */
export function buildEmptyManualBounds(
  sheetWidth: number,
  sheetHeight: number
): ManualGridBounds {
  const w = Math.max(1, Math.round(sheetWidth));
  const h = Math.max(1, Math.round(sheetHeight));
  return { xBounds: [0, w], yBounds: [0, h] };
}

/** Equal cols×rows bounds covering the full sheet. */
export function buildEqualManualBounds(
  sheetWidth: number,
  sheetHeight: number,
  cols: number,
  rows: number
): ManualGridBounds {
  const safeCols = Math.max(1, Math.floor(cols));
  const safeRows = Math.max(1, Math.floor(rows));
  const xBounds = Array.from({ length: safeCols + 1 }, (_, i) =>
    Math.round((i * sheetWidth) / safeCols)
  );
  const yBounds = Array.from({ length: safeRows + 1 }, (_, i) =>
    Math.round((i * sheetHeight) / safeRows)
  );
  xBounds[safeCols] = sheetWidth;
  yBounds[safeRows] = sheetHeight;
  return { xBounds, yBounds };
}

export function sanitizeBounds(bounds: number[], sheetSize: number): number[] {
  const size = Math.max(1, Math.round(sheetSize));
  const unique = [...new Set(bounds.map((v) => Math.round(v)))]
    .filter((v) => v > 0 && v < size)
    .sort((a, b) => a - b);
  return [0, ...unique, size];
}

export function cellRectsFromBounds(xBounds: number[], yBounds: number[]): CellRect[] {
  const sheetW = Math.max(1, xBounds[xBounds.length - 1] ?? 1);
  const sheetH = Math.max(1, yBounds[yBounds.length - 1] ?? 1);
  const xClean = sanitizeBounds(xBounds, sheetW);
  const yClean = sanitizeBounds(yBounds, sheetH);
  const rects: CellRect[] = [];
  for (let r = 0; r < yClean.length - 1; r++) {
    for (let c = 0; c < xClean.length - 1; c++) {
      const x0 = xClean[c]!;
      const x1 = xClean[c + 1]!;
      const y0 = yClean[r]!;
      const y1 = yClean[r + 1]!;
      rects.push({
        x: x0,
        y: y0,
        width: Math.max(1, x1 - x0),
        height: Math.max(1, y1 - y0),
      });
    }
  }
  return rects;
}

/** Insert a vertical (x) or horizontal (y) divider; returns new bounds. */
export function insertManualLine(
  bounds: ManualGridBounds,
  axis: 'x' | 'y',
  position: number,
  sheetWidth: number,
  sheetHeight: number,
  minGapPx = 8
): ManualGridBounds {
  const next = {
    xBounds: [...bounds.xBounds],
    yBounds: [...bounds.yBounds],
  };
  if (axis === 'x') {
    const x = Math.round(position);
    const cleaned = sanitizeBounds([...next.xBounds, x], sheetWidth);
    // reject if too close to neighbors (sanitize already unique; check gap)
    for (let i = 1; i < cleaned.length; i++) {
      if (cleaned[i]! - cleaned[i - 1]! < minGapPx) {
        return bounds;
      }
    }
    next.xBounds = cleaned;
  } else {
    const y = Math.round(position);
    const cleaned = sanitizeBounds([...next.yBounds, y], sheetHeight);
    for (let i = 1; i < cleaned.length; i++) {
      if (cleaned[i]! - cleaned[i - 1]! < minGapPx) {
        return bounds;
      }
    }
    next.yBounds = cleaned;
  }
  return next;
}

/** Move an interior bound (index 1..n-2) to a new position; clamp between neighbors. */
export function moveManualLine(
  bounds: ManualGridBounds,
  axis: 'x' | 'y',
  index: number,
  position: number,
  minGapPx = 8
): ManualGridBounds {
  const list = axis === 'x' ? [...bounds.xBounds] : [...bounds.yBounds];
  if (index <= 0 || index >= list.length - 1) return bounds;
  const lo = list[index - 1]! + minGapPx;
  const hi = list[index + 1]! - minGapPx;
  if (hi <= lo) return bounds;
  list[index] = Math.max(lo, Math.min(hi, Math.round(position)));
  return axis === 'x'
    ? { xBounds: list, yBounds: bounds.yBounds }
    : { xBounds: bounds.xBounds, yBounds: list };
}

/** Remove interior bound nearest to position (within threshold). */
export function removeNearestManualLine(
  bounds: ManualGridBounds,
  axis: 'x' | 'y',
  position: number,
  thresholdPx = 12
): ManualGridBounds {
  const list = axis === 'x' ? bounds.xBounds : bounds.yBounds;
  let bestIndex = -1;
  let bestDist = Infinity;
  for (let i = 1; i < list.length - 1; i++) {
    const d = Math.abs(list[i]! - position);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  if (bestIndex < 0 || bestDist > thresholdPx) return bounds;
  const next = list.filter((_, i) => i !== bestIndex);
  return axis === 'x'
    ? { xBounds: next, yBounds: bounds.yBounds }
    : { xBounds: bounds.xBounds, yBounds: next };
}

export function findNearestInteriorLine(
  bounds: number[],
  position: number,
  thresholdPx = 10
): number | null {
  let bestIndex: number | null = null;
  let bestDist = Infinity;
  for (let i = 1; i < bounds.length - 1; i++) {
    const d = Math.abs(bounds[i]! - position);
    if (d < bestDist && d <= thresholdPx) {
      bestDist = d;
      bestIndex = i;
    }
  }
  return bestIndex;
}
