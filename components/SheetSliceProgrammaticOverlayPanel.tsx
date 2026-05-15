import React from 'react';
import { FONT_PRESETS, FONT_PRESET_ORDER, TEXT_COLOR_PRESETS } from '../utils/lineStickerPrompt';
import type { ProgrammaticFontFamilySource, ProgrammaticTextOverlayTuning } from '../utils/lineStickerTextOverlay';
import { DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING } from '../utils/lineStickerTextOverlay';
import type { Translations } from '../i18n/types';
import type { SheetSliceOverlayColorKey, SheetSliceOverlayFontKey } from '../hooks/useSheetSliceProgrammaticOverlay';

export interface SheetSliceProgrammaticOverlayPanelProps {
  t: Translations;
  accent: 'teal' | 'orange';
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  linesText: string;
  onLinesTextChange: (value: string) => void;
  fontKey: SheetSliceOverlayFontKey;
  onFontKeyChange: (value: SheetSliceOverlayFontKey) => void;
  colorKey: SheetSliceOverlayColorKey;
  onColorKeyChange: (value: SheetSliceOverlayColorKey) => void;
  tuning: ProgrammaticTextOverlayTuning;
  onTuningChange: React.Dispatch<React.SetStateAction<ProgrammaticTextOverlayTuning>>;
}

const focusRing: Record<SheetSliceProgrammaticOverlayPanelProps['accent'], string> = {
  teal: 'focus:ring-teal-500/30 focus:border-teal-500',
  orange: 'focus:ring-orange-500/30 focus:border-orange-500',
};

export const SheetSliceProgrammaticOverlayPanel: React.FC<SheetSliceProgrammaticOverlayPanelProps> = ({
  t,
  accent,
  enabled,
  onEnabledChange,
  linesText,
  onLinesTextChange,
  fontKey,
  onFontKeyChange,
  colorKey,
  onColorKeyChange,
  tuning,
  onTuningChange,
}) => {
  const ring = focusRing[accent];
  const borderAccent =
    accent === 'teal' ? 'border-teal-100 bg-teal-50/40' : 'border-orange-100 bg-orange-50/40';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${borderAccent}`}>
      <div className="flex items-start gap-3">
        <input
          id="sheet-slice-overlay-enable"
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="mt-1 rounded border-slate-300 text-teal-600 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor="sheet-slice-overlay-enable" className="text-sm font-semibold text-slate-800 cursor-pointer">
            {t.sheetSliceProgrammaticOverlayEnable}
          </label>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{t.sheetSliceProgrammaticOverlayHint}</p>
        </div>
      </div>

      {enabled && (
        <div className="space-y-3 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {t.sheetSliceProgrammaticOverlayLabels}
            </label>
            <textarea
              value={linesText}
              onChange={(e) => onLinesTextChange(e.target.value)}
              rows={6}
              placeholder={t.sheetSliceProgrammaticOverlayPlaceholder}
              className={`w-full p-3 border border-slate-200 rounded-xl text-sm outline-none resize-y bg-white ${ring}`}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-2">{t.sheetSliceProgrammaticOverlayFontSource}</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="radio"
                  name="sheetSliceOverlayFontSrc"
                  className="text-teal-600 shrink-0"
                  checked={tuning.fontFamilySource === 'preset'}
                  onChange={() =>
                    onTuningChange((prev) => ({ ...prev, fontFamilySource: 'preset' as ProgrammaticFontFamilySource }))
                  }
                />
                {t.lineStickerProgrammaticFontSourcePreset}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="radio"
                  name="sheetSliceOverlayFontSrc"
                  className="text-teal-600 shrink-0"
                  checked={tuning.fontFamilySource === 'custom'}
                  onChange={() =>
                    onTuningChange((prev) => ({ ...prev, fontFamilySource: 'custom' as ProgrammaticFontFamilySource }))
                  }
                />
                {t.lineStickerProgrammaticFontSourceCustom}
              </label>
            </div>
          </div>

          {tuning.fontFamilySource === 'preset' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {t.sheetSliceProgrammaticOverlayFont}
              </label>
              <select
                value={fontKey}
                onChange={(e) => onFontKeyChange(e.target.value as SheetSliceOverlayFontKey)}
                className={`w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm bg-white outline-none ${ring}`}
              >
                {FONT_PRESET_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {FONT_PRESETS[key].label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tuning.fontFamilySource === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {t.lineStickerProgrammaticFontCustomLabel}
              </label>
              <p className="text-[10px] text-slate-500 mb-1">{t.lineStickerProgrammaticFontCustomHint}</p>
              <textarea
                value={tuning.customFontFamily}
                onChange={(e) => onTuningChange((prev) => ({ ...prev, customFontFamily: e.target.value }))}
                placeholder={t.lineStickerProgrammaticFontCustomPlaceholder}
                rows={2}
                className={`w-full p-2 border border-slate-200 rounded-xl text-sm font-mono bg-white outline-none ${ring}`}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {t.sheetSliceProgrammaticOverlayColor}
            </label>
            <select
              value={colorKey}
              onChange={(e) => onColorKeyChange(e.target.value as SheetSliceOverlayColorKey)}
              className={`w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm bg-white outline-none ${ring}`}
            >
              {(Object.keys(TEXT_COLOR_PRESETS) as SheetSliceOverlayColorKey[]).map((key) => (
                <option key={key} value={key}>
                  {TEXT_COLOR_PRESETS[key]?.label ?? key}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-600">{t.lineStickerProgrammaticFontSize}</span>
            <button
              type="button"
              onClick={() => onTuningChange({ ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING })}
              className="text-xs font-semibold text-slate-600 hover:text-slate-800 underline"
            >
              {t.lineStickerProgrammaticResetTuning}
            </button>
          </div>
          <input
            type="range"
            min={4}
            max={16}
            step={0.25}
            value={tuning.fontSizePercent}
            onChange={(e) => onTuningChange((prev) => ({ ...prev, fontSizePercent: Number(e.target.value) }))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />

          <div>
            <span className="text-xs text-slate-600">{t.lineStickerProgrammaticPlacement}</span>
            <select
              value={tuning.placementMode}
              onChange={(e) =>
                onTuningChange((prev) => ({
                  ...prev,
                  placementMode: e.target.value as ProgrammaticTextOverlayTuning['placementMode'],
                }))
              }
              className={`w-full mt-1 min-h-[40px] px-3 border border-slate-200 rounded-xl text-sm bg-white outline-none ${ring}`}
            >
              <option value="cycle">{t.lineStickerProgrammaticPlacementCycle}</option>
              <option value="bottom_center">{t.lineStickerProgrammaticPlacementBottom}</option>
              <option value="top_center">{t.lineStickerProgrammaticPlacementTop}</option>
              <option value="middle_center">{t.lineStickerProgrammaticPlacementMiddle}</option>
              <option value="auto_avoid_subject">{t.lineStickerProgrammaticPlacementAutoAvoidSubject}</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

SheetSliceProgrammaticOverlayPanel.displayName = 'SheetSliceProgrammaticOverlayPanel';
