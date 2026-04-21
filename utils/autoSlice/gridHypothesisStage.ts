import type { AutoSliceCandidate } from './types';

const ORDERED_SHIFT_WINDOW = [0, -1, 1, -2, 2] as const;

function createCandidate(cols: number, rows: number, shiftX: number, shiftY: number): AutoSliceCandidate {
  return {
    cols,
    rows,
    shiftX,
    shiftY,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
  };
}

export function buildGridHypotheses(cols: number, rows: number): AutoSliceCandidate[] {
  const candidates: AutoSliceCandidate[] = [];

  for (const shiftX of ORDERED_SHIFT_WINDOW) {
    for (const shiftY of ORDERED_SHIFT_WINDOW) {
      candidates.push(createCandidate(cols, rows, shiftX, shiftY));
    }
  }

  return candidates;
}
