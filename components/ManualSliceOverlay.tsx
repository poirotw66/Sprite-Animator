/**
 * SVG overlay for user-drawn slice dividers (vertical / horizontal cut lines).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { SliceSettings } from '../utils/imageUtils';
import {
  buildEmptyManualBounds,
  buildEqualManualBounds,
  cellRectsFromBounds,
  findNearestInteriorLine,
  insertManualLine,
  moveManualLine,
  removeNearestManualLine,
  type ManualGridBounds,
} from '../utils/manualGridBounds';

/** Tool for draw-line slicing: add vertical, add horizontal, or delete. */
export type DrawLineTool = 'vertical' | 'horizontal' | 'delete';

/** @deprecated use DrawLineTool */
export type DrawLineAxis = 'x' | 'y';

interface ManualSliceOverlayProps {
  sheetWidth: number;
  sheetHeight: number;
  sliceSettings: SliceSettings;
  setSliceSettings: React.Dispatch<React.SetStateAction<SliceSettings>>;
  drawTool: DrawLineTool;
  hint: string;
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
  hint,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ axis: 'x' | 'y'; index: number } | null>(
    null
  );
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const bounds = useMemo(
    () => ensureManualBounds(sliceSettings, sheetWidth, sheetHeight),
    [sliceSettings, sheetWidth, sheetHeight]
  );

  const rects = useMemo(
    () => cellRectsFromBounds(bounds.xBounds, bounds.yBounds),
    [bounds]
  );

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

  const commitBounds = useCallback(
    (next: ManualGridBounds) => {
      setSliceSettings((prev) => ({
        ...prev,
        sliceMode: 'manual',
        manualXBounds: next.xBounds,
        manualYBounds: next.yBounds,
        cols: Math.max(1, next.xBounds.length - 1),
        rows: Math.max(1, next.yBounds.length - 1),
      }));
    },
    [setSliceSettings]
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
      const { x, y } = screenToSvg(e.clientX, e.clientY);
      const threshold = Math.max(10, Math.min(sheetWidth, sheetHeight) * 0.012);

      if (drawTool === 'delete' || e.button === 2 || e.altKey) {
        const hit = findNearestLineAnyAxis(bounds, x, y, threshold * 2);
        if (hit) {
          const next = removeNearestManualLine(
            bounds,
            hit.axis,
            hit.axis === 'x' ? x : y,
            threshold * 2
          );
          commitBounds(next);
        }
        return;
      }

      const near = findNearestLineAnyAxis(bounds, x, y, threshold);
      if (near) {
        setDragging(near);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }

      const axis = drawTool === 'vertical' ? 'x' : 'y';
      const next = insertManualLine(
        bounds,
        axis,
        axis === 'x' ? x : y,
        sheetWidth,
        sheetHeight
      );
      commitBounds(next);
    },
    [
      bounds,
      commitBounds,
      drawTool,
      screenToSvg,
      sheetHeight,
      sheetWidth,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const pos = screenToSvg(e.clientX, e.clientY);
      setHoverPos(pos);
      if (!dragging) return;
      const next = moveManualLine(
        bounds,
        dragging.axis,
        dragging.index,
        dragging.axis === 'x' ? pos.x : pos.y
      );
      commitBounds(next);
    },
    [bounds, commitBounds, dragging, screenToSvg]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setDragging(null);
    setHoverPos(null);
  }, []);

  const showPreview =
    !dragging &&
    hoverPos &&
    (drawTool === 'vertical' || drawTool === 'horizontal');

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${sheetWidth} ${sheetHeight}`}
      className="absolute inset-0 h-full w-full touch-none"
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

      {showPreview && drawTool === 'vertical' && (
        <line
          x1={hoverPos.x}
          y1={0}
          x2={hoverPos.x}
          y2={sheetHeight}
          stroke="rgba(249,115,22,0.45)"
          strokeWidth={2}
          strokeDasharray="6 4"
          className="pointer-events-none"
        />
      )}
      {showPreview && drawTool === 'horizontal' && (
        <line
          x1={0}
          y1={hoverPos.y}
          x2={sheetWidth}
          y2={hoverPos.y}
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
          className="pointer-events-none fill-orange-700 font-bold"
          style={{ fontSize: '11px', fontFamily: 'system-ui, sans-serif' }}
        >
          {i + 1}
        </text>
      ))}

      <text
        x={sheetWidth / 2}
        y={18}
        textAnchor="middle"
        className="pointer-events-none fill-orange-700 font-semibold"
        style={{ fontSize: '12px' }}
      >
        {hint}
      </text>
    </svg>
  );
};

/** Enter manual mode with no interior lines (clears prior grid). */
export function enableManualSliceMode(
  settings: SliceSettings,
  sheetWidth: number,
  sheetHeight: number
): SliceSettings {
  const empty = buildEmptyManualBounds(sheetWidth, sheetHeight);
  return {
    ...settings,
    sliceMode: 'manual',
    manualXBounds: empty.xBounds,
    manualYBounds: empty.yBounds,
    cols: 1,
    rows: 1,
  };
}

/** Seed equal cols×rows dividers while staying in manual mode. */
export function seedEqualManualSliceMode(
  settings: SliceSettings,
  sheetWidth: number,
  sheetHeight: number
): SliceSettings {
  const seeded = buildEqualManualBounds(
    sheetWidth,
    sheetHeight,
    settings.cols,
    settings.rows
  );
  return {
    ...settings,
    sliceMode: 'manual',
    manualXBounds: seeded.xBounds,
    manualYBounds: seeded.yBounds,
    cols: seeded.xBounds.length - 1,
    rows: seeded.yBounds.length - 1,
  };
}
