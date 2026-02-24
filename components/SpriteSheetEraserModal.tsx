/**
 * Modal for erasing regions of a sprite sheet image.
 * Erased areas become transparent (alpha 0) so the result is suitable for chroma-key / transparent background.
 * Features: Undo, canvas zoom, virtual ruler (snap to horizontal/vertical line).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, RotateCcw, ZoomIn, ZoomOut, Ruler } from './Icons';
import { useLanguage } from '../hooks/useLanguage';
import { GRID_PATTERN_URL } from '../utils/constants';

export interface SpriteSheetEraserModalProps {
  imageUrl: string;
  onConfirm: (dataUrl: string) => void;
  onClose: () => void;
}

const MIN_BRUSH = 4;
const MAX_BRUSH = 80;
const DEFAULT_BRUSH = 24;
const MAX_UNDO = 30;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

function getCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor((clientX - rect.left) * scaleX);
  const y = Math.floor((clientY - rect.top) * scaleY);
  if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return null;
  return { x, y };
}

function eraseCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
): void {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const r2 = radius * radius;
  const x0 = Math.max(0, cx - radius);
  const x1 = Math.min(w, cx + radius + 1);
  const y0 = Math.max(0, cy - radius);
  const y1 = Math.min(h, cy + radius + 1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = (y * w + x) * 4;
        data[i + 3] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Erase a horizontal or vertical line (axis-aligned) with given brush radius. */
function eraseLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number
): void {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const horizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  const xMin = Math.max(0, Math.min(x0, x1) - radius);
  const xMax = Math.min(w, Math.max(x0, x1) + radius + 1);
  const yMin = Math.max(0, Math.min(y0, y1) - radius);
  const yMax = Math.min(h, Math.max(y0, y1) + radius + 1);
  const r2 = radius * radius;
  for (let y = yMin; y < yMax; y++) {
    for (let x = xMin; x < xMax; x++) {
      let dist2: number;
      if (horizontal) {
        const py = y0;
        const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
        const px = t >= 0 && t <= 1 ? x : t < 0 ? x0 : x1;
        dist2 = (x - px) * (x - px) + (y - py) * (y - py);
      } else {
        const px = x0;
        const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
        const py = t >= 0 && t <= 1 ? y : t < 0 ? y0 : y1;
        dist2 = (x - px) * (x - px) + (y - py) * (y - py);
      }
      if (dist2 <= r2) {
        const i = (y * w + x) * 4;
        data[i + 3] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export const SpriteSheetEraserModal: React.FC<SpriteSheetEraserModalProps> = ({
  imageUrl,
  onConfirm,
  onClose,
}) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursorCircle, setCursorCircle] = useState<{ x: number; y: number; diameterPx: number } | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const [rulerOn, setRulerOn] = useState(false);
  const rulerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [rulerPreview, setRulerPreview] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const historyRef = useRef<ImageData[]>([]);
  const [historyLength, setHistoryLength] = useState(0);

  const drawImageToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    setError(null);
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      setCanvasSize({ w: img.naturalWidth, h: img.naturalHeight });
      historyRef.current = [];
      try {
        historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      } catch (_) {
        // ignore if canvas too large
      }
      setHistoryLength(historyRef.current.length);
      setImageLoaded(true);
    };
    img.onerror = () => setError(t.spriteSheetEraserLoadError);
    img.src = imageUrl;
  }, [imageUrl, t.spriteSheetEraserLoadError]);

  useEffect(() => {
    drawImageToCanvas();
  }, [drawImageToCanvas]);

  const pushState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length >= MAX_UNDO) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current.push(img);
      setHistoryLength(historyRef.current.length);
    } catch (_) {
      // ignore
    }
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(prev, 0, 0);
    setHistoryLength(historyRef.current.length);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const point = getCanvasPoint(canvas, e.clientX, e.clientY);
      if (!point) return;
      try {
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      } catch (_) { /* ignore */ }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (rulerOn) {
        rulerStartRef.current = point;
        setRulerPreview({ x0: point.x, y0: point.y, x1: point.x, y1: point.y });
      } else {
        pushState();
        setIsDrawing(true);
        eraseCircle(ctx, point.x, point.y, brushSize);
      }
    },
    [brushSize, rulerOn, pushState]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const scale = rect.width / canvas.width;
        const diameterPx = Math.max(8, Math.round(2 * brushSize * scale));
        setCursorCircle({ x: e.clientX, y: e.clientY, diameterPx });
        if (rulerOn && rulerStartRef.current) {
          const point = getCanvasPoint(canvas, e.clientX, e.clientY);
          if (point) {
            const { x: x0, y: y0 } = rulerStartRef.current;
            const { x: x1, y: y1 } = point;
            const horizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
            setRulerPreview(
              horizontal
                ? { x0, y0, x1: point.x, y1: y0 }
                : { x0, y0, x1: x0, y1: point.y }
            );
          }
        } else if (isDrawing && !rulerOn) {
          e.preventDefault();
          const point = getCanvasPoint(canvas, e.clientX, e.clientY);
          if (point) {
            const ctx = canvas.getContext('2d');
            if (ctx) eraseCircle(ctx, point.x, point.y, brushSize);
          }
        }
      }
    },
    [isDrawing, brushSize, rulerOn]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      try {
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      } catch (_) { /* ignore */ }
      const canvas = canvasRef.current;
      if (rulerOn && rulerStartRef.current && canvas) {
        const point = getCanvasPoint(canvas, e.clientX, e.clientY);
        if (point) {
          const { x: x0, y: y0 } = rulerStartRef.current;
          const { x: x1, y: y1 } = point;
          const horizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            pushState();
            if (horizontal) {
              eraseLine(ctx, x0, y0, x1, y0, brushSize);
            } else {
              eraseLine(ctx, x0, y0, x0, y1, brushSize);
            }
          }
        }
        rulerStartRef.current = null;
        setRulerPreview(null);
      }
      setIsDrawing(false);
    },
    [rulerOn, brushSize, pushState]
  );

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch (_) { /* ignore */ }
    setIsDrawing(false);
    setCursorCircle(null);
    if (rulerOn) {
      rulerStartRef.current = null;
      setRulerPreview(null);
    }
  }, [rulerOn]);

  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      onConfirm(dataUrl);
      onClose();
    } catch (err) {
      setError(t.spriteSheetEraserExportError);
    }
  }, [onConfirm, onClose, t.spriteSheetEraserExportError]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP)), []);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (imageLoaded && historyLength > 1) undo();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [onClose, undo, imageLoaded, historyLength]);

  const canUndoState = imageLoaded && historyLength > 1;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sprite-sheet-eraser-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 id="sprite-sheet-eraser-title" className="font-bold text-slate-900 text-lg">
              {t.spriteSheetEraserTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{t.spriteSheetEraserHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label={t.closeEditor}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-4 py-3 flex-shrink-0 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 shrink-0">
              {t.spriteSheetEraserBrushSize}
            </label>
            <input
              type="range"
              min={MIN_BRUSH}
              max={MAX_BRUSH}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-28 h-2 rounded-full accent-green-600"
            />
            <span className="text-sm text-slate-600 tabular-nums w-10">{brushSize}px</span>
          </div>
          <span className="w-px h-6 bg-slate-200 hidden sm:block" aria-hidden />
          <button
            type="button"
            onClick={undo}
            disabled={!canUndoState}
            className="p-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            title={`${t.spriteSheetEraserUndo} (Ctrl+Z)`}
            aria-label={t.spriteSheetEraserUndo}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium">{t.spriteSheetEraserUndo}</span>
          </button>
          <span className="w-px h-6 bg-slate-200 hidden sm:block" aria-hidden />
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-white">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="p-2 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              title={t.spriteSheetEraserZoomOut}
              aria-label={t.spriteSheetEraserZoomOut}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-700 min-w-[3.5rem] text-center tabular-nums font-medium">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="p-2 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              title={t.spriteSheetEraserZoomIn}
              aria-label={t.spriteSheetEraserZoomIn}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <span className="w-px h-6 bg-slate-200 hidden sm:block" aria-hidden />
          <button
            type="button"
            onClick={() => setRulerOn((on) => !on)}
            className={`p-2.5 rounded-lg border flex items-center gap-1.5 transition-colors ${rulerOn ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            title={t.spriteSheetEraserRulerHint}
            aria-label={t.spriteSheetEraserRuler}
            aria-pressed={rulerOn}
          >
            <Ruler className="w-4 h-4" />
            <span className="text-sm font-medium">{t.spriteSheetEraserRuler}</span>
          </button>
        </div>

        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex-shrink-0">
            {error}
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-auto p-3 relative"
          style={{
            backgroundImage: `url(${GRID_PATTERN_URL})`,
            backgroundSize: '20px 20px',
            cursor: cursorCircle ? 'none' : 'crosshair',
          }}
        >
          {!imageLoaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-10 rounded-lg m-3">
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">{t.spriteSheetEraserLoading}</span>
              </div>
            </div>
          )}
          <div
            style={{
              display: 'inline-block',
              width: (canvasSize.w || 400) * zoom,
              height: (canvasSize.h || 300) * zoom,
              minWidth: (canvasSize.w || 400) * zoom,
              minHeight: (canvasSize.h || 300) * zoom,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: canvasSize.w || 400,
                  height: canvasSize.h || 300,
                  transform: `scale(${zoom})`,
                  transformOrigin: '0 0',
                }}
              >
              <canvas
                ref={canvasRef}
                className="border border-slate-300 shadow-lg block"
                style={{ cursor: cursorCircle ? 'none' : 'crosshair', display: 'block' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onPointerCancel={handlePointerUp}
              />
              {rulerPreview && canvasSize.w > 0 && canvasSize.h > 0 && (
                <svg
                  className="pointer-events-none absolute"
                  width={canvasSize.w}
                  height={canvasSize.h}
                  style={{ left: 0, top: 0, zIndex: 1 }}
                  aria-hidden
                >
                  <line
                    x1={rulerPreview.x0}
                    y1={rulerPreview.y0}
                    x2={rulerPreview.x1}
                    y2={rulerPreview.y1}
                    stroke="rgba(34, 197, 94, 0.8)"
                    strokeWidth={Math.max(2, brushSize * 2)}
                    strokeLinecap="round"
                  />
                </svg>
              )}
              </div>
          </div>
          {cursorCircle && (
            <div
              className="pointer-events-none fixed border-2 border-violet-500 rounded-full bg-violet-500/20 z-[60]"
              style={{
                left: cursorCircle.x - cursorCircle.diameterPx / 2,
                top: cursorCircle.y - cursorCircle.diameterPx / 2,
                width: cursorCircle.diameterPx,
                height: cursorCircle.diameterPx,
              }}
              aria-hidden
            />
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 bg-slate-50/50">
          <p className="text-xs text-slate-500">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 font-mono text-slate-600">Esc</kbd> {t.closeEditor}
            {' · '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 font-mono text-slate-600">Ctrl+Z</kbd> {t.spriteSheetEraserUndo}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!imageLoaded}
              className="px-5 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" />
              {t.spriteSheetEraserConfirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
