import type { AutoSliceCandidate } from './types';

const ORDERED_SHIFT_WINDOW = [0, -1, 1, -2, 2] as const;

export interface GridHypothesisSeed {
  shiftX?: number;
  shiftY?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

function createCandidate(
  cols: number,
  rows: number,
  shiftX: number,
  shiftY: number,
  seed: GridHypothesisSeed
): AutoSliceCandidate {
  return {
    cols,
    rows,
    shiftX,
    shiftY,
    paddingLeft: seed.paddingLeft ?? 0,
    paddingRight: seed.paddingRight ?? 0,
    paddingTop: seed.paddingTop ?? 0,
    paddingBottom: seed.paddingBottom ?? 0,
  };
}

export function buildGridHypotheses(
  cols: number,
  rows: number,
  seed: GridHypothesisSeed = {}
): AutoSliceCandidate[] {
  const candidates: AutoSliceCandidate[] = [];
  const baseShiftX = seed.shiftX ?? 0;
  const baseShiftY = seed.shiftY ?? 0;

  for (const deltaShiftX of ORDERED_SHIFT_WINDOW) {
    for (const deltaShiftY of ORDERED_SHIFT_WINDOW) {
      candidates.push(
        createCandidate(cols, rows, baseShiftX + deltaShiftX, baseShiftY + deltaShiftY, seed)
      );
    }
  }

  return candidates;
}
