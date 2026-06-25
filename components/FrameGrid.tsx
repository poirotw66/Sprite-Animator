import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, RotateCcw, X } from './Icons';
import { GripVertical } from 'lucide-react';
import { getCellRectForFrame, getContentCentroidOffset, getBestOffsetByTemplateMatch, cropCellFromImage, getEffectivePadding, type FrameOverride, type SliceSettings } from '../utils/imageUtils';
import { useLanguage } from '../hooks/useLanguage';

const OFFSET_MIN = -500;
const OFFSET_MAX = 500;
const SCALE_MIN = 0.25;
const SCALE_MAX = 1;
interface FrameGridProps {
  frames: string[];
  currentFrameIndex: number;
  onFrameClick: (index: number) => void;
  frameOverrides?: FrameOverride[];
  setFrameOverrides?: React.Dispatch<React.SetStateAction<FrameOverride[]>>;
  enablePerFrameEdit?: boolean;
  /** Sheet bitmap for single-frame crop canvas; optional when `useFrameImageForSingleCanvas` and frame URLs are used. */
  processedSpriteSheet?: string | null;
  sliceSettings?: SliceSettings;
  sheetDimensions?: { width: number; height: number };
  /** Per-frame include in animation/export; unchecked = exclude from playback and export */
  frameIncluded?: boolean[];
  setFrameIncluded?: React.Dispatch<React.SetStateAction<boolean[]>>;
  /**
   * When true, single-frame crop canvas draws from `frames[editing]` (e.g. programmatic text overlay)
   * instead of `processedSpriteSheet`, so preview matches thumbnails. Auto-align stays sheet-based and is hidden.
   */
  useFrameImageForSingleCanvas?: boolean;
  /** Optional block below the crop canvas (e.g. LINE programmatic font controls). */
  perFrameEditExtra?: React.ReactNode;
}

const CANVAS_SIZE = 400;

/** Sheet crop window → sub-rectangle in the per-frame image (matches sliceSpriteSheet dst math, scaled to natural size). */
function frameImageSubRectFromSheetCrop(
  imgW: number,
  imgH: number,
  sx: number,
  sy: number,
  cropW: number,
  cropH: number,
  srcLeft: number,
  srcTop: number,
  srcW: number,
  srcH: number,
): { fx: number; fy: number; fw: number; fh: number } {
  return {
    fx: ((srcLeft - sx) / cropW) * imgW,
    fy: ((srcTop - sy) / cropH) * imgH,
    fw: (srcW / cropW) * imgW,
    fh: (srcH / cropH) * imgH,
  };
}

export const FrameGrid: React.FC<FrameGridProps> = React.memo(({
  frames,
  currentFrameIndex,
  onFrameClick,
  frameOverrides = [],
  setFrameOverrides,
  enablePerFrameEdit = false,
  processedSpriteSheet = null,
  sliceSettings,
  sheetDimensions = { width: 0, height: 0 },
  frameIncluded = [],
  setFrameIncluded,
  useFrameImageForSingleCanvas = false,
  perFrameEditExtra,
}) => {
  const { t } = useLanguage();
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [usePrevAsRef, setUsePrevAsRef] = useState(false);
  const [prevRefOpacity, setPrevRefOpacity] = useState(45);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const editPanelRef = useRef<HTMLDivElement>(null);
  const panelDragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const ov = editingFrameIndex != null ? (frameOverrides[editingFrameIndex] ?? {}) : {};
  const offsetX = ov.offsetX ?? 0;
  const offsetY = ov.offsetY ?? 0;
  const scale = ov.scale ?? 1;

  const updateOverride = useCallback((patch: Partial<FrameOverride>) => {
    if (editingFrameIndex == null || !setFrameOverrides) return;
    setFrameOverrides((prev) => {
      const n = prev.slice();
      while (n.length <= editingFrameIndex) n.push({});
      n[editingFrameIndex] = { ...n[editingFrameIndex], ...patch };
      return n;
    });
  }, [editingFrameIndex, setFrameOverrides]);

  const resetOverride = useCallback(() => {
    if (editingFrameIndex == null || !setFrameOverrides) return;
    setDragOffset(null);
    setFrameOverrides((prev) => {
      const n = prev.slice();
      if (n.length > editingFrameIndex) {
        n[editingFrameIndex] = {};
      }
      return n;
    });
  }, [editingFrameIndex, setFrameOverrides]);

  // Reset drag state when switching to another frame
  useEffect(() => {
    setDragOffset(null);
  }, [editingFrameIndex]);

  const frameImageForCanvas =
    useFrameImageForSingleCanvas && editingFrameIndex != null ? frames[editingFrameIndex] : null;
  const hasCropCanvasData = !!(
    sliceSettings &&
    sheetDimensions.width > 0 &&
    sheetDimensions.height > 0 &&
    editingFrameIndex != null &&
    (processedSpriteSheet || frameImageForCanvas)
  );

  // Draw single-frame canvas with crop box when sheet geometry + source image are available
  useEffect(() => {
    if (!hasCropCanvasData || !canvasRef.current) return;
    const padding = getEffectivePadding(sliceSettings!);
    const cellRect = getCellRectForFrame(
      sheetDimensions.width,
      sheetDimensions.height,
      sliceSettings!.cols,
      sliceSettings!.rows,
      sliceSettings!.paddingX,
      sliceSettings!.paddingY,
      sliceSettings!.shiftX,
      sliceSettings!.shiftY,
      editingFrameIndex!,
      padding
    );
    if (!cellRect) return;
    const ov = frameOverrides[editingFrameIndex!] ?? {};
    const scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, ov.scale ?? 1));
    const offX = dragOffset?.x ?? ov.offsetX ?? 0;
    const offY = dragOffset?.y ?? ov.offsetY ?? 0;
    const cropW = cellRect.width * scale;
    const cropH = cellRect.height * scale;
    const sx = cellRect.x + (cellRect.width - cropW) / 2 + offX;
    const sy = cellRect.y + (cellRect.height - cropH) / 2 + offY;
    const totalW = sheetDimensions.width;
    const totalH = sheetDimensions.height;
    const srcLeft = Math.max(0, sx);
    const srcTop = Math.max(0, sy);
    const srcRight = Math.min(totalW, sx + cropW);
    const srcBottom = Math.min(totalH, sy + cropH);
    const srcW = srcRight - srcLeft;
    const srcH = srcBottom - srcTop;
    const displayScale = Math.min(CANVAS_SIZE / cropW, CANVAS_SIZE / cropH);
    const ox = (CANVAS_SIZE - cropW * displayScale) / 2;
    const oy = (CANVAS_SIZE - cropH * displayScale) / 2;
    const drawFromFrameImage = !!frameImageForCanvas;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.imageSmoothingEnabled = false;
      if (srcW > 0 && srcH > 0) {
        const dstX = ox + (srcLeft - sx) * displayScale;
        const dstY = oy + (srcTop - sy) * displayScale;
        const dstW = srcW * displayScale;
        const dstH = srcH * displayScale;
        if (drawFromFrameImage) {
          const { fx, fy, fw, fh } = frameImageSubRectFromSheetCrop(
            img.naturalWidth,
            img.naturalHeight,
            sx,
            sy,
            cropW,
            cropH,
            srcLeft,
            srcTop,
            srcW,
            srcH
          );
          if (fw > 0 && fh > 0) {
            ctx.drawImage(img, fx, fy, fw, fh, dstX, dstY, dstW, dstH);
          }
        } else {
          ctx.drawImage(img, srcLeft, srcTop, srcW, srcH, dstX, dstY, dstW, dstH);
        }
      }
      const drawCropAndGrid = () => {
        const cw = cropW * displayScale;
        const ch = cropH * displayScale;
        ctx.strokeStyle = 'rgba(255,140,0,0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(ox, oy, cw, ch);
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,200,120,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox + cw / 3, oy); ctx.lineTo(ox + cw / 3, oy + ch);
        ctx.moveTo(ox + (2 * cw) / 3, oy); ctx.lineTo(ox + (2 * cw) / 3, oy + ch);
        ctx.moveTo(ox, oy + ch / 3); ctx.lineTo(ox + cw, oy + ch / 3);
        ctx.moveTo(ox, oy + (2 * ch) / 3); ctx.lineTo(ox + cw, oy + (2 * ch) / 3);
        ctx.stroke();
      };
      const prevSrc = usePrevAsRef && editingFrameIndex! > 0 ? frames[editingFrameIndex! - 1] : null;
      const opacity = prevRefOpacity / 100;
      if (prevSrc) {
        const prevImg = new Image();
        prevImg.onload = () => {
          if (!canvasRef.current || !canvasRef.current.getContext('2d')) return;
          ctx.globalAlpha = opacity;
          ctx.drawImage(prevImg, 0, 0, prevImg.width, prevImg.height, ox, oy, cropW * displayScale, cropH * displayScale);
          ctx.globalAlpha = 1;
          drawCropAndGrid();
        };
        prevImg.onerror = () => drawCropAndGrid();
        prevImg.crossOrigin = 'anonymous';
        prevImg.src = prevSrc;
      } else {
        drawCropAndGrid();
      }
    };
    img.crossOrigin = 'anonymous';
    img.src = drawFromFrameImage ? frameImageForCanvas! : processedSpriteSheet!;
  }, [
    hasCropCanvasData,
    processedSpriteSheet,
    frameImageForCanvas,
    useFrameImageForSingleCanvas,
    sliceSettings,
    sheetDimensions,
    editingFrameIndex,
    frameOverrides,
    dragOffset,
    usePrevAsRef,
    prevRefOpacity,
    frames,
  ]);

  const startCropDrag = useCallback((clientX: number, clientY: number) => {
    if (!sliceSettings || !setFrameOverrides || editingFrameIndex == null ||
        sheetDimensions.width <= 0 || sheetDimensions.height <= 0 || !canvasRef.current) return;
    const padding = getEffectivePadding(sliceSettings);
    const cellRect = getCellRectForFrame(
      sheetDimensions.width,
      sheetDimensions.height,
      sliceSettings.cols,
      sliceSettings.rows,
      sliceSettings.paddingX,
      sliceSettings.paddingY,
      sliceSettings.shiftX,
      sliceSettings.shiftY,
      editingFrameIndex,
      padding
    );
    if (!cellRect) return;
    const ov = frameOverrides[editingFrameIndex] ?? {};
    const scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, ov.scale ?? 1));
    const offX = dragOffset?.x ?? ov.offsetX ?? 0;
    const offY = dragOffset?.y ?? ov.offsetY ?? 0;
    const cropW = cellRect.width * scale;
    const cropH = cellRect.height * scale;
    const displayScale = Math.min(CANVAS_SIZE / cropW, CANVAS_SIZE / cropH);
    const ox = (CANVAS_SIZE - cropW * displayScale) / 2;
    const oy = (CANVAS_SIZE - cropH * displayScale) / 2;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = ((clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const canvasY = ((clientY - rect.top) / rect.height) * CANVAS_SIZE;
    const cw = cropW * displayScale;
    const ch = cropH * displayScale;
    const hit = canvasX >= ox && canvasX <= ox + cw && canvasY >= oy && canvasY <= oy + ch;
    if (!hit) return;
    const totalW = sheetDimensions.width;
    const totalH = sheetDimensions.height;
    const offXMin = -cellRect.x - (cellRect.width + cropW) / 2;
    const offXMax = totalW - cellRect.x - (cellRect.width - cropW) / 2;
    const offYMin = -cellRect.y - (cellRect.height + cropH) / 2;
    const offYMax = totalH - cellRect.y - (cellRect.height - cropH) / 2;
    const dragStart = { canvasX, canvasY };
    const dragStartOffset = { x: offX, y: offY };
    latestOffsetRef.current = { x: offX, y: offY };
    const applyMove = (nextClientX: number, nextClientY: number) => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      const cx = ((nextClientX - r.left) / r.width) * CANVAS_SIZE;
      const cy = ((nextClientY - r.top) / r.height) * CANVAS_SIZE;
      const dSheetX = (cx - dragStart.canvasX) / displayScale;
      const dSheetY = (cy - dragStart.canvasY) / displayScale;
      const nx = Math.max(offXMin, Math.min(offXMax, dragStartOffset.x + dSheetX));
      const ny = Math.max(offYMin, Math.min(offYMax, dragStartOffset.y + dSheetY));
      setDragOffset({ x: nx, y: ny });
      latestOffsetRef.current = { x: nx, y: ny };
    };
    const onMoveMouse = (e2: MouseEvent) => applyMove(e2.clientX, e2.clientY);
    const onMoveTouch = (e2: TouchEvent) => {
      e2.preventDefault();
      if (e2.touches.length) applyMove(e2.touches[0].clientX, e2.touches[0].clientY);
    };
    const onUp = () => {
      updateOverride({ offsetX: latestOffsetRef.current.x, offsetY: latestOffsetRef.current.y });
      setDragOffset(null);
      window.removeEventListener('mousemove', onMoveMouse);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMoveTouch, { capture: true });
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
    window.addEventListener('mousemove', onMoveMouse);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMoveTouch, { passive: false, capture: true });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
  }, [sliceSettings, sheetDimensions, editingFrameIndex, frameOverrides, dragOffset, updateOverride, setFrameOverrides]);

  const handleCropCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    startCropDrag(e.clientX, e.clientY);
    e.preventDefault();
  }, [startCropDrag]);

  const handleCropCanvasTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    startCropDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, [startCropDrag]);

  const startEditPanelDrag = useCallback((clientX: number, clientY: number) => {
    const el = editPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const start = { clientX, clientY, left: rect.left, top: rect.top };
    panelDragPosRef.current = { x: rect.left, y: rect.top };
    const applyMove = (nextX: number, nextY: number) => {
      const panel = editPanelRef.current;
      if (!panel) return;
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const margin = 8;
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const vx = window.visualViewport?.offsetLeft ?? 0;
      const vy = window.visualViewport?.offsetTop ?? 0;
      let x = start.left + (nextX - start.clientX);
      let y = start.top + (nextY - start.clientY);
      x = Math.max(vx + margin, Math.min(vx + vw - w - margin, x));
      y = Math.max(vy + margin, Math.min(vy + vh - h - margin, y));
      panelDragPosRef.current = { x, y };
      setPanelPosition({ x, y });
    };
    const onMoveMouse = (e2: MouseEvent) => applyMove(e2.clientX, e2.clientY);
    const onMoveTouch = (e2: TouchEvent) => {
      e2.preventDefault();
      if (e2.touches.length) applyMove(e2.touches[0].clientX, e2.touches[0].clientY);
    };
    const onUp = () => {
      setPanelPosition({ ...panelDragPosRef.current });
      window.removeEventListener('mousemove', onMoveMouse);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMoveTouch, { capture: true });
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
    window.addEventListener('mousemove', onMoveMouse);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMoveTouch, { passive: false, capture: true });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
  }, []);

  const handleEditPanelMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startEditPanelDrag(e.clientX, e.clientY);
    e.preventDefault();
  }, [startEditPanelDrag]);

  const handleEditPanelTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    startEditPanelDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, [startEditPanelDrag]);

  if (frames.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center justify-between">
        動作分解 (Extracted Frames)
        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full text-slate-600 font-medium">點擊切換</span>
      </h3>

      {/* Per-frame edit panel: render via portal so it is not affected by parent transform/scale (fixes unclickable buttons) */}
      {enablePerFrameEdit && editingFrameIndex != null && setFrameOverrides && createPortal(
        <div
          ref={editPanelRef}
          className="fixed z-50 flex max-h-[min(92dvh,920px)] w-[min(100vw-0.75rem,56rem)] max-w-[min(96vw,56rem)] min-w-[280px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-lg"
          style={panelPosition != null
            ? { left: panelPosition.x, top: panelPosition.y, transform: 'none' }
            : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="flex shrink-0 cursor-move touch-manipulation select-none items-center justify-between gap-2 border-b border-slate-200/60 bg-slate-100/50 px-3 py-2.5"
            style={{ touchAction: 'none' }}
            onMouseDown={handleEditPanelMouseDown}
            onTouchStart={handleEditPanelTouchStart}
            aria-label="拖曳此列以移動編輯框"
          >
            <div className="flex min-w-0 items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span className="truncate text-sm font-semibold text-slate-700">編輯第 {editingFrameIndex + 1} 幀</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEditingFrameIndex(null); setDragOffset(null); setPanelPosition(null); }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              aria-label="關閉"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
            {hasCropCanvasData ? (
              <div className="flex shrink-0 flex-col border-b border-slate-200 bg-slate-100/40 px-4 py-3 md:max-w-[min(440px,46%)] md:flex-[0_0_auto] md:border-b-0 md:border-r md:py-4">
                <div className="mx-auto w-full max-w-[400px] md:mx-0">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">拖拉剪輯框 (Drag crop box)</label>
                  <canvas
                    ref={canvasRef}
                    width={CANVAS_SIZE}
                    height={CANVAS_SIZE}
                    onMouseDown={handleCropCanvasMouseDown}
                    onTouchStart={handleCropCanvasTouchStart}
                    className="aspect-square w-full max-w-[400px] cursor-grab touch-none rounded-lg border border-slate-200 bg-slate-100 active:cursor-grabbing"
                    style={{ imageRendering: 'pixelated', touchAction: 'none' }}
                    aria-label="單張幀剪輯預覽，可拖動橙色虛線框調整切割範圍"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    在框內按住拖動可調整切割位子（手機亦可觸控拖動），放開後套用
                  </p>
                  {editingFrameIndex > 0 && (
                    <div className="mt-2 space-y-2">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={usePrevAsRef}
                          onChange={(e) => setUsePrevAsRef(e.target.checked)}
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500/30"
                        />
                        <span className="text-xs text-slate-600">上一幀作為參考圖（虛影疊在編輯畫面上）</span>
                      </label>
                      {usePrevAsRef && (
                        <div className="pl-6">
                          <label className="mb-1 block text-xs font-medium text-slate-600">上一幀不透明度</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={5}
                              max={95}
                              value={prevRefOpacity}
                              onChange={(e) => setPrevRefOpacity(Number(e.target.value))}
                              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200"
                            />
                            <span className="w-8 text-xs font-medium text-slate-700">{prevRefOpacity}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-4 pt-3 md:pt-4">
              {perFrameEditExtra ? <div className="mb-4 shrink-0">{perFrameEditExtra}</div> : null}
              <div className="grid shrink-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">切割位子 (Position)</label>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-400">X</span>
                      <input
                        type="number"
                        min={OFFSET_MIN}
                        max={OFFSET_MAX}
                        value={offsetX}
                        onChange={(e) => updateOverride({ offsetX: Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, Number(e.target.value))) })}
                        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-400">Y</span>
                      <input
                        type="number"
                        min={OFFSET_MIN}
                        max={OFFSET_MAX}
                        value={offsetY}
                        onChange={(e) => updateOverride({ offsetY: Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, Number(e.target.value))) })}
                        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">像素偏移 {OFFSET_MIN} ~ {OFFSET_MAX}</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">框型大小 (Scale, 比例固定)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={SCALE_MIN}
                      max={SCALE_MAX}
                      step={0.05}
                      value={scale}
                      onChange={(e) => updateOverride({ scale: Number(e.target.value) })}
                      className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200"
                    />
                    <span className="w-12 text-sm font-semibold text-slate-700">{(scale * 100).toFixed(0)}%</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">25% ~ 100%</p>
                </div>
              </div>
              <div className="mt-3 flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={resetOverride}
              className="text-xs flex items-center gap-1.5 text-slate-600 bg-white hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置
            </button>
            {frames.length > 1 &&
             setFrameOverrides && (
              <>
                {(frameOverrides[0] && Object.keys(frameOverrides[0]).length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = { ...(frameOverrides[0] ?? {}) };
                      setFrameOverrides((prev) => {
                        const n = prev.slice();
                        for (let i = 1; i < frames.length; i++) n[i] = { ...first };
                        return n;
                      });
                    }}
                    className="text-xs flex items-center gap-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg border border-orange-200 transition-colors"
                    title="將第一幀的切割參數（位子、框型大小）套用到其餘所有幀"
                  >
                    從第一幀套用至其餘
                  </button>
                )}
                {processedSpriteSheet &&
                 !useFrameImageForSingleCanvas &&
                 sliceSettings &&
                 sheetDimensions &&
                 sheetDimensions.width > 0 &&
                 sheetDimensions.height > 0 && (
                  <>
                    {/* Smart alignment options */}
                    <div className="w-full mt-2 p-2 bg-white rounded-lg border border-slate-200 space-y-2">
                      <div className="text-xs font-medium text-slate-600">🎯 以錨點重新對齊</div>
                      <p className="text-[10px] text-slate-500">
                        每幀參考上一幀的裁切圖做模板匹配，主體軀幹無偏移。
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      disabled={isAutoAligning}
                      onClick={async () => {
                        if (!setFrameOverrides || !processedSpriteSheet || !sliceSettings || !sheetDimensions) return;
                        setIsAutoAligning(true);
                        try {
                          const prev = frameOverrides ?? [];
                          const scale = prev[0]?.scale ?? 1;
                          const W = sheetDimensions.width;
                          const H = sheetDimensions.height;
                          
                          const cellRects: Array<{ x: number; y: number; width: number; height: number }> = [];
                          for (let i = 0; i < frames.length; i++) {
                            const padding = getEffectivePadding(sliceSettings);
                            const rect = getCellRectForFrame(
                              W, H,
                              sliceSettings.cols,
                              sliceSettings.rows,
                              sliceSettings.paddingX,
                              sliceSettings.paddingY,
                              sliceSettings.shiftX,
                              sliceSettings.shiftY,
                              i,
                              padding
                            );
                            if (rect) cellRects.push(rect);
                          }
                          if (cellRects.length !== frames.length) return;

                          const sheetImg = await new Promise<HTMLImageElement>((res, rej) => {
                            const im = new Image();
                            im.onload = () => res(im);
                            im.onerror = () => rej(new Error('Failed to load sprite sheet'));
                            im.crossOrigin = 'anonymous';
                            im.src = processedSpriteSheet;
                          });

                          // Chain-to-previous: each frame aligns to the previous frame's image so torso has no offset
                          const next: Array<{ offsetX: number; offsetY: number; scale: number }> = [];

                          // Frame 0: anchor (user override or center torso in cell)
                          const hasFrame0Override = prev[0] && (prev[0].offsetX !== undefined || prev[0].offsetY !== undefined);
                          let offsetX0: number;
                          let offsetY0: number;
                          if (hasFrame0Override) {
                            offsetX0 = prev[0]?.offsetX ?? 0;
                            offsetY0 = prev[0]?.offsetY ?? 0;
                          } else {
                            const anchor = await getContentCentroidOffset(processedSpriteSheet, cellRects[0]);
                            offsetX0 = anchor.offsetX;
                            offsetY0 = anchor.offsetY;
                          }
                          next.push({ offsetX: offsetX0, offsetY: offsetY0, scale });

                          // Frames 1..N-1: template match to previous frame's crop (chain to previous image)
                          const CHAIN_SEARCH_DELTA = 50;
                          for (let i = 1; i < frames.length; i++) {
                            const prevRect = cellRects[i - 1];
                            const prevOff = next[i - 1];
                            const refImage = cropCellFromImage(
                              sheetImg,
                              prevRect,
                              prevOff.offsetX,
                              prevOff.offsetY,
                              scale,
                              W,
                              H
                            );
                            const res = await getBestOffsetByTemplateMatch(
                              sheetImg,
                              cellRects[i],
                              refImage,
                              scale,
                              W,
                              H,
                              {
                                prevOffsetX: next[i - 1].offsetX,
                                prevOffsetY: next[i - 1].offsetY,
                                maxDelta: CHAIN_SEARCH_DELTA
                              }
                            );
                            next.push({ offsetX: res.offsetX, offsetY: res.offsetY, scale });
                          }

                          setFrameOverrides(() => next);
                        } finally {
                          setIsAutoAligning(false);
                        }
                      }}
                      className="text-xs flex items-center gap-1.5 text-white bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      title={t.reAlignToAnchor}
                    >
                      {isAutoAligning ? `🔄 ${t.reAlignToAnchorProgress}` : `✨ ${t.reAlignToAnchor}`}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
            </div>
          </div>
        </div>
      , document.body)}

      {setFrameIncluded && (
        <p className="text-[10px] text-slate-500 mb-2">勾選納入動圖與匯出；取消勾選則排除</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {frames.map((frame, idx) => (
          <div
            key={idx}
            className={`relative aspect-square rounded-lg border-2 overflow-hidden bg-white transition-all duration-200 shadow-sm hover:shadow-md group touch-manipulation
              ${idx === currentFrameIndex ? 'border-orange-500 ring-2 ring-orange-200 shadow-md' : 'border-slate-200 hover:border-orange-400'}
              ${frameIncluded[idx] === false ? 'opacity-50' : ''}`}
          >
            {setFrameIncluded && (
              <label
                className="absolute top-1 left-1 z-10 flex items-center justify-center min-w-[36px] min-h-[36px] w-8 h-8 rounded-lg bg-white/95 border border-slate-200 cursor-pointer hover:bg-slate-50 active:bg-slate-100 touch-manipulation tap-highlight"
                onClick={(e) => e.stopPropagation()}
                title={frameIncluded[idx] === false ? '納入動圖' : '排除於動圖'}
              >
                <input
                  type="checkbox"
                  checked={frameIncluded[idx] !== false}
                  onChange={() => {
                    setFrameIncluded((prev) => {
                      const n = prev.slice();
                      while (n.length <= idx) n.push(true);
                      n[idx] = !(n[idx] !== false);
                      return n;
                    });
                  }}
                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500/30 w-4 h-4 touch-manipulation"
                />
              </label>
            )}
            <div
              className="w-full h-full cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 tap-highlight"
              onClick={() => onFrameClick(idx)}
              role="button"
              tabIndex={0}
              aria-label={`切換到第 ${idx + 1} 幀`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onFrameClick(idx);
                }
              }}
            >
              <img
                src={frame}
                alt={`Frame ${idx + 1}`}
                className="w-full h-full object-contain p-1"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            {enablePerFrameEdit && setFrameOverrides && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingFrameIndex(idx); }}
                className={`absolute top-1 right-1 min-w-[36px] min-h-[36px] p-2 rounded-lg transition-all flex items-center justify-center touch-manipulation tap-highlight
                  ${editingFrameIndex === idx ? 'bg-orange-500 text-white' : 'bg-white/90 text-slate-500 hover:bg-orange-100 hover:text-orange-600 active:bg-orange-200'}`}
                title="逐幀調整切割"
                aria-label={`編輯第 ${idx + 1} 幀`}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

FrameGrid.displayName = 'FrameGrid';
