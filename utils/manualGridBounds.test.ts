import { describe, expect, it } from 'vitest';
import {
  buildEmptyManualBounds,
  buildEqualManualBounds,
  cellRectsFromBounds,
  insertManualLine,
  moveManualLine,
  removeNearestManualLine,
} from './manualGridBounds';

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
});
