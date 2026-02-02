import React, { useCallback, useMemo, useState, useRef } from 'react';
import { Download, Grid3X3, Loader2, Sliders, RefreshCw, Move, Eye, EyeOff } from './Icons';
import { SliceSettings, getEffectivePadding, inferGridFromGaps } from '../utils/imageUtils';
import { GRID_PATTERN_URL } from '../utils/constants';
import { useLanguage } from '../hooks/useLanguage';

interface SpriteSheetViewerProps {
  spriteSheetImage: string | null;
  originalSpriteSheet?: string | null; // Original sprite sheet before chroma key removal
  isGenerating: boolean;
  sheetDimensions: { width: number; height: number };
  sliceSettings: SliceSettings;
  setSliceSettings: React.Dispatch<React.SetStateAction<SliceSettings>>;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onDownload: () => void;
  onDownloadOriginal?: () => void; // Download original sprite sheet
  chromaKeyProgress?: number; // Progress of chroma key removal (0-100)
  isProcessingChromaKey?: boolean; // Whether chroma key removal is in progress
}

export const SpriteSheetViewer: React.FC<SpriteSheetViewerProps> = React.memo(({
  spriteSheetImage,
  originalSpriteSheet,
  isGenerating,
  sheetDimensions,
  sliceSettings,
  setSliceSettings,
  onImageLoad,
  onDownload,
  onDownloadOriginal,
  chromaKeyProgress = 0,
  isProcessingChromaKey = false,
}) => {
  const { t } = useLanguage();
  const [showOriginal, setShowOriginal] = useState(false);
  const handleColsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliceSettings((p) => ({ ...p, cols: Math.max(1, Number(e.target.value)) }));
  }, [setSliceSettings]);

  const handleRowsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliceSettings((p) => ({ ...p, rows: Math.max(1, Number(e.target.value)) }));
  }, [setSliceSettings]);

  const handlePaddingXChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliceSettings((p) => ({ 
      ...p, 
      paddingX: Number(e.target.value),
      autoOptimized: { ...p.autoOptimized, paddingX: false }
    }));
  }, [setSliceSettings]);

  const handlePaddingYChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliceSettings((p) => ({ 
      ...p, 
      paddingY: Number(e.target.value),
      autoOptimized: { ...p.autoOptimized, paddingY: false }
    }));
  }, [setSliceSettings]);

  const handleShiftXChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliceSettings((p) => ({ 
      ...p, 
      shiftX: Number(e.target.value),
      autoOptimized: { ...p.autoOptimized, shiftX: false }
    }));
  }, [setSliceSettings]);

  const handleShiftYChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliceSettings((p) => ({ 
      ...p, 
      shiftY: Number(e.target.value),
      autoOptimized: { ...p.autoOptimized, shiftY: false }
    }));
  }, [setSliceSettings]);

  const padding = useMemo(() => getEffectivePadding(sliceSettings), [sliceSettings]);
  const [isInferringGrid, setIsInferringGrid] = useState(false);

  const handleInferGridFromGaps = useCallback(async () => {
    if (!spriteSheetImage) return;
    setIsInferringGrid(true);
    try {
      const result = await inferGridFromGaps(spriteSheetImage);
      if (result) {
        setSliceSettings((prev) => ({
          ...prev,
          sliceMode: 'inferred',
          inferredCellRects: result.cellRects,
          cols: result.cols,
          rows: result.rows,
        }));
      }
    } finally {
      setIsInferringGrid(false);
    }
  }, [spriteSheetImage, setSliceSettings]);

  // Calculate real-time information (four-edge aware)
  const cellInfo = useMemo(() => {
    if (sheetDimensions.width === 0 || sheetDimensions.height === 0) {
      return null;
    }
    const effectiveWidth = sheetDimensions.width - padding.left - padding.right;
    const effectiveHeight = sheetDimensions.height - padding.top - padding.bottom;
    const cellWidth = Math.round(effectiveWidth / sliceSettings.cols);
    const cellHeight = Math.round(effectiveHeight / sliceSettings.rows);
    const totalFrames = sliceSettings.cols * sliceSettings.rows;
    
    return {
      cellWidth,
      cellHeight,
      totalFrames,
      effectiveWidth,
      effectiveHeight,
    };
  }, [sheetDimensions, sliceSettings, padding]);

  // Reset to default settings (clear four-edge and inferred mode)
  const handleReset = useCallback(() => {
    setSliceSettings({
      cols: sliceSettings.cols, // Keep grid size
      rows: sliceSettings.rows,
      paddingX: 0,
      paddingY: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      shiftX: 0,
      shiftY: 0,
      sliceMode: 'equal',
      inferredCellRects: undefined,
    });
  }, [setSliceSettings, sliceSettings.cols, sliceSettings.rows]);

  // Interactive grid editing state
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'grid' | 'padding-left' | 'padding-right' | 'padding-top' | 'padding-bottom' | 'shift' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartSettings, setDragStartSettings] = useState<SliceSettings | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate grid positions for interactive editing (four-edge aware)
  const gridPositions = useMemo(() => {
    if (sheetDimensions.width === 0 || sheetDimensions.height === 0) return null;
    
    const effectiveWidth = sheetDimensions.width - padding.left - padding.right;
    const effectiveHeight = sheetDimensions.height - padding.top - padding.bottom;
    const cellWidth = effectiveWidth / sliceSettings.cols;
    const cellHeight = effectiveHeight / sliceSettings.rows;
    const startX = padding.left + sliceSettings.shiftX;
    const startY = padding.top + sliceSettings.shiftY;
    
    return {
      startX,
      startY,
      cellWidth,
      cellHeight,
      effectiveWidth,
      effectiveHeight,
    };
  }, [sheetDimensions, sliceSettings, padding]);

  // Auto-center: Calculate shift to center the grid (four-edge aware)
  // Uses padding/sliceSettings so it does not depend on gridPositions (avoids TDZ)
  const handleAutoCenter = useCallback(() => {
    if (sheetDimensions.width === 0 || sheetDimensions.height === 0) return;
    const effectiveWidth = sheetDimensions.width - padding.left - padding.right;
    const effectiveHeight = sheetDimensions.height - padding.top - padding.bottom;
    const startX = padding.left + sliceSettings.shiftX;
    const startY = padding.top + sliceSettings.shiftY;
    const centerX = sheetDimensions.width / 2;
    const centerY = sheetDimensions.height / 2;
    const gridCenterX = startX + effectiveWidth / 2;
    const gridCenterY = startY + effectiveHeight / 2;
    setSliceSettings((p) => ({
      ...p,
      shiftX: Math.round(centerX - gridCenterX),
      shiftY: Math.round(centerY - gridCenterY),
    }));
  }, [setSliceSettings, sheetDimensions, padding, sliceSettings.shiftX, sliceSettings.shiftY]);

  // Convert screen coordinates to SVG coordinates
  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current || !gridPositions) return { x: 0, y: 0 };
    
    const rect = svgRef.current.getBoundingClientRect();
    const svg = svgRef.current;
    const viewBox = svg.viewBox.baseVal;
    
    const x = ((clientX - rect.left) / rect.width) * viewBox.width;
    const y = ((clientY - rect.top) / rect.height) * viewBox.height;
    
    return { x, y };
  }, [gridPositions]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!gridPositions) return;
    
    const svgCoords = screenToSvg(e.clientX, e.clientY);
    const { x, y } = svgCoords;
    const { startX, startY, cellWidth, cellHeight, effectiveWidth, effectiveHeight } = gridPositions;
    
    const endX = startX + effectiveWidth;
    const endY = startY + effectiveHeight;
    
    // Check if clicking on padding edges (within 10px)
    const paddingThreshold = 10;
    const isLeftEdge = Math.abs(x - startX) < paddingThreshold && y >= startY && y <= endY;
    const isRightEdge = Math.abs(x - endX) < paddingThreshold && y >= startY && y <= endY;
    const isTopEdge = Math.abs(y - startY) < paddingThreshold && x >= startX && x <= endX;
    const isBottomEdge = Math.abs(y - endY) < paddingThreshold && x >= startX && x <= endX;
    
    // Check if clicking on grid lines (within 5px)
    const gridThreshold = 5;
    let isVerticalGrid = false;
    let isHorizontalGrid = false;
    let gridIndex = -1;
    
    // Check vertical grid lines
    for (let i = 1; i < sliceSettings.cols; i++) {
      const lineX = startX + i * cellWidth;
      if (Math.abs(x - lineX) < gridThreshold && y >= startY && y <= endY) {
        isVerticalGrid = true;
        gridIndex = i;
        break;
      }
    }
    
    // Check horizontal grid lines
    for (let i = 1; i < sliceSettings.rows; i++) {
      const lineY = startY + i * cellHeight;
      if (Math.abs(y - lineY) < gridThreshold && x >= startX && x <= endX) {
        isHorizontalGrid = true;
        gridIndex = i;
        break;
      }
    }
    
    // Determine drag type
    if (isLeftEdge) {
      setIsDragging(true);
      setDragType('padding-left');
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartSettings({ ...sliceSettings });
    } else if (isRightEdge) {
      setIsDragging(true);
      setDragType('padding-right');
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartSettings({ ...sliceSettings });
    } else if (isTopEdge) {
      setIsDragging(true);
      setDragType('padding-top');
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartSettings({ ...sliceSettings });
    } else if (isBottomEdge) {
      setIsDragging(true);
      setDragType('padding-bottom');
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartSettings({ ...sliceSettings });
    } else if (isVerticalGrid || isHorizontalGrid) {
      setIsDragging(true);
      setDragType('grid');
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartSettings({ ...sliceSettings });
    } else if (x >= startX && x <= endX && y >= startY && y <= endY) {
      // Clicking inside grid - drag to shift
      setIsDragging(true);
      setDragType('shift');
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartSettings({ ...sliceSettings });
    }
  }, [gridPositions, sliceSettings, screenToSvg]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !dragStartSettings || !gridPositions) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // Convert screen delta to SVG delta
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svg = svgRef.current;
    const viewBox = svg.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    
    const svgDeltaX = deltaX * scaleX;
    const svgDeltaY = deltaY * scaleY;
    
    if (dragType === 'shift') {
      // Drag entire grid
      setSliceSettings({
        ...dragStartSettings,
        shiftX: Math.max(-100, Math.min(100, Math.round(dragStartSettings.shiftX + svgDeltaX))),
        shiftY: Math.max(-100, Math.min(100, Math.round(dragStartSettings.shiftY + svgDeltaY))),
        autoOptimized: {
          ...dragStartSettings.autoOptimized,
          shiftX: false,
          shiftY: false,
        },
      });
    } else if (dragType === 'padding-left') {
      const left0 = dragStartSettings.paddingLeft ?? dragStartSettings.paddingX;
      const newLeft = Math.max(0, Math.min(sheetDimensions.width * 0.4, left0 - svgDeltaX));
      setSliceSettings({
        ...dragStartSettings,
        paddingLeft: Math.round(newLeft),
        paddingX: Math.round((newLeft + (dragStartSettings.paddingRight ?? dragStartSettings.paddingX)) / 2),
        autoOptimized: { ...dragStartSettings.autoOptimized, paddingX: false },
      });
    } else if (dragType === 'padding-right') {
      const right0 = dragStartSettings.paddingRight ?? dragStartSettings.paddingX;
      const newRight = Math.max(0, Math.min(sheetDimensions.width * 0.4, right0 + svgDeltaX));
      setSliceSettings({
        ...dragStartSettings,
        paddingRight: Math.round(newRight),
        paddingX: Math.round(((dragStartSettings.paddingLeft ?? dragStartSettings.paddingX) + newRight) / 2),
        autoOptimized: { ...dragStartSettings.autoOptimized, paddingX: false },
      });
    } else if (dragType === 'padding-top') {
      const top0 = dragStartSettings.paddingTop ?? dragStartSettings.paddingY;
      const newTop = Math.max(0, Math.min(sheetDimensions.height * 0.4, top0 - svgDeltaY));
      setSliceSettings({
        ...dragStartSettings,
        paddingTop: Math.round(newTop),
        paddingY: Math.round((newTop + (dragStartSettings.paddingBottom ?? dragStartSettings.paddingY)) / 2),
        autoOptimized: { ...dragStartSettings.autoOptimized, paddingY: false },
      });
    } else if (dragType === 'padding-bottom') {
      const bottom0 = dragStartSettings.paddingBottom ?? dragStartSettings.paddingY;
      const newBottom = Math.max(0, Math.min(sheetDimensions.height * 0.4, bottom0 + svgDeltaY));
      setSliceSettings({
        ...dragStartSettings,
        paddingBottom: Math.round(newBottom),
        paddingY: Math.round(((dragStartSettings.paddingTop ?? dragStartSettings.paddingY) + newBottom) / 2),
        autoOptimized: { ...dragStartSettings.autoOptimized, paddingY: false },
      });
    } else if (dragType === 'grid') {
      // Drag grid lines to adjust cols/rows
      // This is complex - for now, we'll skip this and let users use the input fields
      // Future enhancement: calculate new cols/rows based on grid line position
    }
  }, [isDragging, dragType, dragStart, dragStartSettings, gridPositions, setSliceSettings]);

  // Handle mouse up to end dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
    setDragStart({ x: 0, y: 0 });
    setDragStartSettings(null);
  }, []);

  // Handle mouse leave to end dragging
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      handleMouseUp();
    }
  }, [isDragging, handleMouseUp]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-x-auto">
      {/* Chroma Key Processing Progress Indicator */}
      {isProcessingChromaKey && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-10">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">{t.processingChromaKey}</p>
              <div className="w-64 bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-orange-500 to-orange-600 h-full transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${chromaKeyProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 font-medium">{chromaKeyProgress}%</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <span className="bg-slate-100 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
            S
          </span>
          {t.spriteSheetTitle}（{showOriginal ? t.spriteSheetOriginal : t.spriteSheetProcessed}）
        </h2>
        <div className="flex gap-2">
          {spriteSheetImage && originalSpriteSheet && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="text-xs flex items-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-all duration-200 font-semibold cursor-pointer border border-blue-200 hover:border-blue-300 hover:shadow-sm"
              aria-label={showOriginal ? t.showProcessed : t.showOriginal}
            >
              {showOriginal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showOriginal ? t.showProcessed : t.showOriginal}
            </button>
          )}
          {spriteSheetImage && originalSpriteSheet && onDownloadOriginal && (
            <button
              onClick={onDownloadOriginal}
              className="text-xs flex items-center gap-1.5 text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-full transition-all duration-200 font-semibold cursor-pointer border border-green-200 hover:border-green-300 hover:shadow-sm"
              aria-label={t.downloadOriginal}
            >
              <Download className="w-3.5 h-3.5" />
              {t.downloadOriginal}
            </button>
          )}
          {spriteSheetImage && (
            <button
              onClick={onDownload}
              className="text-xs flex items-center gap-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full transition-all duration-200 font-semibold cursor-pointer border border-orange-200 hover:border-orange-300 hover:shadow-sm"
              aria-label={t.downloadProcessed}
            >
              <Download className="w-3.5 h-3.5" />
              {t.downloadProcessed}
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 min-h-[200px] flex items-center justify-center relative overflow-hidden group select-none">
        {!spriteSheetImage && !isGenerating && !isProcessingChromaKey && (
          <div className="text-center p-6 opacity-60">
            <Grid3X3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">{t.spriteSheetPlaceholder}</p>
          </div>
        )}

        {!spriteSheetImage && (isGenerating || isProcessingChromaKey) && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
            <p className="text-xs text-slate-600 font-medium">
              {isProcessingChromaKey ? t.processingChromaKey : t.generating}
            </p>
          </div>
        )}

        {spriteSheetImage && (
          <div className="relative inline-block mx-auto max-w-full">
            {/* Wrapper with Grid Background for Transparency Check */}
            <div
              className="bg-repeat bg-[length:20px_20px] rounded-lg overflow-hidden border border-gray-200 relative"
              style={{ backgroundImage: `url(${GRID_PATTERN_URL})` }}
            >
              {/* The generated image */}
              <img
                src={showOriginal && originalSpriteSheet ? originalSpriteSheet : spriteSheetImage}
                alt="Sprite Sheet"
                className="block max-w-full h-auto object-contain pixelated"
                onLoad={onImageLoad}
              />
              
              {/* Grid overlay for alignment - drawn behind SVG but visible */}
              {sheetDimensions.width > 0 && gridPositions && (
                <svg
                  viewBox={`0 0 ${sheetDimensions.width} ${sheetDimensions.height}`}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ opacity: 0.3 }}
                >
                  {/* Draw cell grid for alignment */}
                  {Array.from({ length: sliceSettings.rows }).map((_, r) => {
                    return Array.from({ length: sliceSettings.cols }).map((_, c) => {
                      const cellX = gridPositions.startX + c * gridPositions.cellWidth;
                      const cellY = gridPositions.startY + r * gridPositions.cellHeight;
                      return (
                        <rect
                          key={`cell-${r}-${c}`}
                          x={cellX}
                          y={cellY}
                          width={gridPositions.cellWidth}
                          height={gridPositions.cellHeight}
                          fill="none"
                          stroke="rgba(99,102,241,0.4)"
                          strokeWidth="1"
                        />
                      );
                    });
                  })}
                </svg>
              )}

              {/* SVG Overlay: Uses ViewBox to match image's natural dimensions. */}
              {sheetDimensions.width > 0 && (
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${sheetDimensions.width} ${sheetDimensions.height}`}
                  className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
                  style={{
                    border: '1px solid rgba(59,130,246,0.3)',
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Draw Outer Rect (Grid Area) - defined by Padding and Shift */}
                  <rect
                    x={padding.left + sliceSettings.shiftX}
                    y={padding.top + sliceSettings.shiftY}
                    width={Math.max(0, sheetDimensions.width - padding.left - padding.right)}
                    height={Math.max(0, sheetDimensions.height - padding.top - padding.bottom)}
                    fill="rgba(59,130,246,0.05)"
                    stroke="rgba(59,130,246,0.8)"
                    strokeWidth="2"
                    className="hover:stroke-blue-500 transition-colors"
                  />
                  
                  {/* Draw draggable padding edges */}
                  {gridPositions && (
                    <>
                      {/* Left edge */}
                      <line
                        x1={gridPositions.startX}
                        y1={gridPositions.startY}
                        x2={gridPositions.startX}
                        y2={gridPositions.startY + gridPositions.effectiveHeight}
                        stroke="rgba(34,197,94,0.6)"
                        strokeWidth="4"
                        className="cursor-ew-resize hover:stroke-green-500"
                        style={{ pointerEvents: 'stroke' }}
                      />
                      {/* Right edge */}
                      <line
                        x1={gridPositions.startX + gridPositions.effectiveWidth}
                        y1={gridPositions.startY}
                        x2={gridPositions.startX + gridPositions.effectiveWidth}
                        y2={gridPositions.startY + gridPositions.effectiveHeight}
                        stroke="rgba(34,197,94,0.6)"
                        strokeWidth="4"
                        className="cursor-ew-resize hover:stroke-green-500"
                        style={{ pointerEvents: 'stroke' }}
                      />
                      {/* Top edge */}
                      <line
                        x1={gridPositions.startX}
                        y1={gridPositions.startY}
                        x2={gridPositions.startX + gridPositions.effectiveWidth}
                        y2={gridPositions.startY}
                        stroke="rgba(34,197,94,0.6)"
                        strokeWidth="4"
                        className="cursor-ns-resize hover:stroke-green-500"
                        style={{ pointerEvents: 'stroke' }}
                      />
                      {/* Bottom edge */}
                      <line
                        x1={gridPositions.startX}
                        y1={gridPositions.startY + gridPositions.effectiveHeight}
                        x2={gridPositions.startX + gridPositions.effectiveWidth}
                        y2={gridPositions.startY + gridPositions.effectiveHeight}
                        stroke="rgba(34,197,94,0.6)"
                        strokeWidth="4"
                        className="cursor-ns-resize hover:stroke-green-500"
                        style={{ pointerEvents: 'stroke' }}
                      />
                    </>
                  )}

                  {/* Draw Vertical Grid Lines - More visible for alignment */}
                  {Array.from({ length: sliceSettings.cols - 1 }).map((_, i) => {
                    const effectiveWidth = sheetDimensions.width - padding.left - padding.right;
                    const cellWidth = effectiveWidth / sliceSettings.cols;
                    const startX = padding.left + sliceSettings.shiftX;
                    const startY = padding.top + sliceSettings.shiftY;
                    const height = sheetDimensions.height - padding.top - padding.bottom;
                    const x = startX + (i + 1) * cellWidth;
                    return (
                      <g key={`v-${i}`}>
                        {/* Main grid line - solid for better visibility */}
                        <line
                          x1={x}
                          y1={startY}
                          x2={x}
                          y2={startY + height}
                          stroke="rgba(59,130,246,0.8)"
                          strokeWidth="2"
                        />
                        {/* Dashed line overlay for style */}
                        <line
                          x1={x}
                          y1={startY}
                          x2={x}
                          y2={startY + height}
                          stroke="rgba(99,102,241,0.3)"
                          strokeWidth="1"
                          strokeDasharray="4 2"
                        />
                        {/* Interactive area for dragging */}
                        <line
                          x1={x}
                          y1={startY}
                          x2={x}
                          y2={startY + height}
                          stroke="transparent"
                          strokeWidth="10"
                          className="cursor-ew-resize hover:stroke-blue-400/30"
                          style={{ pointerEvents: 'stroke' }}
                        />
                      </g>
                    );
                  })}

                  {/* Draw Horizontal Grid Lines - More visible for alignment */}
                  {Array.from({ length: sliceSettings.rows - 1 }).map((_, i) => {
                    const effectiveHeight = sheetDimensions.height - padding.top - padding.bottom;
                    const cellHeight = effectiveHeight / sliceSettings.rows;
                    const startX = padding.left + sliceSettings.shiftX;
                    const startY = padding.top + sliceSettings.shiftY;
                    const width = sheetDimensions.width - padding.left - padding.right;
                    const y = startY + (i + 1) * cellHeight;
                    return (
                      <g key={`h-${i}`}>
                        {/* Main grid line - solid for better visibility */}
                        <line
                          x1={startX}
                          y1={y}
                          x2={startX + width}
                          y2={y}
                          stroke="rgba(59,130,246,0.8)"
                          strokeWidth="2"
                        />
                        {/* Dashed line overlay for style */}
                        <line
                          x1={startX}
                          y1={y}
                          x2={startX + width}
                          y2={y}
                          stroke="rgba(99,102,241,0.3)"
                          strokeWidth="1"
                          strokeDasharray="4 2"
                        />
                        {/* Interactive area for dragging */}
                        <line
                          x1={startX}
                          y1={y}
                          x2={startX + width}
                          y2={y}
                          stroke="transparent"
                          strokeWidth="10"
                          className="cursor-ns-resize hover:stroke-blue-400/30"
                          style={{ pointerEvents: 'stroke' }}
                        />
                      </g>
                    );
                  })}
                  
                  {/* Cell numbers for easy identification */}
                  {gridPositions && Array.from({ length: sliceSettings.rows }).map((_, r) => {
                    return Array.from({ length: sliceSettings.cols }).map((_, c) => {
                      const cellX = gridPositions.startX + c * gridPositions.cellWidth;
                      const cellY = gridPositions.startY + r * gridPositions.cellHeight;
                      const cellNumber = r * sliceSettings.cols + c + 1;
                      const centerX = cellX + gridPositions.cellWidth / 2;
                      const centerY = cellY + gridPositions.cellHeight / 2;
                      
                      return (
                        <g key={`cell-label-${r}-${c}`}>
                          {/* Background circle for number */}
                          <circle
                            cx={centerX}
                            cy={cellY + 15}
                            r="10"
                            fill="rgba(59,130,246,0.2)"
                            stroke="rgba(59,130,246,0.6)"
                            strokeWidth="1"
                            className="pointer-events-none"
                          />
                          {/* Cell number */}
                          <text
                            x={centerX}
                            y={cellY + 18}
                            textAnchor="middle"
                            className="text-xs fill-blue-700 font-bold pointer-events-none"
                            style={{ fontSize: '10px', fontFamily: 'system-ui, sans-serif' }}
                          >
                            {cellNumber}
                          </text>
                        </g>
                      );
                    });
                  })}
                  
                  {/* Help text overlay */}
                  {!isDragging && (
                    <text
                      x={sheetDimensions.width / 2}
                      y={20}
                      textAnchor="middle"
                      className="text-xs fill-blue-600 font-semibold pointer-events-none"
                      style={{ fontSize: '12px' }}
                    >
                      {t.dragHint}
                    </text>
                  )}
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual Slicing Controls Toolbar */}
      {spriteSheetImage && sheetDimensions.width > 0 && (
        <div className="mt-4 p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 border border-blue-200 rounded-xl flex flex-col gap-4 text-sm animate-in fade-in slide-in-from-top-2 shadow-md">
          {/* Header with Actions */}
          <div className="flex items-center justify-between border-b border-blue-300 pb-3">
            <div className="flex items-center gap-2 text-blue-900 font-bold">
              <Sliders className="w-5 h-5" />
              <span>{t.gridSliceSettings}</span>
              <span className="text-xs font-normal text-blue-600 ml-1">(Manual Slicing)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoCenter}
                className="text-xs flex items-center gap-1.5 text-blue-700 bg-blue-100 hover:bg-blue-200 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border border-blue-300 hover:shadow-sm"
                title={t.autoCenter}
                aria-label={t.autoCenter}
              >
                <Move className="w-3.5 h-3.5" />
                {t.center}
              </button>
              <button
                onClick={handleReset}
                className="text-xs flex items-center gap-1.5 text-slate-600 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border border-slate-300 hover:shadow-sm"
                title={t.resetScaleAndShift}
                aria-label={t.resetSettings}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t.resetSettings}
              </button>
              <button
                type="button"
                disabled={!spriteSheetImage || isInferringGrid}
                onClick={handleInferGridFromGaps}
                className="text-xs flex items-center gap-1.5 text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border border-green-300 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={t.inferGridFromGaps}
                aria-label={t.inferGridFromGaps}
              >
                {isInferringGrid ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t.inferGridFromGapsProgress}
                  </>
                ) : (
                  <>
                    <Grid3X3 className="w-3.5 h-3.5" />
                    {t.inferGridFromGaps}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grid Size Controls */}
          <div className="bg-white/80 rounded-lg p-3 border border-blue-200/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">{t.gridSize}</span>
              {cellInfo && (
                <span className="text-xs text-blue-600 font-medium">
                  {cellInfo.totalFrames} {t.frames} · {cellInfo.cellWidth}×{cellInfo.cellHeight}px
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 flex-1">
                <span className="text-xs text-slate-600 font-medium min-w-[40px]">{t.cols} (Cols)</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sliceSettings.cols}
                  onChange={handleColsChange}
                  className="flex-1 text-center text-sm font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200"
                  aria-label={t.cols}
                />
                {cellInfo && (
                  <span className="text-[10px] text-slate-500 min-w-[35px] text-right">
                    {cellInfo.cellWidth}px
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 flex-1">
                <span className="text-xs text-slate-600 font-medium min-w-[40px]">{t.rows} (Rows)</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sliceSettings.rows}
                  onChange={handleRowsChange}
                  className="flex-1 text-center text-sm font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200"
                  aria-label={t.rows}
                />
                {cellInfo && (
                  <span className="text-[10px] text-slate-500 min-w-[35px] text-right">
                    {cellInfo.cellHeight}px
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* X Axis Controls */}
          <div className="bg-white/80 rounded-lg p-3 border border-blue-200/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded w-6 text-center">X</div>
              <span className="text-xs font-semibold text-slate-700">{t.horizontalAxis}</span>
            </div>
            <div className="space-y-3">
              {/* Size/Padding X */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <span>{t.scalePadding} (Padding)</span>
                    <span className="text-[10px] text-slate-400">{t.removeEdge}</span>
                    {sliceSettings.autoOptimized?.paddingX && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-semibold border border-green-200">
                        {t.autoOptimized}
                      </span>
                    )}
                  </label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    sliceSettings.autoOptimized?.paddingX 
                      ? 'text-green-700 bg-green-50 border border-green-200' 
                      : 'text-blue-700 bg-blue-50'
                  }`}>
                    {sliceSettings.paddingX}px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-8 text-right">0</span>
                  <input
                    type="range"
                    min="0"
                    max={Math.floor(sheetDimensions.width * 0.4)}
                    value={sliceSettings.paddingX}
                    onChange={handlePaddingXChange}
                    className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                    aria-label={t.paddingX}
                  />
                  <span className="text-[10px] text-slate-400 w-8">{Math.floor(sheetDimensions.width * 0.4)}</span>
                  <input
                    type="number"
                    min="0"
                    max={Math.floor(sheetDimensions.width * 0.4)}
                    value={sliceSettings.paddingX}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(Math.floor(sheetDimensions.width * 0.4), Number(e.target.value)));
                      setSliceSettings((p) => ({ 
                        ...p, 
                        paddingX: value,
                        autoOptimized: { ...p.autoOptimized, paddingX: false }
                      }));
                    }}
                    className="w-16 text-center text-xs font-semibold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200"
                    aria-label={t.paddingX}
                  />
                </div>
              </div>

              {/* Position/Shift X */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <span>{t.shiftPosition} (Shift)</span>
                    <span className="text-[10px] text-slate-400">{t.fineTunePosition}</span>
                    {sliceSettings.autoOptimized?.shiftX && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-semibold border border-green-200">
                        {t.autoOptimized}
                      </span>
                    )}
                  </label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    sliceSettings.autoOptimized?.shiftX 
                      ? 'text-green-700 bg-green-50 border border-green-200' 
                      : 'text-blue-700 bg-blue-50'
                  }`}>
                    {sliceSettings.shiftX > 0 ? '+' : ''}{sliceSettings.shiftX}px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-8 text-right">-100</span>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={sliceSettings.shiftX}
                    onChange={handleShiftXChange}
                    className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                    aria-label={t.shiftX}
                  />
                  <span className="text-[10px] text-slate-400 w-8">+100</span>
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    value={sliceSettings.shiftX}
                    onChange={(e) => {
                      const value = Math.max(-100, Math.min(100, Number(e.target.value)));
                      setSliceSettings((p) => ({ 
                        ...p, 
                        shiftX: value,
                        autoOptimized: { ...p.autoOptimized, shiftX: false }
                      }));
                    }}
                    className="w-16 text-center text-xs font-semibold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200"
                    aria-label={t.shiftX}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Y Axis Controls */}
          <div className="bg-white/80 rounded-lg p-3 border border-blue-200/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded w-6 text-center">Y</div>
              <span className="text-xs font-semibold text-slate-700">{t.verticalAxis}</span>
            </div>
            <div className="space-y-3">
              {/* Size/Padding Y */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <span>{t.scalePadding} (Padding)</span>
                    <span className="text-[10px] text-slate-400">{t.removeEdge}</span>
                    {sliceSettings.autoOptimized?.paddingY && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-semibold border border-green-200">
                        {t.autoOptimized}
                      </span>
                    )}
                  </label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    sliceSettings.autoOptimized?.paddingY 
                      ? 'text-green-700 bg-green-50 border border-green-200' 
                      : 'text-blue-700 bg-blue-50'
                  }`}>
                    {sliceSettings.paddingY}px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-8 text-right">0</span>
                  <input
                    type="range"
                    min="0"
                    max={Math.floor(sheetDimensions.height * 0.4)}
                    value={sliceSettings.paddingY}
                    onChange={handlePaddingYChange}
                    className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                    aria-label={t.paddingY}
                  />
                  <span className="text-[10px] text-slate-400 w-8">{Math.floor(sheetDimensions.height * 0.4)}</span>
                  <input
                    type="number"
                    min="0"
                    max={Math.floor(sheetDimensions.height * 0.4)}
                    value={sliceSettings.paddingY}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(Math.floor(sheetDimensions.height * 0.4), Number(e.target.value)));
                      setSliceSettings((p) => ({ 
                        ...p, 
                        paddingY: value,
                        autoOptimized: { ...p.autoOptimized, paddingY: false }
                      }));
                    }}
                    className="w-16 text-center text-xs font-semibold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200"
                    aria-label={t.paddingY}
                  />
                </div>
              </div>

              {/* Position/Shift Y */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <span>{t.shiftPosition} (Shift)</span>
                    <span className="text-[10px] text-slate-400">{t.fineTunePosition}</span>
                    {sliceSettings.autoOptimized?.shiftY && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-semibold border border-green-200">
                        {t.autoOptimized}
                      </span>
                    )}
                  </label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    sliceSettings.autoOptimized?.shiftY 
                      ? 'text-green-700 bg-green-50 border border-green-200' 
                      : 'text-blue-700 bg-blue-50'
                  }`}>
                    {sliceSettings.shiftY > 0 ? '+' : ''}{sliceSettings.shiftY}px
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-8 text-right">-100</span>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={sliceSettings.shiftY}
                    onChange={handleShiftYChange}
                    className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                    aria-label={t.shiftY}
                  />
                  <span className="text-[10px] text-slate-400 w-8">+100</span>
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    value={sliceSettings.shiftY}
                    onChange={(e) => {
                      const value = Math.max(-100, Math.min(100, Number(e.target.value)));
                      setSliceSettings((p) => ({ 
                        ...p, 
                        shiftY: value,
                        autoOptimized: { ...p.autoOptimized, shiftY: false }
                      }));
                    }}
                    className="w-16 text-center text-xs font-semibold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200"
                    aria-label={t.shiftY}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Info Summary */}
          {cellInfo && (
            <div className="bg-blue-100/50 rounded-lg p-2.5 border border-blue-300/50">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">{t.cellSize}</span>
                  <span className="font-bold text-blue-700">{cellInfo.cellWidth} × {cellInfo.cellHeight}px</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">{t.effectiveArea}</span>
                  <span className="font-bold text-blue-700">{cellInfo.effectiveWidth} × {cellInfo.effectiveHeight}px</span>
                </div>
                <div className="flex items-center justify-between col-span-2">
                  <span className="text-slate-600">{t.totalFrames}</span>
                  <span className="font-bold text-blue-700">{cellInfo.totalFrames} {t.frames}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SpriteSheetViewer.displayName = 'SpriteSheetViewer';
