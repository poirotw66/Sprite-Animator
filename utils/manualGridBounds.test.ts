import { describe, expect, it } from 'vitest';
import {
  buildEmptyManualBounds,
  buildEqualManualBounds,
  cellRectsFromBounds,
  equalSnapCandidates,
  insertManualLine,
  moveManualLine,
  removeNearestManualLine,
  snapPosition,
} from './manualGridBounds';
import { ManualBoundsHistory } from './manualBoundsHistory';
import { enterManualSliceMode, enableManualSliceMode } from './manualSliceMode';

describe('manualGridBounds', () => {
  it('builds empty bounds with no interior cuts', () => {
    const { xBounds, yBounds } = buildEmptyManualBounds(400, 500);
    expect(xBounds).toEqual([0, 400]);
    expect(yBounds).toEqual([0, 500]);
    expect(cellRectsFromBounds(xBounds, yBounds)).toHaveLength(1);
  });

  it('builds equal 4x5 bounds', () => {
    const { xBounds, yBounds } = buildEqualManualBounds(400, 500, 4, 5);
    expect(xBounds).toEqual([0, 100, 200, 300, 400]);
    expect(yBounds).toEqual([0, 100, 200, 300, 400, 500]);
    expect(cellRectsFromBounds(xBounds, yBounds)).toHaveLength(20);
  });

  it('inserts and removes an interior vertical line', () => {
    let bounds = buildEqualManualBounds(300, 200, 2, 1);
    bounds = insertManualLine(bounds, 'x', 100, 300, 200);
    expect(bounds.xBounds).toEqual([0, 100, 150, 300]);
    bounds = removeNearestManualLine(bounds, 'x', 100);
    expect(bounds.xBounds).toEqual([0, 150, 300]);
  });

  it('moves a line without crossing neighbors', () => {
    const bounds = buildEqualManualBounds(300, 100, 3, 1);
    const moved = moveManualLine(bounds, 'x', 1, 200);
    expect(moved.xBounds[1]).toBeLessThan(moved.xBounds[2]!);
    expect(moved.xBounds[1]).toBeGreaterThan(moved.xBounds[0]!);
  });

  it('snaps near equal candidates', () => {
    const candidates = equalSnapCandidates(400, 4);
    expect(candidates).toEqual([100, 200, 300]);
    expect(snapPosition(102, candidates, 5)).toBe(100);
    expect(snapPosition(150, candidates, 5)).toBe(150);
  });
});

describe('manualSliceMode', () => {
  it('enterManualSliceMode seeds equal dividers from cols×rows', () => {
    const next = enterManualSliceMode(
      {
        cols: 4,
        rows: 5,
        paddingX: 0,
        paddingY: 0,
        shiftX: 0,
        shiftY: 0,
      },
      400,
      500
    );
    expect(next.sliceMode).toBe('manual');
    expect(next.manualXBounds).toEqual([0, 100, 200, 300, 400]);
    expect(next.manualYBounds).toEqual([0, 100, 200, 300, 400, 500]);
    expect(next.cols).toBe(4);
    expect(next.rows).toBe(5);
  });

  it('enableManualSliceMode clears interior lines', () => {
    const next = enableManualSliceMode(
      {
        cols: 4,
        rows: 5,
        paddingX: 0,
        paddingY: 0,
        shiftX: 0,
        shiftY: 0,
      },
      400,
      500
    );
    expect(next.cols).toBe(1);
    expect(next.rows).toBe(1);
    expect(next.manualXBounds).toEqual([0, 400]);
  });
});

describe('ManualBoundsHistory', () => {
  it('undoes and redoes bound snapshots', () => {
    const history = new ManualBoundsHistory(5);
    const a = buildEqualManualBounds(100, 100, 2, 2);
    const b = insertManualLine(a, 'x', 25, 100, 100);
    history.push(a);
    expect(history.canUndo).toBe(true);
    const undone = history.undo(b);
    expect(undone).toEqual(a);
    expect(history.canRedo).toBe(true);
    const redone = history.redo(a!);
    expect(redone).toEqual(b);
  });
});
