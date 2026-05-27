import React from 'react';
import { Check, Download, ImageIcon } from '../Icons';
import type { Translations } from '../../i18n/types';
import type { ChromaKeyColorType, BgRemovalMethod } from '../../types';
import type { ActionDedupeStrength } from '../../services/gemini/actionDescriptions';
import {
  THEME_PRESETS,
  STYLE_PRESETS,
  STYLE_PRESET_ORDER,
  TEXT_PRESETS,
  FONT_PRESETS,
  FONT_PRESET_ORDER,
  TEXT_COLOR_PRESETS,
  type ThemeOption,
  type LineStickerStyleOption,
  type LineStickerPromptVersion,
  type LineStickerTextRendering,
} from '../../utils/lineStickerPrompt';
import { LINE_STICKER_FRAMES_PER_SHEET } from '../../utils/lineStickerSetSchema';
import type {
  ProgrammaticTextOverlayTuning,
} from '../../utils/lineStickerTextOverlay';
import {
  LineStickerUploadCard,
  type LineStickerUploadCardProps,
} from './LineStickerUploadCard';
import {
  LineStickerPhraseSection,
  type LineStickerPhraseSectionProps,
} from './LineStickerPhraseSection';
import { LineStickerProgrammaticStyleControls } from './LineStickerProgrammaticStyleControls';

export interface LineStickerSettingsConfigViewModel {
  stickerSetMode: boolean;
  onStickerSetModeChange: (value: boolean) => void;
  gridCols: number;
  gridRows: number;
  onGridColsChange: (value: number) => void;
  onGridRowsChange: (value: number) => void;
  selectedStyle: LineStickerStyleOption;
  setSelectedStyle: React.Dispatch<React.SetStateAction<LineStickerStyleOption>>;
  stylePreviewImage: string | null;
  isGeneratingStylePreview: boolean;
  onGenerateStylePreview: () => void;
  onDownloadStylePreview: () => void;
  onUseStylePreviewAsReference: () => void;
  customStyleText: string;
  setCustomStyleText: React.Dispatch<React.SetStateAction<string>>;
  selectedTheme: ThemeOption;
  setSelectedTheme: React.Dispatch<React.SetStateAction<ThemeOption>>;
  customThemeContext: string;
  setCustomThemeContext: React.Dispatch<React.SetStateAction<string>>;
  bgRemovalMethod: BgRemovalMethod;
  setBgRemovalMethod: React.Dispatch<React.SetStateAction<BgRemovalMethod>>;
  chromaKeyColor: ChromaKeyColorType;
  setChromaKeyColor: React.Dispatch<React.SetStateAction<ChromaKeyColorType>>;
  includeText: boolean;
  setIncludeText: React.Dispatch<React.SetStateAction<boolean>>;
  textRendering: LineStickerTextRendering;
  setTextRendering: React.Dispatch<React.SetStateAction<LineStickerTextRendering>>;
  selectedLanguage: keyof typeof TEXT_PRESETS;
  setSelectedLanguage: React.Dispatch<React.SetStateAction<keyof typeof TEXT_PRESETS>>;
  selectedPromptVersion: LineStickerPromptVersion;
  setSelectedPromptVersion: React.Dispatch<React.SetStateAction<LineStickerPromptVersion>>;
  actionDedupeStrength: ActionDedupeStrength;
  setActionDedupeStrength: React.Dispatch<React.SetStateAction<ActionDedupeStrength>>;
  selectedFont: keyof typeof FONT_PRESETS;
  setSelectedFont: React.Dispatch<React.SetStateAction<keyof typeof FONT_PRESETS>>;
  customFontText: string;
  setCustomFontText: React.Dispatch<React.SetStateAction<string>>;
  selectedTextColor: keyof typeof TEXT_COLOR_PRESETS;
  setSelectedTextColor: React.Dispatch<React.SetStateAction<keyof typeof TEXT_COLOR_PRESETS>>;
  programmaticTextTuning: ProgrammaticTextOverlayTuning;
  setProgrammaticTextTuning: React.Dispatch<React.SetStateAction<ProgrammaticTextOverlayTuning>>;
  onResetProgrammaticTextTuning: () => void;
}

export interface LineStickerSettingsPanelViewModel {
  uploadCard: LineStickerUploadCardProps;
  config: LineStickerSettingsConfigViewModel;
  phraseSection: LineStickerPhraseSectionProps;
}

export interface LineStickerSettingsPanelProps {
  t: Translations;
  viewModel: LineStickerSettingsPanelViewModel;
}

function SettingsSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center gap-3 border-t border-slate-100 pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {children}
      </span>
      <span className="h-px min-w-[2rem] flex-1 bg-gradient-to-r from-slate-200/90 to-transparent" aria-hidden />
    </div>
  );
}

const STYLE_PREVIEW_PLACEHOLDER_LABELS: Record<keyof typeof STYLE_PRESETS, string> = {
  matchUploaded: 'Reference Match',
  chibi: 'Chibi',
  pixel: 'Pixel Art',
  minimalist: 'Minimal',
  anime: 'Anime',
  cartoon: 'Cartoon',
  watercolor: 'Watercolor',
  yurukawa: 'Yuru-kawa',
  pastel: 'Pastel',
  flat: 'Flat',
  doodle: 'Doodle',
  gouache: 'Gouache',
  lineChibi: 'LINE Chibi',
};

function resolvePublicAssetPath(assetPath: string): string {
  const baseUrl = import.meta.env.BASE_URL ?? '/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedAssetPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  return `${normalizedBaseUrl}${normalizedAssetPath}`;
}

const STYLE_PREVIEW_IMAGE_MAP: Partial<Record<keyof typeof STYLE_PRESETS, string>> = {
  chibi: resolvePublicAssetPath('style-previews/chibi.png'),
  pixel: resolvePublicAssetPath('style-previews/pixel.png'),
  minimalist: resolvePublicAssetPath('style-previews/minimalist.png'),
  anime: resolvePublicAssetPath('style-previews/anime.png'),
  cartoon: resolvePublicAssetPath('style-previews/cartoon.png'),
  watercolor: resolvePublicAssetPath('style-previews/watercolor.png'),
  yurukawa: resolvePublicAssetPath('style-previews/yurukawa.png'),
  pastel: resolvePublicAssetPath('style-previews/pastel.png'),
  flat: resolvePublicAssetPath('style-previews/flat.png'),
  doodle: resolvePublicAssetPath('style-previews/doodle.png'),
  gouache: resolvePublicAssetPath('style-previews/Gouache.png'),
  lineChibi: resolvePublicAssetPath('style-previews/lineChibi.png'),
};

export const LineStickerSettingsPanel: React.FC<LineStickerSettingsPanelProps> = React.memo(({
  t,
  viewModel,
}) => {
  const { uploadCard, config, phraseSection } = viewModel;
  const programmaticStickerCellCount = config.stickerSetMode
    ? LINE_STICKER_FRAMES_PER_SHEET
    : config.gridCols * config.gridRows;
  const isPresetStyle = config.selectedStyle !== 'custom';
  const previewTitle = isPresetStyle
    ? STYLE_PRESET_ORDER.includes(config.selectedStyle as keyof typeof STYLE_PRESETS)
      ? STYLE_PREVIEW_PLACEHOLDER_LABELS[config.selectedStyle as keyof typeof STYLE_PRESETS]
      : 'Style Preview'
    : 'Custom Style';
  const previewDescription = isPresetStyle
    ? STYLE_PRESETS[config.selectedStyle as keyof typeof STYLE_PRESETS].drawingMethod
    : 'Use your own style description. A preview example will be available here in the future.';
  const selectedStylePreviewImage = isPresetStyle
    ? STYLE_PREVIEW_IMAGE_MAP[config.selectedStyle as keyof typeof STYLE_PRESETS] ?? null
    : null;
  const previewImageSrc = config.stylePreviewImage ?? selectedStylePreviewImage;

  return (
    <div className="space-y-5 lg:sticky lg:top-5 lg:z-10 lg:col-span-5 lg:max-h-[calc(100vh-1.25rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
      <LineStickerUploadCard {...uploadCard} />

      <div className="space-y-1 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-7">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{t.lineStickerGridSettings}</h2>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">{t.lineStickerWorkflowBlurb}</p>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2" id="line-sticker-mode-label">
            {t.lineStickerMode}
          </label>
          <div
            className="flex gap-2 p-1 bg-slate-100 rounded-xl"
            role="radiogroup"
            aria-labelledby="line-sticker-mode-label"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!config.stickerSetMode}
              onClick={() => config.onStickerSetModeChange(false)}
              className={`flex-1 min-h-[44px] rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
                !config.stickerSetMode
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.lineStickerModeSingle}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={config.stickerSetMode}
              onClick={() => config.onStickerSetModeChange(true)}
              className={`flex-1 min-h-[44px] rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
                config.stickerSetMode
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.lineStickerModeSet}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {config.stickerSetMode ? t.lineStickerModeSetHint : t.lineStickerModeSingleHint}
          </p>
        </div>

        {!config.stickerSetMode && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.cols}</label>
              <input
                type="number"
                min="1"
                max="8"
                value={config.gridCols}
                onChange={(event) => config.onGridColsChange(Number(event.target.value))}
                className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.rows}</label>
              <input
                type="number"
                min="1"
                max="8"
                value={config.gridRows}
                onChange={(event) => config.onGridRowsChange(Number(event.target.value))}
                className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}

        <SettingsSectionTitle>{t.lineStickerSectionStylePreview}</SettingsSectionTitle>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerStyleLabel}</label>
            <p className="text-xs text-slate-500 mb-2 leading-relaxed">{t.lineStickerStyleHint}</p>
            <select
              value={config.selectedStyle}
              onChange={(event) => config.setSelectedStyle(event.target.value as LineStickerStyleOption)}
              className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
            >
              {STYLE_PRESET_ORDER.map((key) => (
                <option key={key} value={key}>{key === 'matchUploaded' ? t.lineStickerStyleMatchUploaded : STYLE_PRESETS[key].label}</option>
              ))}
              <option value="custom">{t.lineStickerStyleCustom}</option>
            </select>
            <button
              type="button"
              onClick={config.onGenerateStylePreview}
              disabled={config.isGeneratingStylePreview}
              className={`mt-2 w-full min-h-[40px] rounded-xl px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
                config.isGeneratingStylePreview
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {config.isGeneratingStylePreview ? '產生中...' : '根據上傳圖產生風格預覽'}
            </button>
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-2">Style Preview</span>
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shadow-inner">
              {previewImageSrc ? (
                <img
                  src={previewImageSrc}
                  alt="Style preview"
                  className="h-52 w-full object-contain bg-white"
                />
              ) : (
                <div className="h-52 bg-gradient-to-br from-slate-100 via-white to-emerald-50/40 flex items-center justify-center">
                  <div className="text-center px-3">
                    <p className="text-xs font-semibold text-slate-600 tracking-wide uppercase">{previewTitle}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Placeholder Example</p>
                  </div>
                </div>
              )}
              <div className="px-3 py-2 border-t border-slate-200 bg-white/80">
                <p className="text-xs text-slate-600 line-clamp-3">{previewDescription}</p>
              </div>
              {config.stylePreviewImage ? (
                <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={config.onDownloadStylePreview}
                    className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                  >
                    <Download className="w-4 h-4 shrink-0" aria-hidden />
                    {t.lineStickerStylePreviewDownload}
                  </button>
                  <button
                    type="button"
                    onClick={config.onUseStylePreviewAsReference}
                    className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                  >
                    <ImageIcon className="w-4 h-4 shrink-0" aria-hidden />
                    {t.lineStickerStylePreviewUseAsReference}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {config.selectedStyle === 'custom' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerStyleCustomLabel}</label>
            <textarea
              value={config.customStyleText}
              onChange={(event) => config.setCustomStyleText(event.target.value)}
              placeholder={t.lineStickerStyleCustomPlaceholder}
              className="w-full h-24 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
            />
          </div>
        )}

        <SettingsSectionTitle>{t.lineStickerSectionThemeBg}</SettingsSectionTitle>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerThemeLabel}</label>
          <p className="text-xs text-slate-500 mb-2 leading-relaxed">{t.lineStickerThemeHint}</p>
          <select
            value={config.selectedTheme}
            onChange={(event) => config.setSelectedTheme(event.target.value as ThemeOption)}
            className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
          >
            {Object.keys(THEME_PRESETS).map((key) => <option key={key} value={key}>{THEME_PRESETS[key as keyof typeof THEME_PRESETS].label}</option>)}
            <option value="custom">{t.lineStickerThemeCustom}</option>
          </select>
        </div>

        {config.selectedTheme === 'custom' && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-xs text-slate-500 mb-2">{t.lineStickerCustomThemeHint}</p>
            <textarea
              value={config.customThemeContext}
              onChange={(event) => config.setCustomThemeContext(event.target.value)}
              placeholder={t.lineStickerCustomThemePlaceholder}
              className="w-full h-24 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
            />
          </div>
        )}

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t.bgRemovalMethodLabel}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => config.setBgRemovalMethod('chroma')}
                className={`flex items-center justify-center gap-2 min-h-[44px] p-2.5 rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${config.bgRemovalMethod === 'chroma'
                  ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                  }`}
              >
                <span className="text-sm font-bold">{t.bgRemovalChroma}</span>
              </button>
              <button
                type="button"
                onClick={() => config.setBgRemovalMethod('ai')}
                className={`flex items-center justify-center gap-2 min-h-[44px] p-2.5 rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${config.bgRemovalMethod === 'ai'
                  ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                  }`}
              >
                <span className="text-sm font-bold">{t.bgRemovalAI}</span>
              </button>
            </div>
          </div>

          {config.bgRemovalMethod === 'chroma' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.rmbgChromaKeyLabel}</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => config.setChromaKeyColor('magenta')}
                  className={`flex items-center justify-center gap-2 min-h-[44px] p-2.5 rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2 ${config.chromaKeyColor === 'magenta'
                    ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-sm'
                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                >
                  <div className="w-3 h-3 rounded-full bg-fuchsia-500" />
                  <span className="text-sm font-bold">{t.magentaColor}</span>
                  {config.chromaKeyColor === 'magenta' && <Check className="w-3.5 h-3.5 ml-auto" />}
                </button>
                <button
                  type="button"
                  onClick={() => config.setChromaKeyColor('green')}
                  className={`flex items-center justify-center gap-2 min-h-[44px] p-2.5 rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${config.chromaKeyColor === 'green'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                >
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm font-bold">{t.greenScreen}</span>
                  {config.chromaKeyColor === 'green' && <Check className="w-3.5 h-3.5 ml-auto" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <SettingsSectionTitle>{t.lineStickerSectionStickerText}</SettingsSectionTitle>

        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/70">
          <div className="flex items-start gap-3 border-b border-slate-200/80 p-4">
            <input
              type="checkbox"
              id="includeText"
              checked={config.includeText}
              onChange={(event) => config.setIncludeText(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="includeText" className="cursor-pointer text-sm font-medium leading-snug text-slate-700">
              {t.lineStickerIncludeText}
            </label>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-sm font-medium text-slate-700">{t.lineStickerTextRenderingLabel}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="lineStickerTextRendering"
                  className="shrink-0 text-green-600"
                  checked={config.textRendering === 'model'}
                  onChange={() => config.setTextRendering('model')}
                />
                {t.lineStickerTextRenderingModel}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="lineStickerTextRendering"
                  className="shrink-0 text-green-600"
                  checked={config.textRendering === 'programmatic'}
                  onChange={() => config.setTextRendering('programmatic')}
                />
                {t.lineStickerTextRenderingProgrammatic}
              </label>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">{t.lineStickerTextRenderingHint}</p>
          </div>
        </div>

        {config.textRendering === 'programmatic' && config.includeText && (
          <LineStickerProgrammaticStyleControls
            t={t}
            stickerCellCount={programmaticStickerCellCount}
            selectedFont={config.selectedFont}
            setSelectedFont={config.setSelectedFont}
            selectedTextColor={config.selectedTextColor}
            setSelectedTextColor={config.setSelectedTextColor}
            programmaticTextTuning={config.programmaticTextTuning}
            setProgrammaticTextTuning={config.setProgrammaticTextTuning}
            onResetProgrammaticTextTuning={config.onResetProgrammaticTextTuning}
          />
        )}

        {(config.includeText || config.textRendering === 'programmatic') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerTextLangLabel}</label>
              <p className="text-xs text-slate-500 mb-2">{t.lineStickerTextLangHint}</p>
              <select
                value={config.selectedLanguage}
                onChange={(event) => config.setSelectedLanguage(event.target.value as keyof typeof TEXT_PRESETS)}
                className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
              >
                {Object.keys(TEXT_PRESETS).map((key) => <option key={key} value={key}>{TEXT_PRESETS[key as keyof typeof TEXT_PRESETS].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.lineStickerPromptVersionLabel}
              </label>
              <p className="text-xs text-slate-500 mb-2">
                {t.lineStickerPromptVersionHint}
              </p>
              <select
                value={config.selectedPromptVersion}
                onChange={(event) =>
                  config.setSelectedPromptVersion(
                    event.target.value as LineStickerPromptVersion
                  )
                }
                className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="v1">{t.lineStickerPromptVersionV1}</option>
                <option value="v2">{t.lineStickerPromptVersionV2}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.lineStickerActionDedupeStrengthLabel}
              </label>
              <p className="text-xs text-slate-500 mb-2">
                {t.lineStickerActionDedupeStrengthHint}
              </p>
              <select
                value={config.actionDedupeStrength}
                onChange={(event) =>
                  config.setActionDedupeStrength(
                    event.target.value as ActionDedupeStrength
                  )
                }
                className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="conservative">
                  {t.lineStickerActionDedupeConservative}
                </option>
                <option value="balanced">{t.lineStickerActionDedupeBalanced}</option>
                <option value="aggressive">
                  {t.lineStickerActionDedupeAggressive}
                </option>
              </select>
            </div>
            {config.textRendering !== 'programmatic' && (
            <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerFontStyleLabel}</label>
              <p className="text-xs text-slate-500 mb-2">{t.lineStickerFontStyleHint}</p>
              <select
                value={config.selectedFont}
                onChange={(event) => config.setSelectedFont(event.target.value as keyof typeof FONT_PRESETS)}
                className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm outline-none transition-shadow focus:ring-2 focus:ring-green-500 bg-white"
              >
                {FONT_PRESET_ORDER.map((key) => <option key={key} value={key}>{FONT_PRESETS[key].label}</option>)}
              </select>
            </div>
            {config.selectedFont === 'custom' && (
              <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerFontCustomLabel}</label>
                <textarea
                  value={config.customFontText}
                  onChange={(event) => config.setCustomFontText(event.target.value)}
                  placeholder={t.lineStickerFontCustomPlaceholder}
                  className="w-full h-24 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
                />
              </div>
            )}
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-inner">
              <p className="mb-2 text-xs font-medium text-slate-600">{t.lineStickerFontPreviewCaption}</p>
              <img
                src={resolvePublicAssetPath('font.png')}
                alt=""
                className="w-full max-h-[420px] rounded-lg border border-slate-100 object-contain bg-slate-50"
              />
            </div>
            </>
            )}
          </div>
        )}

        <SettingsSectionTitle>{t.lineStickerSectionPhrasesPrompt}</SettingsSectionTitle>

        <LineStickerPhraseSection {...phraseSection} />
      </div>
    </div>
  );
});

LineStickerSettingsPanel.displayName = 'LineStickerSettingsPanel';