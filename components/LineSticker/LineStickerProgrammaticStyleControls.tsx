import React, { useMemo } from 'react';
import type { Translations } from '../../i18n/types';
import {
  FONT_PRESETS,
  FONT_PRESET_ORDER,
  TEXT_COLOR_PRESETS,
} from '../../utils/lineStickerPrompt';
import type {
  ProgrammaticFontFamilySource,
  ProgrammaticTextOverlayTuning,
  ProgrammaticTextPlacementMode,
} from '../../utils/lineStickerTextOverlay';

export interface LineStickerProgrammaticStyleControlsProps {
  t: Translations;
  /** Suffix for radio `name` attrs so a second instance (e.g. frame-edit portal) does not toggle the left panel. */
  radioNameSuffix?: string;
  /** Optional line under the main tuning title (frame-edit only). */
  frameEditSubtitle?: string;
  selectedFont: keyof typeof FONT_PRESETS;
  setSelectedFont: React.Dispatch<React.SetStateAction<keyof typeof FONT_PRESETS>>;
  selectedTextColor: keyof typeof TEXT_COLOR_PRESETS;
  setSelectedTextColor: React.Dispatch<React.SetStateAction<keyof typeof TEXT_COLOR_PRESETS>>;
  programmaticTextTuning: ProgrammaticTextOverlayTuning;
  setProgrammaticTextTuning: React.Dispatch<React.SetStateAction<ProgrammaticTextOverlayTuning>>;
  onResetProgrammaticTextTuning: () => void;
}

export const LineStickerProgrammaticStyleControls: React.FC<LineStickerProgrammaticStyleControlsProps> = ({
  t,
  radioNameSuffix = '',
  frameEditSubtitle,
  selectedFont,
  setSelectedFont,
  selectedTextColor,
  setSelectedTextColor,
  programmaticTextTuning,
  setProgrammaticTextTuning,
  onResetProgrammaticTextTuning,
}) => {
  const nameFontSource = `programmaticFontSource${radioNameSuffix}`;
  const placementOptions = useMemo(
    () =>
      [
        { value: 'cycle' as const, label: t.lineStickerProgrammaticPlacementCycle },
        { value: 'bottom_center' as const, label: t.lineStickerProgrammaticPlacementBottom },
        { value: 'top_center' as const, label: t.lineStickerProgrammaticPlacementTop },
        { value: 'middle_center' as const, label: t.lineStickerProgrammaticPlacementMiddle },
      ] satisfies { value: ProgrammaticTextPlacementMode; label: string }[],
    [t]
  );

  return (
    <div className="space-y-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{t.lineStickerProgrammaticTuningTitle}</p>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{t.lineStickerProgrammaticTuningHint}</p>
          {frameEditSubtitle ? (
            <p className="text-xs text-emerald-800 font-medium mt-2">{frameEditSubtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onResetProgrammaticTextTuning}
          className="shrink-0 min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          {t.lineStickerProgrammaticResetTuning}
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">{t.lineStickerProgrammaticFontSourceLabel}</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
            <input
              type="radio"
              name={nameFontSource}
              className="text-green-600 shrink-0"
              checked={programmaticTextTuning.fontFamilySource === 'preset'}
              onChange={() =>
                setProgrammaticTextTuning((prev) => ({
                  ...prev,
                  fontFamilySource: 'preset' as ProgrammaticFontFamilySource,
                }))
              }
            />
            {t.lineStickerProgrammaticFontSourcePreset}
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
            <input
              type="radio"
              name={nameFontSource}
              className="text-green-600 shrink-0"
              checked={programmaticTextTuning.fontFamilySource === 'custom'}
              onChange={() =>
                setProgrammaticTextTuning((prev) => ({
                  ...prev,
                  fontFamilySource: 'custom' as ProgrammaticFontFamilySource,
                }))
              }
            />
            {t.lineStickerProgrammaticFontSourceCustom}
          </label>
        </div>
      </div>

      {programmaticTextTuning.fontFamilySource === 'preset' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {t.lineStickerProgrammaticFontPresetLabel}
          </label>
          <select
            value={selectedFont}
            onChange={(event) => setSelectedFont(event.target.value as keyof typeof FONT_PRESETS)}
            className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
          >
            {FONT_PRESET_ORDER.map((key) => (
              <option key={key} value={key}>
                {FONT_PRESETS[key].label}
              </option>
            ))}
          </select>
        </div>
      )}

      {programmaticTextTuning.fontFamilySource === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t.lineStickerProgrammaticFontCustomLabel}
          </label>
          <p className="text-xs text-slate-500 mb-2 leading-relaxed">{t.lineStickerProgrammaticFontCustomHint}</p>
          <textarea
            value={programmaticTextTuning.customFontFamily}
            onChange={(event) =>
              setProgrammaticTextTuning((prev) => ({
                ...prev,
                customFontFamily: event.target.value,
              }))
            }
            placeholder={t.lineStickerProgrammaticFontCustomPlaceholder}
            rows={2}
            className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none resize-y bg-white"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t.lineStickerProgrammaticTextColorLabel}
        </label>
        <select
          value={selectedTextColor}
          onChange={(event) =>
            setSelectedTextColor(event.target.value as keyof typeof TEXT_COLOR_PRESETS)
          }
          className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
        >
          {(Object.keys(TEXT_COLOR_PRESETS) as (keyof typeof TEXT_COLOR_PRESETS)[]).map((key) => (
            <option key={key} value={key}>
              {TEXT_COLOR_PRESETS[key]?.label ?? key}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {t.lineStickerProgrammaticPlacement}
        </label>
        <select
          value={programmaticTextTuning.placementMode}
          onChange={(event) =>
            setProgrammaticTextTuning((prev) => ({
              ...prev,
              placementMode: event.target.value as ProgrammaticTextPlacementMode,
            }))
          }
          className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
        >
          {placementOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {t.lineStickerProgrammaticFontWeight}
        </label>
        <select
          value={programmaticTextTuning.fontWeight}
          onChange={(event) =>
            setProgrammaticTextTuning((prev) => ({
              ...prev,
              fontWeight: Number(event.target.value) as ProgrammaticTextOverlayTuning['fontWeight'],
            }))
          }
          className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
        >
          <option value={400}>400</option>
          <option value={500}>500</option>
          <option value={600}>600</option>
          <option value={700}>700</option>
        </select>
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>{t.lineStickerProgrammaticFontSize}</span>
          <span className="font-mono tabular-nums">{programmaticTextTuning.fontSizePercent.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={4}
          max={20}
          step={0.5}
          value={programmaticTextTuning.fontSizePercent}
          onChange={(event) =>
            setProgrammaticTextTuning((prev) => ({
              ...prev,
              fontSizePercent: Number(event.target.value),
            }))
          }
          className="w-full accent-emerald-600"
        />
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>{t.lineStickerProgrammaticEdgeMargin}</span>
          <span className="font-mono tabular-nums">{programmaticTextTuning.edgeMarginPercent.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={2}
          max={18}
          step={0.5}
          value={programmaticTextTuning.edgeMarginPercent}
          onChange={(event) =>
            setProgrammaticTextTuning((prev) => ({
              ...prev,
              edgeMarginPercent: Number(event.target.value),
            }))
          }
          className="w-full accent-emerald-600"
        />
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>{t.lineStickerProgrammaticLineHeight}</span>
          <span className="font-mono tabular-nums">{programmaticTextTuning.lineHeightMultiplier.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={1}
          max={2}
          step={0.05}
          value={programmaticTextTuning.lineHeightMultiplier}
          onChange={(event) =>
            setProgrammaticTextTuning((prev) => ({
              ...prev,
              lineHeightMultiplier: Number(event.target.value),
            }))
          }
          className="w-full accent-emerald-600"
        />
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>{t.lineStickerProgrammaticStrokeScale}</span>
          <span className="font-mono tabular-nums">{programmaticTextTuning.strokeScale.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2.5}
          step={0.05}
          value={programmaticTextTuning.strokeScale}
          onChange={(event) =>
            setProgrammaticTextTuning((prev) => ({
              ...prev,
              strokeScale: Number(event.target.value),
            }))
          }
          className="w-full accent-emerald-600"
        />
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>{t.lineStickerProgrammaticOffsetX}</span>
          <span className="font-mono tabular-nums">{programmaticTextTuning.offsetXPercent.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={-25}
          max={25}
          step={0.5}
          value={programmaticTextTuning.offsetXPercent}
          onChange={(event) =>
            setProgrammaticTextTuning((prev) => ({
              ...prev,
              offsetXPercent: Number(event.target.value),
            }))
          }
          className="w-full accent-emerald-600"
        />
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>{t.lineStickerProgrammaticOffsetY}</span>
          <span className="font-mono tabular-nums">{programmaticTextTuning.offsetYPercent.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={-25}
          max={25}
          step={0.5}
          value={programmaticTextTuning.offsetYPercent}
          onChange={(event) =>
            setProgrammaticTextTuning((prev) => ({
              ...prev,
              offsetYPercent: Number(event.target.value),
            }))
          }
          className="w-full accent-emerald-600"
        />
      </div>
    </div>
  );
};

LineStickerProgrammaticStyleControls.displayName = 'LineStickerProgrammaticStyleControls';
