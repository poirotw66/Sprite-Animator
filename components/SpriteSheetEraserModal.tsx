/**
 * Modal for erasing regions of a sprite sheet image.
 * Erased areas become transparent (alpha 0) so the result is suitable for chroma-key / transparent background.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check } from './Icons';
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

export const SpriteSheetEraserModal: React.FC<SpriteSheetEraserModalProps> = ({
  imageUrl,
  onConfirm,
  onClose,
}) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursorCircle, setCursorCircle] = useState<{ x: number; y: number; diameterPx: number } | null>(null);

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
      setImageLoaded(true);
    };
    img.onerror = () => setError(t.spriteSheetEraserLoadError);
    img.src = imageUrl;
  }, [imageUrl, t.spriteSheetEraserLoadError]);

  useEffect(() => {
    drawImageToCanvas();
  }, [drawImageToCanvas]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const point = getCanvasPoint(canvas, e.clientX, e.clientY);
      if (!point) return;
      setIsDrawing(true);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      eraseCircle(ctx, point.x, point.y, brushSize);
    },
    [brushSize]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const scale = rect.width / canvas.width;
        // brushSize is eraser radius in canvas pixels; cursor circle shows diameter in screen pixels
        const diameterPx = Math.max(8, Math.round(2 * brushSize * scale));
        setCursorCircle({ x: e.clientX, y: e.clientY, diameterPx });
        if (isDrawing) {
          e.preventDefault();
          const point = getCanvasPoint(canvas, e.clientX, e.clientY);
          if (point) {
            const ctx = canvas.getContext('2d');
            if (ctx) eraseCircle(ctx, point.x, point.y, brushSize);
          }
        }
      }
    },
    [isDrawing, brushSize]
  );

  const handlePointerUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setIsDrawing(false);
    setCursorCircle(null);
  }, []);

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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <h2 id="sprite-sheet-eraser-title" className="font-bold text-slate-900 text-lg">
            {t.spriteSheetEraserTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t.closeEditor}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="px-4 py-2 text-sm text-slate-600 flex-shrink-0">
          {t.spriteSheetEraserHint}
        </p>

        <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0">
          <label className="text-sm font-medium text-slate-700">
            {t.spriteSheetEraserBrushSize}
          </label>
          <input
            type="range"
            min={MIN_BRUSH}
            max={MAX_BRUSH}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="flex-1 max-w-xs h-2 rounded-full accent-green-600"
          />
          <span className="text-sm text-slate-500 tabular-nums w-8">{brushSize}px</span>
        </div>

        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex-shrink-0">
            {error}
          </div>
        )}

        <div
          className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4 relative"
          style={{ backgroundImage: `url(${GRID_PATTERN_URL})`, backgroundSize: '20px 20px', cursor: cursorCircle ? 'none' : undefined }}
        >
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto border border-slate-300 shadow-lg"
            style={{ maxHeight: 'min(60vh, 800px)', cursor: cursorCircle ? 'none' : 'crosshair' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerUp}
          />
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

        <div className="p-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!imageLoaded}
            className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {t.spriteSheetEraserConfirm}
          </button>
        </div>
      </div>
    </div>
  );
};
