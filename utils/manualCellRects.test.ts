import { describe, expect, it } from 'vitest';
import {
  applyResizeHandle,
  clampCellRect,
  clearRectsSliceMode,
  enterRectsSliceMode,
  hitTestCellRect,
  moveCellRect,
  normalizeDragRect,
} from './manualCellRects';
import { CellRectHistory } from './cellRectHistory';

describe('manualCellRects', () => {
  it('normalizes drag into a positive clamped rect', () => {
    const rect = normalizeDragRect(120, 80, 20, 30, 200, 150);
    expect(rect).toEqual({ x: 20, y: 30, width: 100, height: 50 });
  });

  it('rejects tiny drags', () => {
    expect(normalizeDragRect(10, 10, 12, 12, 100, 100)).toBeNull();
  });

  it('clamps and moves within sheet', () => {
    const moved = moveCellRect({ x: 90, y: 90, width: 40, height: 40 }, 50, 50, 100, 100);
    expect(moved.x + moved.width).toBeLessThanOrEqual(100);
    expect(moved.y + moved.height).toBeLessThanOrEqual(100);
  });

  it('hit-tests topmost rect', () => {
    const rects = [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 20, y: 20, width: 50, height: 50 },
    ];
    expect(hitTestCellRect(rects, 25, 25)).toBe(1);
    expect(hitTestCellRect(rects, 5, 5)).toBe(0);
  });

  it('resizes from SE handle', () => {
    const resized = applyResizeHandle(
      { x: 10, y: 10, width: 40, height: 40 },
      'se',
      80,
      70,
      200,
      200
    );
    expect(resized.width).toBe(70);
    expect(resized.height).toBe(60);
  });

  it('enterRectsSliceMode starts empty list', () => {
    const next = enterRectsSliceMode({
      cols: 4,
      rows: 5,
      paddingX: 0,
      paddingY: 0,
      shiftX: 0,
      shiftY: 0,
    });
    expect(next.sliceMode).toBe('rects');
    expect(next.inferredCellRects).toEqual([]);
    expect(clearRectsSliceMode(next).inferredCellRects).toEqual([]);
  });

  it('clamp keeps minimum size', () => {
    const clamped = clampCellRect({ x: 0, y: 0, width: 2, height: 2 }, 100, 100);
    expect(clamped.width).toBeGreaterThanOrEqual(8);
    expect(clamped.height).toBeGreaterThanOrEqual(8);
  });
});

describe('CellRectHistory', () => {
  it('undoes and redoes rect lists', () => {
    const history = new CellRectHistory(5);
    const a = [{ x: 0, y: 0, width: 20, height: 20 }];
    const b = [
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 30, y: 30, width: 20, height: 20 },
    ];
    history.push(a);
    const undone = history.undo(b);
    expect(undone).toEqual(a);
    const redone = history.redo(a!);
    expect(redone).toEqual(b);
  });
});
