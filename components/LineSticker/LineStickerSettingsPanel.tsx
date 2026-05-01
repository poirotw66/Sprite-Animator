import React from 'react';
import { Check } from '../Icons';
import type { Translations } from '../../i18n/types';
import type { ChromaKeyColorType, BgRemovalMethod } from '../../types';
import type { StickerPhraseMode } from '../../utils/constants';
import {
  THEME_PRESETS,
  STYLE_PRESETS,
  STYLE_PRESET_ORDER,
  TEXT_PRESETS,
  FONT_PRESETS,
  FONT_PRESET_ORDER,
  type ThemeOption,
  type LineStickerStyleOption,
} from '../../utils/lineStickerPrompt';
import {
  LineStickerUploadCard,
  type LineStickerUploadCardProps,
} from './LineStickerUploadCard';
import {
  LineStickerPhraseSection,
  type LineStickerPhraseSectionProps,
} from './LineStickerPhraseSection';

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
  customStyleText: string;
  setCustomStyleText: React.Dispatch<React.SetStateAction<string>>;
  selectedTheme: ThemeOption;
  setSelectedTheme: React.Dispatch<React.SetStateAction<ThemeOption>>;
  customThemeContext: string;
  setCustomThemeContext: React.Dispatch<React.SetStateAction<string>>;
  customThemeScenario: string;
  setCustomThemeScenario: React.Dispatch<React.SetStateAction<string>>;
  bgRemovalMethod: BgRemovalMethod;
  setBgRemovalMethod: React.Dispatch<React.SetStateAction<BgRemovalMethod>>;
  chromaKeyColor: ChromaKeyColorType;
  setChromaKeyColor: React.Dispatch<React.SetStateAction<ChromaKeyColorType>>;
  includeText: boolean;
  setIncludeText: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLanguage: keyof typeof TEXT_PRESETS;
  setSelectedLanguage: React.Dispatch<React.SetStateAction<keyof typeof TEXT_PRESETS>>;
  selectedFont: keyof typeof FONT_PRESETS;
  setSelectedFont: React.Dispatch<React.SetStateAction<keyof typeof FONT_PRESETS>>;
  selectedPhraseMode: StickerPhraseMode;
  setSelectedPhraseMode: React.Dispatch<React.SetStateAction<StickerPhraseMode>>;
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

export const LineStickerSettingsPanel: React.FC<LineStickerSettingsPanelProps> = React.memo(({
  t,
  viewModel,
}) => {
  const { uploadCard, config, phraseSection } = viewModel;
  const isPresetStyle = config.selectedStyle !== 'custom';
  const previewTitle = isPresetStyle
    ? STYLE_PRESET_ORDER.includes(config.selectedStyle as keyof typeof STYLE_PRESETS)
      ? STYLE_PREVIEW_PLACEHOLDER_LABELS[config.selectedStyle as keyof typeof STYLE_PRESETS]
      : 'Style Preview'
    : 'Custom Style';
  const previewDescription = isPresetStyle
    ? STYLE_PRESETS[config.selectedStyle as keyof typeof STYLE_PRESETS].drawingMethod
    : 'Use your own style description. A preview example will be available here in the future.';

  return (
    <div className="lg:col-span-5 space-y-6">
      <LineStickerUploadCard {...uploadCard} />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{t.lineStickerGridSettings}</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerMode}</label>
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => config.onStickerSetModeChange(false)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!config.stickerSetMode ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t.lineStickerModeSingle}</button>
            <button onClick={() => config.onStickerSetModeChange(true)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${config.stickerSetMode ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t.lineStickerModeSet}</button>
          </div>
        </div>

        {!config.stickerSetMode && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.cols}</label>
              <input
                type="number"
                min="1"
                max="8"
                value={config.gridCols}
                onChange={(event) => config.onGridColsChange(Number(event.target.value))}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerStyleLabel}</label>
            <select value={config.selectedStyle} onChange={(event) => config.setSelectedStyle(event.target.value as LineStickerStyleOption)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500">
              {STYLE_PRESET_ORDER.map((key) => (
                <option key={key} value={key}>{key === 'matchUploaded' ? t.lineStickerStyleMatchUploaded : STYLE_PRESETS[key].label}</option>
              ))}
              <option value="custom">{t.lineStickerStyleCustom}</option>
            </select>
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-2">Style Preview</span>
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              {config.stylePreviewImage ? (
                <img
                  src={config.stylePreviewImage}
                  alt="Style preview"
                  className="h-28 w-full object-cover bg-white"
                />
              ) : (
                <div className="h-28 bg-gradient-to-br from-slate-200 via-slate-100 to-white flex items-center justify-center">
                  <div className="text-center px-3">
                    <p className="text-xs font-semibold text-slate-600 tracking-wide uppercase">{previewTitle}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Placeholder Example</p>
                  </div>
                </div>
              )}
              <div className="px-3 py-2 border-t border-slate-200">
                <p className="text-xs text-slate-600 line-clamp-2">{previewDescription}</p>
                <button
                  onClick={config.onGenerateStylePreview}
                  disabled={config.isGeneratingStylePreview}
                  className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    config.isGeneratingStylePreview
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {config.isGeneratingStylePreview ? '產生中...' : '根據上傳圖產生風格預覽'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {config.selectedStyle === 'custom' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerStyleCustomLabel}</label>
            <textarea
              value={config.customStyleText}
              onChange={(event) => config.setCustomStyleText(event.target.value)}
              placeholder={t.lineStickerStyleCustomPlaceholder}
              className="w-full h-20 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerThemeLabel}</label>
          <select value={config.selectedTheme} onChange={(event) => config.setSelectedTheme(event.target.value as ThemeOption)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500">
            {Object.keys(THEME_PRESETS).map((key) => <option key={key} value={key}>{THEME_PRESETS[key as keyof typeof THEME_PRESETS].label}</option>)}
            <option value="custom">{t.lineStickerThemeCustom}</option>
          </select>
        </div>

        {config.selectedTheme === 'custom' && (
          <>
            <textarea value={config.customThemeContext} onChange={(event) => config.setCustomThemeContext(event.target.value)} placeholder={t.lineStickerCustomThemePlaceholder} className="w-full h-20 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" />
            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">{t.lineStickerCustomThemeScenarioLabel}</label>
              <input type="text" value={config.customThemeScenario} onChange={(event) => config.setCustomThemeScenario(event.target.value)} placeholder={t.lineStickerCustomThemeScenarioPlaceholder} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          </>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t.bgRemovalMethodLabel}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => config.setBgRemovalMethod('chroma')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${config.bgRemovalMethod === 'chroma'
                  ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                  }`}
              >
                <span className="text-sm font-bold">{t.bgRemovalChroma}</span>
              </button>
              <button
                onClick={() => config.setBgRemovalMethod('ai')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${config.bgRemovalMethod === 'ai'
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
                  onClick={() => config.setChromaKeyColor('magenta')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${config.chromaKeyColor === 'magenta'
                    ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-sm'
                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                >
                  <div className="w-3 h-3 rounded-full bg-fuchsia-500" />
                  <span className="text-sm font-bold">{t.magentaColor}</span>
                  {config.chromaKeyColor === 'magenta' && <Check className="w-3.5 h-3.5 ml-auto" />}
                </button>
                <button
                  onClick={() => config.setChromaKeyColor('green')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${config.chromaKeyColor === 'green'
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

        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <input
            type="checkbox"
            id="includeText"
            checked={config.includeText}
            onChange={(event) => config.setIncludeText(event.target.checked)}
            className="w-5 h-5 text-green-600 border-slate-300 rounded focus:ring-green-500 cursor-pointer"
          />
          <label htmlFor="includeText" className="text-sm font-medium text-slate-700 cursor-pointer">
            {t.lineStickerIncludeText}
          </label>
        </div>

        {config.includeText && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerTextLangLabel}</label>
              <select value={config.selectedLanguage} onChange={(event) => config.setSelectedLanguage(event.target.value as keyof typeof TEXT_PRESETS)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                {Object.keys(TEXT_PRESETS).map((key) => <option key={key} value={key}>{TEXT_PRESETS[key as keyof typeof TEXT_PRESETS].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerFontStyleLabel}</label>
              <select value={config.selectedFont} onChange={(event) => config.setSelectedFont(event.target.value as keyof typeof FONT_PRESETS)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500">
                {FONT_PRESET_ORDER.map((key) => <option key={key} value={key}>{FONT_PRESETS[key].label}</option>)}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t.lineStickerPhraseStyle}</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'balanced', label: t.lineStickerPhraseBalanced },
              { id: 'emotional', label: t.lineStickerPhraseEmotional },
              { id: 'meme', label: t.lineStickerPhraseMeme },
              { id: 'interaction', label: t.lineStickerPhraseInteraction },
              { id: 'theme-deep', label: t.lineStickerPhraseThemeDeep },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => config.setSelectedPhraseMode(mode.id as StickerPhraseMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${config.selectedPhraseMode === mode.id
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-green-200'
                  }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <LineStickerPhraseSection {...phraseSection} />
      </div>
    </div>
  );
});

LineStickerSettingsPanel.displayName = 'LineStickerSettingsPanel';