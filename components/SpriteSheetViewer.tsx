import React, { useCallback, useMemo, useState, useRef } from 'react';
import { Download, Grid3X3, Loader2, Sliders, RefreshCw, Move } from './Icons';
import { SliceSettings } from '../utils/imageUtils';
import { GRID_PATTERN_URL } from '../utils/constants';

interface SpriteSheetViewerProps {
  spriteSheetImage: string | null;
  isGenerating: boolean;
  sheetDimensions: { width: number; height: number };
  sliceSettings: SliceSettings;
  setSliceSettings: React.Dispatch<React.SetStateAction<SliceSettings>>;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onDownload: () => void;
  chromaKeyProgress?: number; // Progress of chroma key removal (0-100)
  isProcessingChromaKey?: boolean; // Whether chroma key removal is in progress
}

export const SpriteSheetViewer: React.FC<SpriteSheetViewerProps> = React.memo(({
  spriteSheetImage,
  isGenerating,
  sheetDimensions,
  sliceSettings,
  setSliceSettings,
  onImageLoad,
  onDownload,
  chromaKeyProgress = 0,
  isProcessingChromaKey = false,
}) => {
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

  // Calculate real-time information
  const cellInfo = useMemo(() => {
    if (sheetDimensions.width === 0 || sheetDimensions.height === 0) {
      return null;
    }
    const effectiveWidth = sheetDimensions.width - sliceSettings.paddingX * 2;
    const effectiveHeight = sheetDimensions.height - sliceSettings.paddingY * 2;
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
  }, [sheetDimensions, sliceSettings]);

  // Reset to default settings
  const handleReset = useCallback(() => {
    setSliceSettings({
      cols: sliceSettings.cols, // Keep grid size
      rows: sliceSettings.rows,
      paddingX: 0,
      paddingY: 0,
      shiftX: 0,
      shiftY: 0,
    });
  }, [setSliceSettings, sliceSettings.cols, sliceSettings.rows]);

  // Auto-center: Calculate shift to center the grid
  const handleAutoCenter = useCallback(() => {
    if (sheetDimensions.width === 0 || sheetDimensions.height === 0) return;
    
    const effectiveWidth = sheetDimensions.width - sliceSettings.paddingX * 2;
    const effectiveHeight = sheetDimensions.height - sliceSettings.paddingY * 2;
    const cellWidth = effectiveWidth / sliceSettings.cols;
    const cellHeight = effectiveHeight / sliceSettings.rows;
    
    // Calculate center offset
    const centerX = sheetDimensions.width / 2;
    const centerY = sheetDimensions.height / 2;
    const gridCenterX = sliceSettings.paddingX + (effectiveWidth / 2);
    const gridCenterY = sliceSettings.paddingY + (effectiveHeight / 2);
    
    setSliceSettings((p) => ({
      ...p,
      shiftX: Math.round(centerX - gridCenterX),
      shiftY: Math.round(centerY - gridCenterY),
    }));
  }, [setSliceSettings, sheetDimensions, sliceSettings.paddingX, sliceSettings.paddingY, sliceSettings.cols, sliceSettings.rows]);

  // Interactive grid editing state
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'grid' | 'padding-left' | 'padding-right' | 'padding-top' | 'padding-bottom' | 'shift' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartSettings, setDragStartSettings] = useState<SliceSettings | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate grid positions for interactive editing
  const gridPositions = useMemo(() => {
    if (sheetDimensions.width === 0 || sheetDimensions.height === 0) return null;
    
    const effectiveWidth = sheetDimensions.width - sliceSettings.paddingX * 2;
    const effectiveHeight = sheetDimensions.height - sliceSettings.paddingY * 2;
    const cellWidth = effectiveWidth / sliceSettings.cols;
    const cellHeight = effectiveHeight / sliceSettings.rows;
    const startX = sliceSettings.paddingX + sliceSettings.shiftX;
    const startY = sliceSettings.paddingY + sliceSettings.shiftY;
    
    return {
      startX,
      startY,
      cellWidth,
      cellHeight,
      effectiveWidth,
      effectiveHeight,
    };
  }, [sheetDimensions, sliceSettings]);

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
      // Drag left edge - adjust paddingX
      const newPaddingX = Math.max(0, Math.min(
        sheetDimensions.width * 0.4,
        dragStartSettings.paddingX - svgDeltaX
      ));
      setSliceSettings({
        ...dragStartSettings,
        paddingX: Math.round(newPaddingX),
        autoOptimized: { ...dragStartSettings.autoOptimized, paddingX: false },
      });
    } else if (dragType === 'padding-right') {
      // Drag right edge - adjust paddingX
      const newPaddingX = Math.max(0, Math.min(
        sheetDimensions.width * 0.4,
        dragStartSettings.paddingX + svgDeltaX
      ));
      setSliceSettings({
        ...dragStartSettings,
        paddingX: Math.round(newPaddingX),
        autoOptimized: { ...dragStartSettings.autoOptimized, paddingX: false },
      });
    } else if (dragType === 'padding-top') {
      // Drag top edge - adjust paddingY
      const newPaddingY = Math.max(0, Math.min(
        sheetDimensions.height * 0.4,
        dragStartSettings.paddingY - svgDeltaY
      ));
      setSliceSettings({
        ...dragStartSettings,
        paddingY: Math.round(newPaddingY),
        autoOptimized: { ...dragStartSettings.autoOptimized, paddingY: false },
      });
    } else if (dragType === 'padding-bottom') {
      // Drag bottom edge - adjust paddingY
      const newPaddingY = Math.max(0, Math.min(
        sheetDimensions.height * 0.4,
        dragStartSettings.paddingY + svgDeltaY
      ));
      setSliceSettings({
        ...dragStartSettings,
        paddingY: Math.round(newPaddingY),
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Chroma Key Processing Progress Indicator */}
      {isProcessingChromaKey && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-10">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">正在處理去背...</p>
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
          精靈圖（已去背預覽）
        </h2>
        <div className="flex gap-2">
          {spriteSheetImage && (
            <button
              onClick={onDownload}
              className="text-xs flex items-center gap-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full transition-all duration-200 font-semibold cursor-pointer border border-orange-200 hover:border-orange-300 hover:shadow-sm"
              aria-label="下載精靈圖（已去背）"
            >
              <Download className="w-3.5 h-3.5" />
              下載精靈圖（已去背）
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 min-h-[200px] flex items-center justify-center relative overflow-hidden group select-none">
        {!spriteSheetImage && !isGenerating && !isProcessingChromaKey && (
          <div className="text-center p-6 opacity-60">
            <Grid3X3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">生成的網格原圖將顯示於此（去背後）</p>
          </div>
        )}

        {!spriteSheetImage && (isGenerating || isProcessingChromaKey) && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
            <p className="text-xs text-slate-600 font-medium">
              {isProcessingChromaKey ? '正在處理去背...' : '生成中...'}
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
                src={spriteSheetImage}
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
                    x={sliceSettings.paddingX + sliceSettings.shiftX}
                    y={sliceSettings.paddingY + sliceSettings.shiftY}
                    width={Math.max(0, sheetDimensions.width - sliceSettings.paddingX * 2)}
                    height={Math.max(0, sheetDimensions.height - sliceSettings.paddingY * 2)}
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
                    const effectiveWidth = sheetDimensions.width - sliceSettings.paddingX * 2;
                    const cellWidth = effectiveWidth / sliceSettings.cols;
                    const startX = sliceSettings.paddingX + sliceSettings.shiftX;
                    const startY = sliceSettings.paddingY + sliceSettings.shiftY;
                    const height = sheetDimensions.height - sliceSettings.paddingY * 2;
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
                    const effectiveHeight = sheetDimensions.height - sliceSettings.paddingY * 2;
                    const cellHeight = effectiveHeight / sliceSettings.rows;
                    const startX = sliceSettings.paddingX + sliceSettings.shiftX;
                    const startY = sliceSettings.paddingY + sliceSettings.shiftY;
                    const width = sheetDimensions.width - sliceSettings.paddingX * 2;
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
                      拖動邊框調整大小 · 拖動網格內移動位置
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
              <span>網格切分設定</span>
              <span className="text-xs font-normal text-blue-600 ml-1">(Manual Slicing)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoCenter}
                className="text-xs flex items-center gap-1.5 text-blue-700 bg-blue-100 hover:bg-blue-200 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border border-blue-300 hover:shadow-sm"
                title="自動居中網格"
                aria-label="自動居中"
              >
                <Move className="w-3.5 h-3.5" />
                居中
              </button>
              <button
                onClick={handleReset}
                className="text-xs flex items-center gap-1.5 text-slate-600 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border border-slate-300 hover:shadow-sm"
                title="重置縮放和位移"
                aria-label="重置"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重置
              </button>
            </div>
          </div>

          {/* Grid Size Controls */}
          <div className="bg-white/80 rounded-lg p-3 border border-blue-200/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">網格大小</span>
              {cellInfo && (
                <span className="text-xs text-blue-600 font-medium">
                  {cellInfo.totalFrames} 幀 · {cellInfo.cellWidth}×{cellInfo.cellHeight}px
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 flex-1">
                <span className="text-xs text-slate-600 font-medium min-w-[40px]">列 (Cols)</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sliceSettings.cols}
                  onChange={handleColsChange}
                  className="flex-1 text-center text-sm font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200"
                  aria-label="列數"
                />
                {cellInfo && (
                  <span className="text-[10px] text-slate-500 min-w-[35px] text-right">
                    {cellInfo.cellWidth}px
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 flex-1">
                <span className="text-xs text-slate-600 font-medium min-w-[40px]">行 (Rows)</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sliceSettings.rows}
                  onChange={handleRowsChange}
                  className="flex-1 text-center text-sm font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200"
                  aria-label="行數"
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
              <span className="text-xs font-semibold text-slate-700">水平軸調整</span>
            </div>
            <div className="space-y-3">
              {/* Size/Padding X */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <span>縮放 (Padding)</span>
                    <span className="text-[10px] text-slate-400">去除邊緣</span>
                    {sliceSettings.autoOptimized?.paddingX && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-semibold border border-green-200">
                        自動優化
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
                    aria-label="X軸縮放"
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
                    aria-label="X軸縮放數值"
                  />
                </div>
              </div>

              {/* Position/Shift X */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <span>位移 (Shift)</span>
                    <span className="text-[10px] text-slate-400">微調位置</span>
                    {sliceSettings.autoOptimized?.shiftX && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-semibold border border-green-200">
                        自動優化
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
                    aria-label="X軸位移"
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
                    aria-label="X軸位移數值"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Y Axis Controls */}
          <div className="bg-white/80 rounded-lg p-3 border border-blue-200/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded w-6 text-center">Y</div>
              <span className="text-xs font-semibold text-slate-700">垂直軸調整</span>
            </div>
            <div className="space-y-3">
              {/* Size/Padding Y */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <span>縮放 (Padding)</span>
                    <span className="text-[10px] text-slate-400">去除邊緣</span>
                    {sliceSettings.autoOptimized?.paddingY && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-semibold border border-green-200">
                        自動優化
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
                    aria-label="Y軸縮放"
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
                    aria-label="Y軸縮放數值"
                  />
                </div>
              </div>

              {/* Position/Shift Y */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <span>位移 (Shift)</span>
                    <span className="text-[10px] text-slate-400">微調位置</span>
                    {sliceSettings.autoOptimized?.shiftY && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-semibold border border-green-200">
                        自動優化
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
                    aria-label="Y軸位移"
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
                    aria-label="Y軸位移數值"
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
                  <span className="text-slate-600">單元格大小</span>
                  <span className="font-bold text-blue-700">{cellInfo.cellWidth} × {cellInfo.cellHeight}px</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">有效區域</span>
                  <span className="font-bold text-blue-700">{cellInfo.effectiveWidth} × {cellInfo.effectiveHeight}px</span>
                </div>
                <div className="flex items-center justify-between col-span-2">
                  <span className="text-slate-600">總幀數</span>
                  <span className="font-bold text-blue-700">{cellInfo.totalFrames} 幀</span>
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
