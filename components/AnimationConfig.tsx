import React, { useCallback } from 'react';
import { Play, Layers, Zap, Eraser, Wand2, Loader2, Film as FilmIcon, Grid3X3 } from './Icons';
import { AnimationConfig, ChromaKeyColorType, ExampleData } from '../types';
import { ANIMATION_FPS_MULTIPLIER, CHROMA_KEY_COLORS, EXAMPLE_DATA } from '../utils/constants';
import { ExampleSelector } from './ExampleSelector';

interface AnimationConfigPanelProps {
  config: AnimationConfig;
  setConfig: React.Dispatch<React.SetStateAction<AnimationConfig>>;
  removeBackground: boolean;
  setRemoveBackground: (value: boolean) => void;
  isGenerating: boolean;
  statusText: string;
  error: string | null;
  onGenerate: () => void;
}

export const AnimationConfigPanel: React.FC<AnimationConfigPanelProps> = React.memo(({
  config,
  setConfig,
  removeBackground,
  setRemoveBackground,
  isGenerating,
  statusText,
  error,
  onGenerate,
}) => {
  const handleModeChange = useCallback((mode: 'frame' | 'sheet') => {
    setConfig((prev) => ({ ...prev, mode }));
  }, [setConfig]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig((prev) => ({ ...prev, prompt: e.target.value }));
  }, [setConfig]);

  const handleFrameCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, frameCount: Number(e.target.value) }));
  }, [setConfig]);

  const handleGridColsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, gridCols: Number(e.target.value) }));
  }, [setConfig]);

  const handleGridRowsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, gridRows: Number(e.target.value) }));
  }, [setConfig]);

  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, speed: Number(e.target.value) }));
  }, [setConfig]);

  const handleScaleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, scale: Number(e.target.value) }));
  }, [setConfig]);

  const handleChromaKeyColorChange = useCallback((color: ChromaKeyColorType) => {
    setConfig((prev) => ({ ...prev, chromaKeyColor: color }));
  }, [setConfig]);

  const handleInterpolationToggle = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, enableInterpolation: enabled }));
  }, [setConfig]);

  const handleSelectExample = useCallback((example: ExampleData) => {
    setConfig((prev) => ({
      ...prev,
      prompt: example.prompt,
      chromaKeyColor: example.chromaKeyColor,
      gridCols: example.gridCols,
      gridRows: example.gridRows,
      mode: 'sheet', // Switch to sheet mode for examples
    }));
  }, [setConfig]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span className="bg-slate-100 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
          2
        </span>
        幀動畫參數
      </h2>

      {/* Example Selector */}
      <div className="mb-6">
        <ExampleSelector examples={EXAMPLE_DATA} onSelectExample={handleSelectExample} />
      </div>

      {/* Mode Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
        <button
          onClick={() => handleModeChange('frame')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer
            ${config.mode === 'frame' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
          aria-label="逐幀模式"
        >
          <FilmIcon className="w-4 h-4" />
          逐幀模式
        </button>
        <button
          onClick={() => handleModeChange('sheet')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer
            ${config.mode === 'sheet' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
          aria-label="精靈圖模式"
        >
          <Grid3X3 className="w-4 h-4" />
          精靈圖模式
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">動作提示詞</label>
          <textarea
            value={config.prompt}
            onChange={handlePromptChange}
            placeholder="描述連續動作，例如：跑步循環 (Run Cycle)、跳躍 (Jump)、揮劍攻擊 (Sword Attack)..."
            className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none resize-none h-20 transition-all bg-white"
            aria-label="動作提示詞"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Conditionally Render Frame Count OR Grid Controls */}
          {config.mode === 'frame' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex justify-between">
                幀數 (Frame Count) <span className="text-orange-600 font-bold">{config.frameCount}</span>
              </label>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  value={config.frameCount}
                  onChange={handleFrameCountChange}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  aria-label="幀數"
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-1 text-right">API 請求次數: {config.frameCount}</div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex justify-between">
                  網格列 (Cols) <span className="text-orange-600 font-bold">{config.gridCols}</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={config.gridCols}
                  onChange={handleGridColsChange}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  aria-label="網格列"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex justify-between">
                  網格行 (Rows) <span className="text-orange-600 font-bold">{config.gridRows}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={config.gridRows}
                  onChange={handleGridRowsChange}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  aria-label="網格行"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex justify-between">
              播放速度 (FPS){' '}
              <span className="bg-slate-100 px-1.5 rounded text-slate-700 font-semibold">
                {Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER)}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-slate-400" />
              <input
                type="range"
                min="1"
                max="12"
                value={config.speed}
                onChange={handleSpeedChange}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                aria-label="播放速度"
              />
            </div>
          </div>
        </div>

        {/* Hint Text for Modes */}
        {config.mode === 'sheet' && (
          <div className="space-y-2">
            <div className="text-xs text-green-700 bg-green-50 p-3 rounded-lg border border-green-200 flex items-center gap-2 shadow-sm">
              <Zap className="w-3.5 h-3.5" />
              <span className="font-medium">精靈圖模式僅需消耗 1 次 API 請求，大幅節省配額！</span>
            </div>

            {/* Chroma Key Color Selection */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-xs text-slate-700 font-semibold block mb-2">
                🎨 背景顏色 (去背用)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleChromaKeyColorChange('magenta')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-2 ${
                    config.chromaKeyColor === 'magenta'
                      ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300'
                  }`}
                  aria-label="使用洋紅色背景"
                >
                  <div className="w-4 h-4 rounded-full bg-fuchsia-500 border border-fuchsia-600"></div>
                  洋紅色
                </button>
                <button
                  type="button"
                  onClick={() => handleChromaKeyColorChange('green')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border-2 ${
                    config.chromaKeyColor === 'green'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-green-300'
                  }`}
                  aria-label="使用綠幕背景"
                >
                  <div className="w-4 h-4 rounded-full bg-green-500 border border-green-600"></div>
                  綠幕
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                {config.chromaKeyColor === 'magenta' 
                  ? '💡 預設選項。若角色有粉色/紅色部分，請改用綠幕。'
                  : '💡 適合粉色/紅色角色。若角色有綠色部分，請改用洋紅色。'}
              </p>
            </div>

            {/* Background Removal Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-xs text-slate-700 flex items-center gap-1.5 font-semibold">
                <Eraser className="w-3.5 h-3.5" />
                去除白色背景
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={removeBackground}
                  onChange={(e) => setRemoveBackground(e.target.checked)}
                  aria-label="去除白色背景"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>

            {/* Frame Interpolation Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex flex-col">
                <span className="text-xs text-slate-700 flex items-center gap-1.5 font-semibold">
                  <Zap className="w-3.5 h-3.5" />
                  GIF 補幀平滑
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  {config.enableInterpolation ? '⚠️ 可能產生殘影' : '💡 關閉以避免殘影'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.enableInterpolation}
                  onChange={(e) => handleInterpolationToggle(e.target.checked)}
                  aria-label="啟用 GIF 補幀平滑"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex justify-between">
            預覽縮放 <span className="text-slate-500 font-semibold">{config.scale}%</span>
          </label>
          <input
            type="range"
            min="50"
            max="200"
            step="10"
            value={config.scale}
            onChange={handleScaleChange}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            aria-label="預覽縮放"
          />
        </div>

        {error && (
          <div className="text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200 shadow-sm" role="alert">
            {error}
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer
            ${
              isGenerating
                ? 'bg-orange-400 cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
            }`}
          aria-label={config.mode === 'sheet' ? '生成精靈圖' : '開始逐幀生成'}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="truncate max-w-[200px]">{statusText}</span>
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              {config.mode === 'sheet' ? '生成精靈圖 (1 Request)' : '開始逐幀生成'}
            </>
          )}
        </button>
      </div>
    </div>
  );
});

AnimationConfigPanel.displayName = 'AnimationConfigPanel';
