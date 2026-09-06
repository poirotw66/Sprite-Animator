/**
 * Bounded undo/redo stack for manual slice bounds edits.
 */
import type { ManualGridBounds } from './manualGridBounds';

const DEFAULT_LIMIT = 30;

function cloneBounds(bounds: ManualGridBounds): ManualGridBounds {
  return {
    xBounds: [...bounds.xBounds],
    yBounds: [...bounds.yBounds],
  };
}

function boundsEqual(a: ManualGridBounds, b: ManualGridBounds): boolean {
  if (a.xBounds.length !== b.xBounds.length || a.yBounds.length !== b.yBounds.length) {
    return false;
  }
  for (let i = 0; i < a.xBounds.length; i++) {
    if (a.xBounds[i] !== b.xBounds[i]) return false;
  }
  for (let i = 0; i < a.yBounds.length; i++) {
    if (a.yBounds[i] !== b.yBounds[i]) return false;
  }
  return true;
}

export class ManualBoundsHistory {
  private undoStack: ManualGridBounds[] = [];
  private redoStack: ManualGridBounds[] = [];
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
  push(current: ManualGridBounds): void {
    const snapshot = cloneBounds(current);
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && boundsEqual(last, snapshot)) return;
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(current: ManualGridBounds): ManualGridBounds | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(cloneBounds(current));
    return prev;
  }

  redo(current: ManualGridBounds): ManualGridBounds | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(cloneBounds(current));
    return next;
  }
}
