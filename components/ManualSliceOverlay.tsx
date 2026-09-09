/**
 * SVG overlay for user-drawn slice dividers (vertical / horizontal cut lines).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SliceSettings } from '../utils/imageUtils';
import {
  buildEmptyManualBounds,
  cellRectsFromBounds,
  equalSnapCandidates,
  findNearestInteriorLine,
  insertManualLine,
  moveManualLine,
  removeNearestManualLine,
  snapPosition,
  type ManualGridBounds,
} from '../utils/manualGridBounds';
import { ManualBoundsHistory } from '../utils/manualBoundsHistory';

/** Tool for draw-line slicing: add vertical, add horizontal, or delete. */
export type DrawLineTool = 'vertical' | 'horizontal' | 'delete';

/** @deprecated use DrawLineTool */
export type DrawLineAxis = 'x' | 'y';

export interface ManualSliceHistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

interface ManualSliceOverlayProps {
  sheetWidth: number;
  sheetHeight: number;
  sliceSettings: SliceSettings;
  setSliceSettings: React.Dispatch<React.SetStateAction<SliceSettings>>;
  drawTool: DrawLineTool;
  onDrawToolChange?: (tool: DrawLineTool) => void;
  hint: string;
  onHistoryStateChange?: (state: ManualSliceHistoryState) => void;
  /** Imperative undo/redo registration for parent toolbars. */
  historyApiRef?: React.MutableRefObject<{
    undo: () => void;
    redo: () => void;
  } | null>;
}

function ensureManualBounds(
  settings: SliceSettings,
  sheetWidth: number,
  sheetHeight: number
): ManualGridBounds {
  if (
    settings.manualXBounds &&
    settings.manualYBounds &&
    settings.manualXBounds.length >= 2 &&
    settings.manualYBounds.length >= 2
  ) {
    return { xBounds: settings.manualXBounds, yBounds: settings.manualYBounds };
  }
  return buildEmptyManualBounds(sheetWidth, sheetHeight);
}

function findNearestLineAnyAxis(
  bounds: ManualGridBounds,
  x: number,
  y: number,
  thresholdPx: number
): { axis: 'x' | 'y'; index: number } | null {
  const nearV = findNearestInteriorLine(bounds.xBounds, x, thresholdPx);
  const nearH = findNearestInteriorLine(bounds.yBounds, y, thresholdPx);
  if (nearV == null && nearH == null) return null;
  if (nearV != null && nearH == null) return { axis: 'x', index: nearV };
  if (nearH != null && nearV == null) return { axis: 'y', index: nearH };
  const distV = Math.abs(bounds.xBounds[nearV!]! - x);
  const distH = Math.abs(bounds.yBounds[nearH!]! - y);
  return distV <= distH
    ? { axis: 'x', index: nearV! }
    : { axis: 'y', index: nearH! };
}

export const ManualSliceOverlay: React.FC<ManualSliceOverlayProps> = ({
  sheetWidth,
  sheetHeight,
  sliceSettings,
  setSliceSettings,
  drawTool,
  onDrawToolChange,
  hint,
  onHistoryStateChange,
  historyApiRef,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const historyRef = useRef(new ManualBoundsHistory(30));
  const dragStartBoundsRef = useRef<ManualGridBounds | null>(null);
  const [dragging, setDragging] = useState<{ axis: 'x' | 'y'; index: number } | null>(
    null
  );
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [snapDisabled, setSnapDisabled] = useState(false);

  const bounds = useMemo(
    () => ensureManualBounds(sliceSettings, sheetWidth, sheetHeight),
    [sliceSettings, sheetWidth, sheetHeight]
  );

  const rects = useMemo(
    () => cellRectsFromBounds(bounds.xBounds, bounds.yBounds),
    [bounds]
  );

  const emitHistoryState = useCallback(() => {
    onHistoryStateChange?.({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    });
  }, [onHistoryStateChange]);

  const applyHistoryBounds = useCallback(
    (next: ManualGridBounds) => {
      setSliceSettings((prev) => ({
        ...prev,
        sliceMode: 'manual',
        manualXBounds: next.xBounds,
        manualYBounds: next.yBounds,
        cols: Math.max(1, next.xBounds.length - 1),
        rows: Math.max(1, next.yBounds.length - 1),
      }));
      queueMicrotask(() => emitHistoryState());
    },
    [emitHistoryState, setSliceSettings]
  );

  const commitBounds = useCallback(
    (next: ManualGridBounds, recordHistory = true) => {
      if (recordHistory) {
        historyRef.current.push(bounds);
      }
      setSliceSettings((prev) => ({
        ...prev,
        sliceMode: 'manual',
        manualXBounds: next.xBounds,
        manualYBounds: next.yBounds,
        cols: Math.max(1, next.xBounds.length - 1),
        rows: Math.max(1, next.yBounds.length - 1),
      }));
      queueMicrotask(() => emitHistoryState());
    },
    [bounds, emitHistoryState, setSliceSettings]
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.undo(bounds);
    if (prev) applyHistoryBounds(prev);
  }, [applyHistoryBounds, bounds]);

  const redo = useCallback(() => {
    const next = historyRef.current.redo(bounds);
    if (next) applyHistoryBounds(next);
  }, [applyHistoryBounds, bounds]);

  useEffect(() => {
    if (historyApiRef) {
      historyApiRef.current = { undo, redo };
    }
    return () => {
      if (historyApiRef) historyApiRef.current = null;
    };
  }, [historyApiRef, redo, undo]);

  useEffect(() => {
    emitHistoryState();
  }, [emitHistoryState, bounds]);

  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    return {
      x: ((clientX - rect.left) / rect.width) * viewBox.width,
      y: ((clientY - rect.top) / rect.height) * viewBox.height,
    };
  }, []);

  const snapAxisPosition = useCallback(
    (axis: 'x' | 'y', position: number, disableSnap: boolean) => {
      if (disableSnap) return Math.round(position);
      const cellCount = axis === 'x' ? bounds.xBounds.length - 1 : bounds.yBounds.length - 1;
      const sheetSize = axis === 'x' ? sheetWidth : sheetHeight;
      const candidates = equalSnapCandidates(sheetSize, Math.max(cellCount, 2));
      return snapPosition(position, candidates, 5);
    },
    [bounds.xBounds.length, bounds.yBounds.length, sheetHeight, sheetWidth]
  );

  const cursor =
    drawTool === 'delete'
      ? 'pointer'
      : drawTool === 'vertical'
        ? 'col-resize'
        : 'row-resize';

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.preventDefault();
      svgRef.current?.focus();
      const { x, y } = screenToSvg(e.clientX, e.clientY);
      const threshold = Math.max(10, Math.min(sheetWidth, sheetHeight) * 0.012);
      setSnapDisabled(e.altKey);

      if (drawTool === 'delete' || e.button === 2) {
        const hit = findNearestLineAnyAxis(bounds, x, y, threshold * 2);
        if (hit) {
          const next = removeNearestManualLine(
            bounds,
            hit.axis,
            hit.axis === 'x' ? x : y,
            threshold * 2
          );
          if (next !== bounds) commitBounds(next);
        }
        return;
      }

      const near = findNearestLineAnyAxis(bounds, x, y, threshold);
      if (near) {
        historyRef.current.push(bounds);
        dragStartBoundsRef.current = bounds;
        emitHistoryState();
        setDragging(near);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }

      const axis = drawTool === 'vertical' ? 'x' : 'y';
      const raw = axis === 'x' ? x : y;
      const position = snapAxisPosition(axis, raw, e.altKey);
      const next = insertManualLine(bounds, axis, position, sheetWidth, sheetHeight);
      if (next !== bounds) commitBounds(next);
    },
    [
      bounds,
      commitBounds,
      drawTool,
      emitHistoryState,
      screenToSvg,
      sheetHeight,
      sheetWidth,
      snapAxisPosition,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const pos = screenToSvg(e.clientX, e.clientY);
      setHoverPos(pos);
      setSnapDisabled(e.altKey);
      if (!dragging) return;
      const raw = dragging.axis === 'x' ? pos.x : pos.y;
      const position = snapAxisPosition(dragging.axis, raw, e.altKey);
      const next = moveManualLine(bounds, dragging.axis, dragging.index, position);
      setSliceSettings((prev) => ({
        ...prev,
        sliceMode: 'manual',
        manualXBounds: next.xBounds,
        manualYBounds: next.yBounds,
        cols: Math.max(1, next.xBounds.length - 1),
        rows: Math.max(1, next.yBounds.length - 1),
      }));
    },
    [bounds, dragging, screenToSvg, setSliceSettings, snapAxisPosition]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    dragStartBoundsRef.current = null;
  }, []);

  const handlePointerLeave = useCallback(() => {
    setDragging(null);
    setHoverPos(null);
    dragStartBoundsRef.current = null;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        onDrawToolChange?.('vertical');
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        onDrawToolChange?.('horizontal');
      } else if (e.key === 'x' || e.key === 'X' || e.key === 'Delete') {
        e.preventDefault();
        onDrawToolChange?.('delete');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDrawToolChange, redo, undo]);

  const showPreview =
    !dragging &&
    hoverPos &&
    (drawTool === 'vertical' || drawTool === 'horizontal');

  const previewPos = useMemo(() => {
    if (!hoverPos || !showPreview) return null;
    const axis = drawTool === 'vertical' ? 'x' : 'y';
    const raw = axis === 'x' ? hoverPos.x : hoverPos.y;
    const snapped = snapAxisPosition(axis, raw, snapDisabled);
    return axis === 'x' ? { x: snapped, y: hoverPos.y } : { x: hoverPos.x, y: snapped };
  }, [drawTool, hoverPos, showPreview, snapAxisPosition, snapDisabled]);

  return (
    <svg
      ref={svgRef}
      tabIndex={0}
      viewBox={`0 0 ${sheetWidth} ${sheetHeight}`}
      className="absolute inset-0 h-full w-full touch-none outline-none"
      style={{ cursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <rect
        x={0}
        y={0}
        width={sheetWidth}
        height={sheetHeight}
        fill="rgba(249,115,22,0.04)"
        stroke="rgba(249,115,22,0.7)"
        strokeWidth={2}
      />

      {showPreview && previewPos && drawTool === 'vertical' && (
        <line
          x1={previewPos.x}
          y1={0}
          x2={previewPos.x}
          y2={sheetHeight}
          stroke="rgba(249,115,22,0.45)"
          strokeWidth={2}
          strokeDasharray="6 4"
          className="pointer-events-none"
        />
      )}
      {showPreview && previewPos && drawTool === 'horizontal' && (
        <line
          x1={0}
          y1={previewPos.y}
          x2={sheetWidth}
          y2={previewPos.y}
          stroke="rgba(249,115,22,0.45)"
          strokeWidth={2}
          strokeDasharray="6 4"
          className="pointer-events-none"
        />
      )}

      {bounds.xBounds.slice(1, -1).map((x, i) => (
        <g key={`mx-${i}-${x}`}>
          <line
            x1={x}
            y1={0}
            x2={x}
            y2={sheetHeight}
            stroke="rgba(249,115,22,0.9)"
            strokeWidth={2}
          />
          <line
            x1={x}
            y1={0}
            x2={x}
            y2={sheetHeight}
            stroke="transparent"
            strokeWidth={14}
            style={{ pointerEvents: 'stroke' }}
          />
        </g>
      ))}

      {bounds.yBounds.slice(1, -1).map((y, i) => (
        <g key={`my-${i}-${y}`}>
          <line
            x1={0}
            y1={y}
            x2={sheetWidth}
            y2={y}
            stroke="rgba(249,115,22,0.9)"
            strokeWidth={2}
          />
          <line
            x1={0}
            y1={y}
            x2={sheetWidth}
            y2={y}
            stroke="transparent"
            strokeWidth={14}
            style={{ pointerEvents: 'stroke' }}
          />
        </g>
      ))}

      {rects.map((rect, i) => (
        <text
          key={`label-${i}`}
          x={rect.x + rect.width / 2}
          y={rect.y + 16}
          textAnchor="middle"
          className="pointer-events-none fill-signal font-bold"
          style={{ fontSize: '11px', fontFamily: 'system-ui, sans-serif' }}
        >
          {i + 1}
        </text>
      ))}

      <text
        x={sheetWidth / 2}
        y={18}
        textAnchor="middle"
        className="pointer-events-none fill-signal font-semibold"
        style={{ fontSize: '12px' }}
      >
        {hint}
      </text>
    </svg>
  );
};
