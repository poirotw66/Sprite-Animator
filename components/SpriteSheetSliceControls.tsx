import React from 'react';
import { Sliders, RefreshCw, Move, RotateCcw, RotateCw } from './Icons';
import { SliceSettings } from '../utils/imageUtils';
import { useLanguage } from '../hooks/useLanguage';
import type { DrawLineTool } from './ManualSliceOverlay';
import type { RectMarqueeTool } from './RectMarqueeOverlay';

/** Real-time grid metrics computed by the parent viewer. */
export interface SliceCellInfo {
  cellWidth: number;
  cellHeight: number;
  totalFrames: number;
  effectiveWidth: number;
  effectiveHeight: number;
}

interface SpriteSheetSliceControlsProps {
  sliceSettings: SliceSettings;
  setSliceSettings: React.Dispatch<React.SetStateAction<SliceSettings>>;
  sheetDimensions: { width: number; height: number };
  cellInfo: SliceCellInfo | null;
  lockGridSize: boolean;
  onColsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRowsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPaddingXChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPaddingYChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShiftXChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShiftYChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoCenter: () => void;
  onReset: () => void;
  drawLineTool?: DrawLineTool;
  onDrawLineToolChange?: (tool: DrawLineTool) => void;
  onToggleManualDraw?: () => void;
  onSeedEqualManual?: () => void;
  onClearManualLines?: () => void;
  onUndoManual?: () => void;
  onRedoManual?: () => void;
  canUndoManual?: boolean;
  canRedoManual?: boolean;
  rectMarqueeTool?: RectMarqueeTool;
  onRectMarqueeToolChange?: (tool: RectMarqueeTool) => void;
  onToggleRectsMode?: () => void;
  onClearRectBoxes?: () => void;
  /** Visual accent for Parting (teal) vs default sprite tools (blue). */
  accent?: 'blue' | 'teal';
  /** When true, hide the equal/ownership/manual toggle row (parent owns mode strip). */
  hideModeToggle?: boolean;
}

/**
 * Manual slicing controls toolbar (grid size, X/Y padding & shift, info summary).
 * Pure presentational block extracted from SpriteSheetViewer; all state lives in the parent.
 */
export const SpriteSheetSliceControls: React.FC<SpriteSheetSliceControlsProps> = ({
  sliceSettings,
  setSliceSettings,
  sheetDimensions,
  cellInfo,
  lockGridSize,
  onColsChange,
  onRowsChange,
  onPaddingXChange,
  onPaddingYChange,
  onShiftXChange,
  onShiftYChange,
  onAutoCenter,
  onReset,
  drawLineTool = 'vertical',
  onDrawLineToolChange,
  onToggleManualDraw,
  onSeedEqualManual,
  onClearManualLines,
  onUndoManual,
  onRedoManual,
  canUndoManual = false,
  canRedoManual = false,
  rectMarqueeTool = 'draw',
  onRectMarqueeToolChange,
  onToggleRectsMode,
  onClearRectBoxes,
  accent = 'blue',
  hideModeToggle = false,
}) => {
  const { t } = useLanguage();
  const ownershipOn = sliceSettings.sliceMode === 'ownership';
  const manualOn = sliceSettings.sliceMode === 'manual';
  const rectsOn = sliceSettings.sliceMode === 'rects';
  const hideGridInputs = manualOn || rectsOn;
  const modeLabel = rectsOn
    ? t.sliceModeRects
    : manualOn
      ? t.sliceModeManual
      : ownershipOn
        ? t.sliceModeOwnership
        : t.sliceModeEqual;
  const shellClass =
    accent === 'teal'
      ? 'mt-4 p-5 bg-gradient-to-br from-teal-50/80 to-cyan-50/60 border border-teal-200 rounded-xl flex flex-col gap-4 text-sm animate-in fade-in slide-in-from-top-2 shadow-md'
      : 'mt-4 p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 border border-blue-200 rounded-xl flex flex-col gap-4 text-sm animate-in fade-in slide-in-from-top-2 shadow-md';
  const titleClass = accent === 'teal' ? 'text-teal-900' : 'text-blue-900';
  const borderClass = accent === 'teal' ? 'border-teal-300' : 'border-blue-300';
  const mutedClass = accent === 'teal' ? 'text-teal-600' : 'text-blue-600';

  return (
    <div className={shellClass}>
      {/* Header with Actions */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b ${borderClass} pb-3`}>
        <div className={`flex items-center gap-2 ${titleClass} font-bold`}>
          <Sliders className="w-5 h-5" />
          <span>{t.gridSliceSettings}</span>
          <span className={`text-xs font-normal ${mutedClass} ml-1`}>({modeLabel})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!hideModeToggle && (
            <>
          <button
            type="button"
            onClick={onToggleRectsMode}
            className={`text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border ${
              rectsOn
                ? 'text-white bg-emerald-600 border-emerald-700 hover:bg-emerald-700'
                : 'text-emerald-800 bg-emerald-100 border-emerald-300 hover:bg-emerald-200'
            }`}
            title={t.sliceModeRectsHint}
            aria-pressed={rectsOn}
            aria-label={t.sliceModeRects}
          >
            {t.sliceModeRects}
          </button>
          <button
            type="button"
            onClick={onToggleManualDraw}
            className={`text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border ${
              manualOn
                ? 'text-white bg-orange-600 border-orange-700 hover:bg-orange-700'
                : 'text-orange-800 bg-orange-100 border-orange-300 hover:bg-orange-200'
            }`}
            title={t.sliceModeManualHint}
            aria-pressed={manualOn}
            aria-label={t.sliceModeManual}
          >
            {t.sliceModeManual}
          </button>
          <button
            type="button"
            onClick={() =>
              setSliceSettings((prev) => ({
                ...prev,
                sliceMode:
                  prev.sliceMode === 'ownership'
                    ? 'equal'
                    : prev.sliceMode === 'manual' || prev.sliceMode === 'rects'
                      ? prev.sliceMode
                      : 'ownership',
                inferredCellRects:
                  prev.sliceMode === 'ownership' || prev.sliceMode === 'rects'
                    ? prev.inferredCellRects
                    : undefined,
              }))
            }
            disabled={manualOn || rectsOn}
            className={`text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border disabled:opacity-40 disabled:cursor-not-allowed ${
              ownershipOn
                ? 'text-white bg-blue-600 border-blue-700 hover:bg-blue-700'
                : 'text-blue-700 bg-blue-100 border-blue-300 hover:bg-blue-200'
            }`}
            title={t.sliceModeOwnershipHint}
            aria-pressed={ownershipOn}
            aria-label={t.sliceModeOwnership}
          >
            {t.sliceModeOwnership}
          </button>
            </>
          )}
          <button
            onClick={onAutoCenter}
            disabled={manualOn || rectsOn}
            className="text-xs flex items-center gap-1.5 text-blue-700 bg-blue-100 hover:bg-blue-200 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border border-blue-300 hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title={t.autoCenter}
            aria-label={t.autoCenter}
          >
            <Move className="w-3.5 h-3.5" />
            {t.center}
          </button>
          <button
            onClick={onReset}
            className="text-xs flex items-center gap-1.5 text-slate-600 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition-all duration-200 font-medium cursor-pointer border border-slate-300 hover:shadow-sm"
            title={t.resetScaleAndShift}
            aria-label={t.resetSettings}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t.resetSettings}
          </button>
        </div>
      </div>

      {rectsOn && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 space-y-2">
          <p className="text-xs text-emerald-900 leading-relaxed">{t.sliceModeRectsHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-emerald-900">{t.sliceModeManualDraw}</span>
            <button
              type="button"
              onClick={() => onRectMarqueeToolChange?.('draw')}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
                rectMarqueeTool === 'draw'
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-white text-emerald-800 border-emerald-300'
              }`}
              aria-pressed={rectMarqueeTool === 'draw'}
            >
              {t.sliceModeRectsDraw}
            </button>
            <button
              type="button"
              onClick={() => onRectMarqueeToolChange?.('delete')}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
                rectMarqueeTool === 'delete'
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-white text-red-700 border-red-300'
              }`}
              aria-pressed={rectMarqueeTool === 'delete'}
              title={t.sliceModeRectsHintDelete}
            >
              {t.sliceModeRectsDelete}
            </button>
            <button
              type="button"
              onClick={onUndoManual}
              disabled={!canUndoManual}
              className="text-xs px-2.5 py-1 rounded-md border border-emerald-300 bg-white text-emerald-800 font-medium hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
              title={t.sliceModeManualUndo}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t.sliceModeManualUndo}
            </button>
            <button
              type="button"
              onClick={onRedoManual}
              disabled={!canRedoManual}
              className="text-xs px-2.5 py-1 rounded-md border border-emerald-300 bg-white text-emerald-800 font-medium hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
              title={t.sliceModeManualRedo}
            >
              <RotateCw className="w-3.5 h-3.5" />
              {t.sliceModeManualRedo}
            </button>
            <button
              type="button"
              onClick={onClearRectBoxes}
              className="text-xs px-2.5 py-1 rounded-md border border-emerald-300 bg-white text-emerald-800 font-medium hover:bg-emerald-100"
            >
              {t.sliceModeRectsClear}
            </button>
            <span className="text-[10px] text-emerald-700/80 ml-auto">{t.sliceModeRectsHotkeys}</span>
          </div>
          {cellInfo && (
            <p className="text-[11px] text-emerald-800 font-medium">
              {cellInfo.totalFrames} {t.frames}
            </p>
          )}
        </div>
      )}

      {manualOn && (
        <div className="rounded-lg border border-orange-200 bg-orange-50/90 px-3 py-2 space-y-2">
          <p className="text-xs text-orange-900 leading-relaxed">{t.sliceModeManualHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-orange-900">{t.sliceModeManualDraw}</span>
            <button
              type="button"
              onClick={() => onDrawLineToolChange?.('vertical')}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
                drawLineTool === 'vertical'
                  ? 'bg-orange-600 text-white border-orange-700'
                  : 'bg-white text-orange-800 border-orange-300'
              }`}
              aria-pressed={drawLineTool === 'vertical'}
            >
              {t.sliceModeManualVertical}
            </button>
            <button
              type="button"
              onClick={() => onDrawLineToolChange?.('horizontal')}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
                drawLineTool === 'horizontal'
                  ? 'bg-orange-600 text-white border-orange-700'
                  : 'bg-white text-orange-800 border-orange-300'
              }`}
              aria-pressed={drawLineTool === 'horizontal'}
            >
              {t.sliceModeManualHorizontal}
            </button>
            <button
              type="button"
              onClick={() => onDrawLineToolChange?.('delete')}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
                drawLineTool === 'delete'
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-white text-red-700 border-red-300'
              }`}
              aria-pressed={drawLineTool === 'delete'}
              title={t.sliceModeManualHintDelete}
            >
              {t.sliceModeManualDelete}
            </button>
            <button
              type="button"
              onClick={onUndoManual}
              disabled={!canUndoManual}
              className="text-xs px-2.5 py-1 rounded-md border border-orange-300 bg-white text-orange-800 font-medium hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
              title={t.sliceModeManualUndo}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t.sliceModeManualUndo}
            </button>
            <button
              type="button"
              onClick={onRedoManual}
              disabled={!canRedoManual}
              className="text-xs px-2.5 py-1 rounded-md border border-orange-300 bg-white text-orange-800 font-medium hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
              title={t.sliceModeManualRedo}
            >
              <RotateCw className="w-3.5 h-3.5" />
              {t.sliceModeManualRedo}
            </button>
            <button
              type="button"
              onClick={onClearManualLines}
              className="text-xs px-2.5 py-1 rounded-md border border-orange-300 bg-white text-orange-800 font-medium hover:bg-orange-100"
            >
              {t.sliceModeManualClear}
            </button>
            <button
              type="button"
              onClick={onSeedEqualManual}
              className="text-xs px-2.5 py-1 rounded-md border border-orange-300 bg-white text-orange-800 font-medium hover:bg-orange-100"
            >
              {t.sliceModeManualSeedEqual}
            </button>
            <span className="text-[10px] text-orange-700/80 ml-auto">{t.sliceModeManualHotkeys}</span>
          </div>
          {cellInfo && (
            <p className="text-[11px] text-orange-800 font-medium">
              {cellInfo.totalFrames} {t.frames} · {sliceSettings.cols}×{sliceSettings.rows}
            </p>
          )}
        </div>
      )}

      {ownershipOn && !manualOn && !rectsOn && (
        <p className="text-xs text-blue-800 bg-blue-50/90 border border-blue-200 rounded-lg px-3 py-2 leading-relaxed">
          {t.sliceModeOwnershipHint}
        </p>
      )}

      {/* Grid Size Controls — hidden in manual / rects mode */}
      {!hideGridInputs && (
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
              onChange={onColsChange}
              disabled={lockGridSize}
              className="flex-1 text-center text-sm font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
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
              onChange={onRowsChange}
              disabled={lockGridSize}
              className="flex-1 text-center text-sm font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-400 rounded bg-white px-2 py-1 border border-blue-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
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
      )}

      {/* X / Y padding & shift (equal / ownership grid only) */}
      {!hideGridInputs && (
        <>
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
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${sliceSettings.autoOptimized?.paddingX
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
                onChange={onPaddingXChange}
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
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${sliceSettings.autoOptimized?.shiftX
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
                onChange={onShiftXChange}
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
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${sliceSettings.autoOptimized?.paddingY
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
                onChange={onPaddingYChange}
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
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${sliceSettings.autoOptimized?.shiftY
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
                onChange={onShiftYChange}
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
        </>
      )}

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
  );
};
