/**
 * SVG overlay for user-drawn marquee rectangles (independent cell crops).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SliceSettings } from '../utils/imageUtils';
import { CellRectHistory } from '../utils/cellRectHistory';
import {
  applyResizeHandle,
  clampCellRect,
  hitTestCellRect,
  hitTestResizeHandle,
  moveCellRect,
  normalizeDragRect,
  type CellRect,
  type ResizeHandle,
} from '../utils/manualCellRects';

export type RectMarqueeTool = 'draw' | 'delete';

export interface RectMarqueeHistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

interface RectMarqueeOverlayProps {
  sheetWidth: number;
  sheetHeight: number;
  sliceSettings: SliceSettings;
  setSliceSettings: React.Dispatch<React.SetStateAction<SliceSettings>>;
  tool: RectMarqueeTool;
  onToolChange?: (tool: RectMarqueeTool) => void;
  hint: string;
  onHistoryStateChange?: (state: RectMarqueeHistoryState) => void;
  historyApiRef?: React.MutableRefObject<{
    undo: () => void;
    redo: () => void;
  } | null>;
}

function cursorForHandle(handle: ResizeHandle): string {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
  }
}

export const RectMarqueeOverlay: React.FC<RectMarqueeOverlayProps> = ({
  sheetWidth,
  sheetHeight,
  sliceSettings,
  setSliceSettings,
  tool,
  onToolChange,
  hint,
  onHistoryStateChange,
  historyApiRef,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const historyRef = useRef(new CellRectHistory(30));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null
  );
  const [drag, setDrag] = useState<
    | { kind: 'move'; index: number; startX: number; startY: number; origin: CellRect }
    | {
        kind: 'resize';
        index: number;
        handle: ResizeHandle;
        origin: CellRect;
      }
    | null
  >(null);
  const [hoverHandle, setHoverHandle] = useState<ResizeHandle | null>(null);

  const rects: CellRect[] = useMemo(
    () => sliceSettings.inferredCellRects ?? [],
    [sliceSettings.inferredCellRects]
  );

  const emitHistoryState = useCallback(() => {
    onHistoryStateChange?.({
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
    });
  }, [onHistoryStateChange]);

  const commitRects = useCallback(
    (next: CellRect[], recordHistory = true) => {
      if (recordHistory) {
        historyRef.current.push(rects);
      }
      const cols = Math.max(1, next.length);
      setSliceSettings((prev) => ({
        ...prev,
        sliceMode: 'rects',
        inferredCellRects: next,
        cols,
        rows: 1,
        manualXBounds: undefined,
        manualYBounds: undefined,
      }));
      queueMicrotask(() => emitHistoryState());
    },
    [emitHistoryState, rects, setSliceSettings]
  );

  const applyHistoryRects = useCallback(
    (next: CellRect[]) => {
      const cols = Math.max(1, next.length);
      setSliceSettings((prev) => ({
        ...prev,
        sliceMode: 'rects',
        inferredCellRects: next,
        cols,
        rows: 1,
      }));
      setSelectedIndex((idx) =>
        idx != null && idx < next.length ? idx : next.length > 0 ? next.length - 1 : null
      );
      queueMicrotask(() => emitHistoryState());
    },
    [emitHistoryState, setSliceSettings]
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.undo(rects);
    if (prev) applyHistoryRects(prev);
  }, [applyHistoryRects, rects]);

  const redo = useCallback(() => {
    const next = historyRef.current.redo(rects);
    if (next) applyHistoryRects(next);
  }, [applyHistoryRects, rects]);

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
  }, [emitHistoryState, rects]);

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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.preventDefault();
      svgRef.current?.focus();
      const { x, y } = screenToSvg(e.clientX, e.clientY);

      if (tool === 'delete' || e.button === 2) {
        const hit = hitTestCellRect(rects, x, y);
        if (hit >= 0) {
          const next = rects.filter((_, i) => i !== hit);
          commitRects(next);
          setSelectedIndex(null);
        }
        return;
      }

      if (selectedIndex != null && rects[selectedIndex]) {
        const handle = hitTestResizeHandle(rects[selectedIndex]!, x, y);
        if (handle) {
          historyRef.current.push(rects);
          emitHistoryState();
          setDrag({
            kind: 'resize',
            index: selectedIndex,
            handle,
            origin: { ...rects[selectedIndex]! },
          });
          (e.target as Element).setPointerCapture?.(e.pointerId);
          return;
        }
      }

      const hit = hitTestCellRect(rects, x, y);
      if (hit >= 0) {
        setSelectedIndex(hit);
        historyRef.current.push(rects);
        emitHistoryState();
        setDrag({
          kind: 'move',
          index: hit,
          startX: x,
          startY: y,
          origin: { ...rects[hit]! },
        });
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }

      setSelectedIndex(null);
      setDraft({ x0: x, y0: y, x1: x, y1: y });
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [commitRects, emitHistoryState, rects, screenToSvg, selectedIndex, tool]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const { x, y } = screenToSvg(e.clientX, e.clientY);

      if (draft) {
        setDraft({ ...draft, x1: x, y1: y });
        return;
      }

      if (drag?.kind === 'move') {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        const moved = moveCellRect(drag.origin, dx, dy, sheetWidth, sheetHeight);
        const next = rects.map((r, i) => (i === drag.index ? moved : r));
        setSliceSettings((prev) => ({
          ...prev,
          sliceMode: 'rects',
          inferredCellRects: next,
          cols: Math.max(1, next.length),
          rows: 1,
        }));
        return;
      }

      if (drag?.kind === 'resize') {
        const resized = applyResizeHandle(
          drag.origin,
          drag.handle,
          x,
          y,
          sheetWidth,
          sheetHeight
        );
        const next = rects.map((r, i) => (i === drag.index ? resized : r));
        setSliceSettings((prev) => ({
          ...prev,
          sliceMode: 'rects',
          inferredCellRects: next,
          cols: Math.max(1, next.length),
          rows: 1,
        }));
        return;
      }

      if (selectedIndex != null && rects[selectedIndex]) {
        setHoverHandle(hitTestResizeHandle(rects[selectedIndex]!, x, y));
      } else {
        setHoverHandle(null);
      }
    },
    [
      draft,
      drag,
      rects,
      screenToSvg,
      selectedIndex,
      setSliceSettings,
      sheetHeight,
      sheetWidth,
    ]
  );

  const handlePointerUp = useCallback(() => {
    if (draft) {
      const created = normalizeDragRect(
        draft.x0,
        draft.y0,
        draft.x1,
        draft.y1,
        sheetWidth,
        sheetHeight
      );
      if (created) {
        const next = [...rects, clampCellRect(created, sheetWidth, sheetHeight)];
        commitRects(next);
        setSelectedIndex(next.length - 1);
      }
      setDraft(null);
      return;
    }
    if (drag) {
      // History already pushed at drag start; live updates already applied.
      emitHistoryState();
    }
    setDrag(null);
  }, [
    commitRects,
    draft,
    drag,
    emitHistoryState,
    rects,
    sheetHeight,
    sheetWidth,
  ]);

  const handlePointerLeave = useCallback(() => {
    if (!draft && !drag) setHoverHandle(null);
  }, [draft, drag]);

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

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        onToolChange?.('draw');
        return;
      }
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        onToolChange?.('delete');
        return;
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedIndex != null &&
        selectedIndex < rects.length
      ) {
        e.preventDefault();
        const next = rects.filter((_, i) => i !== selectedIndex);
        commitRects(next);
        setSelectedIndex(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commitRects, onToolChange, redo, rects, selectedIndex, undo]);

  const draftRect = draft
    ? normalizeDragRect(draft.x0, draft.y0, draft.x1, draft.y1, sheetWidth, sheetHeight, 1)
    : null;

  const cursor =
    tool === 'delete'
      ? 'pointer'
      : hoverHandle
        ? cursorForHandle(hoverHandle)
        : drag?.kind === 'move'
          ? 'grabbing'
          : 'crosshair';

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
        fill="rgba(16,185,129,0.04)"
        stroke="rgba(16,185,129,0.7)"
        strokeWidth={2}
      />

      {rects.map((rect, i) => {
        const selected = i === selectedIndex;
        return (
          <g key={`rect-${i}-${rect.x}-${rect.y}`}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={selected ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.08)'}
              stroke={selected ? 'rgba(5,150,105,1)' : 'rgba(16,185,129,0.9)'}
              strokeWidth={selected ? 3 : 2}
            />
            <text
              x={rect.x + 6}
              y={rect.y + 16}
              className="pointer-events-none fill-emerald-800 font-bold"
              style={{ fontSize: '12px', fontFamily: 'system-ui, sans-serif' }}
            >
              {i + 1}
            </text>
            {selected &&
              (['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as ResizeHandle[]).map((h) => {
                const hx =
                  h.includes('w') ? rect.x : h.includes('e') ? rect.x + rect.width : rect.x + rect.width / 2;
                const hy =
                  h.includes('n') ? rect.y : h.includes('s') ? rect.y + rect.height : rect.y + rect.height / 2;
                return (
                  <rect
                    key={h}
                    x={hx - 5}
                    y={hy - 5}
                    width={10}
                    height={10}
                    fill="white"
                    stroke="rgba(5,150,105,1)"
                    strokeWidth={2}
                    className="pointer-events-none"
                  />
                );
              })}
          </g>
        );
      })}

      {draftRect && (
        <rect
          x={draftRect.x}
          y={draftRect.y}
          width={draftRect.width}
          height={draftRect.height}
          fill="rgba(16,185,129,0.12)"
          stroke="rgba(16,185,129,0.7)"
          strokeWidth={2}
          strokeDasharray="6 4"
          className="pointer-events-none"
        />
      )}

      <text
        x={sheetWidth / 2}
        y={18}
        textAnchor="middle"
        className="pointer-events-none fill-emerald-800 font-semibold"
        style={{ fontSize: '12px' }}
      >
        {hint}
      </text>
    </svg>
  );
};
