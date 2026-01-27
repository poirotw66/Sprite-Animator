import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pencil, RotateCcw, X } from './Icons';
import { GripVertical } from 'lucide-react';
import { getCellRectForFrame, type FrameOverride, type SliceSettings } from '../utils/imageUtils';

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
  /** Required for draggable crop box on single-frame canvas (when enablePerFrameEdit) */
  processedSpriteSheet?: string | null;
  sliceSettings?: SliceSettings;
  sheetDimensions?: { width: number; height: number };
}

const CANVAS_SIZE = 400;

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
}) => {
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [usePrevAsRef, setUsePrevAsRef] = useState(false);
  const [prevRefOpacity, setPrevRefOpacity] = useState(45);
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

  // Draw single-frame canvas with crop box when sheet data is available
  const hasSheetData = !!(
    processedSpriteSheet &&
    sliceSettings &&
    sheetDimensions &&
    sheetDimensions.width > 0 &&
    sheetDimensions.height > 0 &&
    editingFrameIndex != null
  );
  useEffect(() => {
    if (!hasSheetData || !canvasRef.current) return;
    const cellRect = getCellRectForFrame(
      sheetDimensions.width,
      sheetDimensions.height,
      sliceSettings!.cols,
      sliceSettings!.rows,
      sliceSettings!.paddingX,
      sliceSettings!.paddingY,
      sliceSettings!.shiftX,
      sliceSettings!.shiftY,
      editingFrameIndex!
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
    const totalW = sheetDimensions!.width;
    const totalH = sheetDimensions!.height;
    const srcLeft = Math.max(0, sx);
    const srcTop = Math.max(0, sy);
    const srcRight = Math.min(totalW, sx + cropW);
    const srcBottom = Math.min(totalH, sy + cropH);
    const srcW = srcRight - srcLeft;
    const srcH = srcBottom - srcTop;
    const displayScale = Math.min(CANVAS_SIZE / cropW, CANVAS_SIZE / cropH);
    const ox = (CANVAS_SIZE - cropW * displayScale) / 2;
    const oy = (CANVAS_SIZE - cropH * displayScale) / 2;
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
        ctx.drawImage(img, srcLeft, srcTop, srcW, srcH, dstX, dstY, dstW, dstH);
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
    img.src = processedSpriteSheet!;
  }, [hasSheetData, processedSpriteSheet, sliceSettings, sheetDimensions, editingFrameIndex, frameOverrides, dragOffset, usePrevAsRef, prevRefOpacity, frames]);

  const handleCropCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processedSpriteSheet || !sliceSettings || !setFrameOverrides || editingFrameIndex == null ||
        !sheetDimensions || sheetDimensions.width <= 0 || sheetDimensions.height <= 0 || !canvasRef.current) return;
    const cellRect = getCellRectForFrame(
      sheetDimensions.width,
      sheetDimensions.height,
      sliceSettings.cols,
      sliceSettings.rows,
      sliceSettings.paddingX,
      sliceSettings.paddingY,
      sliceSettings.shiftX,
      sliceSettings.shiftY,
      editingFrameIndex
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
    const canvasX = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const canvasY = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE;
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
    const onMove = (e2: MouseEvent) => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      const cx = ((e2.clientX - r.left) / r.width) * CANVAS_SIZE;
      const cy = ((e2.clientY - r.top) / r.height) * CANVAS_SIZE;
      const dSheetX = (cx - dragStart.canvasX) / displayScale;
      const dSheetY = (cy - dragStart.canvasY) / displayScale;
      let nx = Math.max(offXMin, Math.min(offXMax, dragStartOffset.x + dSheetX));
      let ny = Math.max(offYMin, Math.min(offYMax, dragStartOffset.y + dSheetY));
      setDragOffset({ x: nx, y: ny });
      latestOffsetRef.current = { x: nx, y: ny };
    };
    const onUp = () => {
      updateOverride({ offsetX: latestOffsetRef.current.x, offsetY: latestOffsetRef.current.y });
      setDragOffset(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  }, [processedSpriteSheet, sliceSettings, sheetDimensions, editingFrameIndex, frameOverrides, dragOffset, updateOverride]);

  const handleEditPanelDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = editPanelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const start = { clientX: e.clientX, clientY: e.clientY, left: rect.left, top: rect.top };
    panelDragPosRef.current = { x: rect.left, y: rect.top };
    const onMove = (e2: MouseEvent) => {
      let x = start.left + (e2.clientX - start.clientX);
      let y = start.top + (e2.clientY - start.clientY);
      x = Math.max(8, Math.min(window.innerWidth - 100, x));
      y = Math.max(8, Math.min(window.innerHeight - 100, y));
      panelDragPosRef.current = { x, y };
      setPanelPosition({ x, y });
    };
    const onUp = () => {
      setPanelPosition({ ...panelDragPosRef.current });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  }, []);

  if (frames.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center justify-between">
        動作分解 (Extracted Frames)
        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full text-slate-600 font-medium">點擊切換</span>
      </h3>

      {/* Per-frame edit panel */}
      {enablePerFrameEdit && editingFrameIndex != null && setFrameOverrides && (
        <div
          ref={editPanelRef}
          className="fixed z-50 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-lg min-w-[280px] max-w-[90vw]"
          style={panelPosition != null
            ? { left: panelPosition.x, top: panelPosition.y, transform: 'none' }
            : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="flex items-center justify-between gap-2 py-2 -mx-1 -mt-1 px-2 mb-3 rounded-t cursor-move select-none touch-none border-b border-slate-200/60 bg-slate-100/50"
            onMouseDown={handleEditPanelDragStart}
            aria-label="拖曳此列以移動編輯框"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
              <span className="text-sm font-semibold text-slate-700 truncate">編輯第 {editingFrameIndex + 1} 幀</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEditingFrameIndex(null); setDragOffset(null); setPanelPosition(null); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors shrink-0"
              aria-label="關閉"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {hasSheetData && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">拖拉剪輯框 (Drag crop box)</label>
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                onMouseDown={handleCropCanvasMouseDown}
                className="block w-full max-w-[400px] aspect-square border border-slate-200 rounded-lg bg-slate-100 cursor-grab active:cursor-grabbing"
                style={{ imageRendering: 'pixelated' }}
                aria-label="單張幀剪輯預覽，可拖動橙色虛線框調整切割範圍"
              />
              <p className="text-[10px] text-slate-400 mt-1">在框內按住拖動可調整切割位子，放開後套用</p>
              {editingFrameIndex > 0 && (
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
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
                      <label className="block text-xs font-medium text-slate-600 mb-1">上一幀不透明度</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={5}
                          max={95}
                          value={prevRefOpacity}
                          onChange={(e) => setPrevRefOpacity(Number(e.target.value))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs font-medium text-slate-700 w-8">{prevRefOpacity}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">切割位子 (Position)</label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400">X</span>
                  <input
                    type="number"
                    min={OFFSET_MIN}
                    max={OFFSET_MAX}
                    value={offsetX}
                    onChange={(e) => updateOverride({ offsetX: Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, Number(e.target.value))) })}
                    className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none"
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
                    className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">像素偏移 {OFFSET_MIN} ~ {OFFSET_MAX}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">框型大小 (Scale, 比例固定)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={SCALE_MIN}
                  max={SCALE_MAX}
                  step={0.05}
                  value={scale}
                  onChange={(e) => updateOverride({ scale: Number(e.target.value) })}
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-700 w-12">{(scale * 100).toFixed(0)}%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">25% ~ 100%</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={resetOverride}
              className="text-xs flex items-center gap-1.5 text-slate-600 bg-white hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
        {frames.map((frame, idx) => (
          <div
            key={idx}
            className={`relative aspect-square rounded-lg border-2 overflow-hidden bg-white transition-all duration-200 shadow-sm hover:shadow-md group
              ${idx === currentFrameIndex ? 'border-orange-500 ring-2 ring-orange-200 shadow-md' : 'border-slate-200 hover:border-orange-400'}`}
          >
            <div
              className="w-full h-full cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
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
                className={`absolute top-1 right-1 p-1.5 rounded-lg transition-all
                  ${editingFrameIndex === idx ? 'bg-orange-500 text-white' : 'bg-white/90 text-slate-500 hover:bg-orange-100 hover:text-orange-600'}`}
                title="逐幀調整切割"
                aria-label={`編輯第 ${idx + 1} 幀`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

FrameGrid.displayName = 'FrameGrid';
