import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pencil, RotateCcw, X } from './Icons';
import { GripVertical } from 'lucide-react';
import { getCellRectForFrame, getContentCentroidOffset, getBestOffsetByTemplateMatch, cropCellFromImage, smartAutoAlignFrames, getEffectivePadding, type FrameOverride, type SliceSettings } from '../utils/imageUtils';
import { useLanguage } from '../hooks/useLanguage';

const OFFSET_MIN = -500;
const OFFSET_MAX = 500;
const SCALE_MIN = 0.25;
const SCALE_MAX = 1;
/** Max pixels each frame may deviate from the previous when "reference previous frame" is on */
const AUTO_ALIGN_MAX_DELTA = 10;

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
  /** Per-frame include in animation/export; unchecked = exclude from playback and export */
  frameIncluded?: boolean[];
  setFrameIncluded?: React.Dispatch<React.SetStateAction<boolean[]>>;
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
  frameIncluded = [],
  setFrameIncluded,
}) => {
  const { t } = useLanguage();
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [usePrevAsRef, setUsePrevAsRef] = useState(false);
  const [prevRefOpacity, setPrevRefOpacity] = useState(45);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [autoAlignRefPrev, setAutoAlignRefPrev] = useState(true);
  const [smartAlignMode, setSmartAlignMode] = useState<'core' | 'bounds' | 'mass'>('core');
  const [temporalSmoothing, setTemporalSmoothing] = useState(0.7);
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
          <div className="flex flex-wrap gap-2 mt-3">
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
                 sliceSettings &&
                 sheetDimensions &&
                 sheetDimensions.width > 0 &&
                 sheetDimensions.height > 0 && (
                  <>
                    {/* Smart alignment options */}
                    <div className="w-full mt-2 p-2 bg-white rounded-lg border border-slate-200 space-y-2">
                      <div className="text-xs font-medium text-slate-600">🎯 智能對齊設定</div>
                      
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="alignMode"
                            checked={smartAlignMode === 'core'}
                            onChange={() => setSmartAlignMode('core')}
                            className="text-orange-500 focus:ring-orange-500/30"
                          />
                          <span className="text-xs text-slate-600" title="以角色軀幹為基準，忽略四肢移動（最穩定）">軀幹對齊 👤</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="alignMode"
                            checked={smartAlignMode === 'mass'}
                            onChange={() => setSmartAlignMode('mass')}
                            className="text-orange-500 focus:ring-orange-500/30"
                          />
                          <span className="text-xs text-slate-600" title="以所有像素的質心為基準">質心對齊</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="alignMode"
                            checked={smartAlignMode === 'bounds'}
                            onChange={() => setSmartAlignMode('bounds')}
                            className="text-orange-500 focus:ring-orange-500/30"
                          />
                          <span className="text-xs text-slate-600" title="以邊界框中心為基準">邊界對齊</span>
                        </label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 whitespace-nowrap">時序平滑:</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.1}
                          value={temporalSmoothing}
                          onChange={(e) => setTemporalSmoothing(Number(e.target.value))}
                          className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-slate-600 w-8">{(temporalSmoothing * 100).toFixed(0)}%</span>
                      </div>
                      
                      <label className="flex items-center gap-2 cursor-pointer" title="勾選時：依序以「前一幀裁切」為模板匹配、±10 px 搜尋，進一步精細對齊">
                        <input
                          type="checkbox"
                          checked={autoAlignRefPrev}
                          onChange={(e) => setAutoAlignRefPrev(e.target.checked)}
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500/30"
                        />
                        <span className="text-xs text-slate-600">啟用模板匹配精修 ±{AUTO_ALIGN_MAX_DELTA} px</span>
                      </label>
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
                          
                          // Get all cell rects
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
                          
                          // Get user's current frame 0 adjustment (as anchor reference)
                          const userFrame0Offset = {
                            offsetX: prev[0]?.offsetX ?? 0,
                            offsetY: prev[0]?.offsetY ?? 0
                          };
                          
                          // Use smart auto-align with user's frame 0 as anchor
                          const offsets = await smartAutoAlignFrames(
                            processedSpriteSheet,
                            cellRects,
                            scale,
                            {
                              alignMode: smartAlignMode,
                              temporalSmoothing,
                              anchorFrame: 0,
                              anchorOffset: userFrame0Offset // Pass user's adjusted offset as reference
                            }
                          );
                          
                          let next = offsets.map(o => ({ offsetX: o.offsetX, offsetY: o.offsetY, scale }));
                          
                          // If reference previous frame is enabled, refine with template matching
                          if (autoAlignRefPrev && frames.length > 1) {
                            const sheetImg = await new Promise<HTMLImageElement>((res, rej) => {
                              const im = new Image();
                              im.onload = () => res(im);
                              im.onerror = () => rej(new Error('Failed to load sprite sheet'));
                              im.crossOrigin = 'anonymous';
                              im.src = processedSpriteSheet;
                            });
                            
                            // Get reference from first frame
                            let refImageData: ImageData | null = null;
                            if (frames[0]) {
                              refImageData = await new Promise<ImageData>((res, rej) => {
                                const im = new Image();
                                im.onload = () => {
                                  const c = document.createElement('canvas');
                                  c.width = im.width;
                                  c.height = im.height;
                                  const ctx = c.getContext('2d');
                                  if (!ctx) { rej(new Error('Canvas')); return; }
                                  ctx.drawImage(im, 0, 0);
                                  res(ctx.getImageData(0, 0, im.width, im.height));
                                };
                                im.onerror = () => rej(new Error('Failed to load frame 0'));
                                im.crossOrigin = 'anonymous';
                                im.src = frames[0];
                              });
                            }
                            
                            // Refine each frame with template matching
                            for (let i = 1; i < frames.length && refImageData; i++) {
                              const p = next[i - 1] ?? {};
                              const prevRect = cellRects[i - 1];
                              const ref = i === 1 || !prevRect
                                ? refImageData
                                : cropCellFromImage(sheetImg, prevRect, p.offsetX ?? 0, p.offsetY ?? 0, scale, W, H);
                              
                              const res = await getBestOffsetByTemplateMatch(
                                sheetImg,
                                cellRects[i],
                                ref,
                                scale,
                                W,
                                H,
                                { prevOffsetX: next[i].offsetX, prevOffsetY: next[i].offsetY, maxDelta: AUTO_ALIGN_MAX_DELTA }
                              );
                              next[i] = { offsetX: res.offsetX, offsetY: res.offsetY, scale };
                            }
                            
                            // Apply temporal smoothing again after template matching
                            if (temporalSmoothing > 0 && next.length > 2) {
                              for (let i = 1; i < next.length - 1; i++) {
                                const a = next[i - 1];
                                const b = next[i];
                                const c = next[i + 1];
                                next[i] = {
                                  ...b,
                                  offsetX: b.offsetX * (1 - temporalSmoothing) + (a.offsetX + c.offsetX) / 2 * temporalSmoothing,
                                  offsetY: b.offsetY * (1 - temporalSmoothing) + (a.offsetY + c.offsetY) / 2 * temporalSmoothing,
                                };
                              }
                            }
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
      )}

      {setFrameIncluded && (
        <p className="text-[10px] text-slate-500 mb-2">勾選納入動圖與匯出；取消勾選則排除</p>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
        {frames.map((frame, idx) => (
          <div
            key={idx}
            className={`relative aspect-square rounded-lg border-2 overflow-hidden bg-white transition-all duration-200 shadow-sm hover:shadow-md group
              ${idx === currentFrameIndex ? 'border-orange-500 ring-2 ring-orange-200 shadow-md' : 'border-slate-200 hover:border-orange-400'}
              ${frameIncluded[idx] === false ? 'opacity-50' : ''}`}
          >
            {setFrameIncluded && (
              <label
                className="absolute top-1 left-1 z-10 flex items-center justify-center w-6 h-6 rounded bg-white/95 border border-slate-200 cursor-pointer hover:bg-slate-50"
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
                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500/30 w-3.5 h-3.5"
                />
              </label>
            )}
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
