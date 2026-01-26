import React, { useCallback } from 'react';
import { Download, Grid3X3, Loader2, Sliders } from './Icons';
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
    setSliceSettings((p) => ({ ...p, paddingX: Number(e.target.value) }));
  }, [setSliceSettings]);

  const handlePaddingYChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliceSettings((p) => ({ ...p, paddingY: Number(e.target.value) }));
  }, [setSliceSettings]);

  const handleShiftXChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliceSettings((p) => ({ ...p, shiftX: Number(e.target.value) }));
  }, [setSliceSettings]);

  const handleShiftYChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliceSettings((p) => ({ ...p, shiftY: Number(e.target.value) }));
  }, [setSliceSettings]);

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
          精靈圖原圖 (Sprite Sheet)
        </h2>
        <div className="flex gap-2">
          {spriteSheetImage && (
            <button
              onClick={onDownload}
              className="text-xs flex items-center gap-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full transition-all duration-200 font-semibold cursor-pointer border border-orange-200 hover:border-orange-300 hover:shadow-sm"
              aria-label="下載精靈圖"
            >
              <Download className="w-3.5 h-3.5" />
              下載原圖
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 min-h-[200px] flex items-center justify-center relative overflow-hidden group">
        {!spriteSheetImage && !isGenerating && (
          <div className="text-center p-6 opacity-60">
            <Grid3X3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">生成的網格原圖將顯示於此</p>
          </div>
        )}

        {!spriteSheetImage && isGenerating && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
            <p className="text-xs text-slate-600 font-medium">生成中...</p>
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

              {/* SVG Overlay: Uses ViewBox to match image's natural dimensions. */}
              {sheetDimensions.width > 0 && (
                <svg
                  viewBox={`0 0 ${sheetDimensions.width} ${sheetDimensions.height}`}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    border: '1px solid rgba(59,130,246,0.3)',
                  }}
                >
                  {/* Draw Outer Rect (Grid Area) - defined by Padding and Shift */}
                  <rect
                    x={sliceSettings.paddingX + sliceSettings.shiftX}
                    y={sliceSettings.paddingY + sliceSettings.shiftY}
                    width={Math.max(0, sheetDimensions.width - sliceSettings.paddingX * 2)}
                    height={Math.max(0, sheetDimensions.height - sliceSettings.paddingY * 2)}
                    fill="none"
                    stroke="rgba(59,130,246,0.6)"
                    strokeWidth="2"
                  />

                  {/* Draw Vertical Grid Lines */}
                  {Array.from({ length: sliceSettings.cols - 1 }).map((_, i) => {
                    const effectiveWidth = sheetDimensions.width - sliceSettings.paddingX * 2;
                    const cellWidth = effectiveWidth / sliceSettings.cols;
                    const startX = sliceSettings.paddingX + sliceSettings.shiftX;
                    const startY = sliceSettings.paddingY + sliceSettings.shiftY;
                    const height = sheetDimensions.height - sliceSettings.paddingY * 2;
                    const x = startX + (i + 1) * cellWidth;
                    return (
                      <line
                        key={`v-${i}`}
                        x1={x}
                        y1={startY}
                        x2={x}
                        y2={startY + height}
                        stroke="rgba(59,130,246,0.5)"
                        strokeWidth="1"
                        strokeDasharray="4 2"
                      />
                    );
                  })}

                  {/* Draw Horizontal Grid Lines */}
                  {Array.from({ length: sliceSettings.rows - 1 }).map((_, i) => {
                    const effectiveHeight = sheetDimensions.height - sliceSettings.paddingY * 2;
                    const cellHeight = effectiveHeight / sliceSettings.rows;
                    const startX = sliceSettings.paddingX + sliceSettings.shiftX;
                    const startY = sliceSettings.paddingY + sliceSettings.shiftY;
                    const width = sheetDimensions.width - sliceSettings.paddingX * 2;
                    const y = startY + (i + 1) * cellHeight;
                    return (
                      <line
                        key={`h-${i}`}
                        x1={startX}
                        y1={y}
                        x2={startX + width}
                        y2={y}
                        stroke="rgba(59,130,246,0.5)"
                        strokeWidth="1"
                        strokeDasharray="4 2"
                      />
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual Slicing Controls Toolbar */}
      {spriteSheetImage && sheetDimensions.width > 0 && (
        <div className="mt-4 p-4 bg-blue-50/60 border border-blue-200 rounded-xl flex flex-col gap-3 text-sm animate-in fade-in slide-in-from-top-2 shadow-sm">
          <div className="flex items-center gap-2 text-blue-800 font-bold border-b border-blue-300 pb-2">
            <Sliders className="w-4 h-4" />
            網格切分設定 (Manual Slicing)
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-blue-200">
              <span className="text-xs text-slate-600 font-medium">Cols</span>
              <input
                type="number"
                min="1"
                max="10"
                value={sliceSettings.cols}
                onChange={handleColsChange}
                className="w-12 text-center text-sm font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded"
                aria-label="列數"
              />
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-blue-200">
              <span className="text-xs text-slate-600 font-medium">Rows</span>
              <input
                type="number"
                min="1"
                max="10"
                value={sliceSettings.rows}
                onChange={handleRowsChange}
                className="w-12 text-center text-sm font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded"
                aria-label="行數"
              />
            </div>
          </div>

          {/* X Axis Controls */}
          <div className="flex items-center gap-4 border-t border-blue-300 pt-3">
            <div className="text-xs font-bold text-blue-600 w-4">X</div>

            {/* Size/Padding X */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] text-slate-600 font-medium w-14">縮放 (Pad)</span>
              <input
                type="range"
                min="0"
                max={Math.floor(sheetDimensions.width * 0.4)}
                value={sliceSettings.paddingX}
                onChange={handlePaddingXChange}
                className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                aria-label="X軸縮放"
              />
              <span className="text-[10px] text-blue-700 w-10 text-right font-bold">{sliceSettings.paddingX}</span>
            </div>

            {/* Position/Shift X */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] text-slate-600 font-medium w-14">位移 (Shift)</span>
              <input
                type="range"
                min={-100}
                max={100}
                value={sliceSettings.shiftX}
                onChange={handleShiftXChange}
                className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                aria-label="X軸位移"
              />
              <span className="text-[10px] text-blue-700 w-10 text-right font-bold">{sliceSettings.shiftX}</span>
            </div>
          </div>

          {/* Y Axis Controls */}
          <div className="flex items-center gap-4 border-t border-blue-300 pt-3">
            <div className="text-xs font-bold text-blue-600 w-4">Y</div>

            {/* Size/Padding Y */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] text-slate-600 font-medium w-14">縮放 (Pad)</span>
              <input
                type="range"
                min="0"
                max={Math.floor(sheetDimensions.height * 0.4)}
                value={sliceSettings.paddingY}
                onChange={handlePaddingYChange}
                className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                aria-label="Y軸縮放"
              />
              <span className="text-[10px] text-blue-700 w-10 text-right font-bold">{sliceSettings.paddingY}</span>
            </div>

            {/* Position/Shift Y */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] text-slate-600 font-medium w-14">位移 (Shift)</span>
              <input
                type="range"
                min={-100}
                max={100}
                value={sliceSettings.shiftY}
                onChange={handleShiftYChange}
                className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                aria-label="Y軸位移"
              />
              <span className="text-[10px] text-blue-700 w-10 text-right font-bold">{sliceSettings.shiftY}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SpriteSheetViewer.displayName = 'SpriteSheetViewer';
