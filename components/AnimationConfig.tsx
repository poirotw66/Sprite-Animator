import React, { useCallback } from 'react';
import { Play, Layers, Zap, Eraser, Wand2, Loader2, Film as FilmIcon, Grid3X3 } from './Icons';
import { AnimationConfig } from '../types';
import { ANIMATION_FPS_MULTIPLIER } from '../utils/constants';

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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span className="bg-slate-100 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
          2
        </span>
        幀動畫參數
      </h2>

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
