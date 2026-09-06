/**
 * Bounded undo/redo stack for manual cell-rect marquee edits.
 */
import {
  cellRectsEqual,
  cloneCellRects,
  type CellRect,
} from './manualCellRects';

const DEFAULT_LIMIT = 30;

export class CellRectHistory {
  private undoStack: CellRect[][] = [];
  private redoStack: CellRect[][] = [];
  private readonly limit: number;

  constructor(limit = DEFAULT_LIMIT) {
    this.limit = Math.max(1, limit);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /** Record `current` before applying a new edit. */
  push(current: CellRect[]): void {
    const snapshot = cloneCellRects(current);
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && cellRectsEqual(last, snapshot)) return;
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(current: CellRect[]): CellRect[] | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(cloneCellRects(current));
    return prev;
  }

  redo(current: CellRect[]): CellRect[] | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(cloneCellRects(current));
    return next;
  }
}
