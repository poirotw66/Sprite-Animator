import React from 'react';
import { Play, Loader2, FileVideo, Film, Archive } from './Icons';
import { AnimationConfig } from '../types';
import { GRID_PATTERN_URL } from '../utils/constants';
import { useLanguage } from '../hooks/useLanguage';

interface AnimationPreviewProps {
  generatedFrames: string[];
  currentFrameIndex: number;
  isGenerating: boolean;
  statusText: string;
  isPlaying: boolean;
  isExporting: boolean;
  config: AnimationConfig;
  onTogglePlay: () => void;
  onDownloadApng: () => void;
  onDownloadGif: () => void;
  onDownloadZip: () => void;
}

export const AnimationPreview: React.FC<AnimationPreviewProps> = React.memo(({
  generatedFrames,
  currentFrameIndex,
  isGenerating,
  statusText,
  isPlaying,
  isExporting,
  config,
  onTogglePlay,
  onDownloadApng,
  onDownloadGif,
  onDownloadZip,
}) => {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 md:p-6 flex-1 flex flex-col min-h-[320px] sm:min-h-[400px] md:min-h-[500px]">
      <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-slate-100 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
            3
          </span>
          {t.previewTitle}
        </div>
        {generatedFrames.length > 0 && (
          <span className="text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full font-semibold border border-orange-200">
            {t.frame} {currentFrameIndex + 1} / {generatedFrames.length}
          </span>
        )}
      </h2>

      <div
        className="flex-1 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center relative overflow-hidden group min-h-[220px] sm:min-h-[280px] md:min-h-[300px] cursor-pointer transition-colors hover:border-slate-400 hover:bg-slate-100/50 active:bg-slate-100 touch-manipulation tap-highlight"
        onClick={onTogglePlay}
        title={t.clickToPlayPause}
        role="button"
        tabIndex={0}
        aria-label={t.previewArea}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTogglePlay();
          }
        }}
      >
        {!isGenerating && generatedFrames.length === 0 && (
          <div className="text-center p-8 opacity-60">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Play className="w-8 h-8 text-slate-500 ml-1" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">{t.previewArea}</h3>
            <p className="text-slate-500 mt-2 text-sm">{t.previewHint}</p>
          </div>
        )}

        {isGenerating && (
          <div className="text-center z-10 p-6 max-w-sm">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 animate-pulse">{t.drawing}</h3>
            <p className="text-slate-600 mt-2 text-sm">{statusText}</p>
          </div>
        )}

        {generatedFrames.length > 0 && (
          <div
            className="relative w-full h-full flex flex-col items-center justify-center bg-repeat bg-[length:20px_20px] rounded-lg overflow-hidden cursor-pointer"
            style={{ backgroundImage: `url(${GRID_PATTERN_URL})` }}
          >
            {/* The Frame Player */}
            <img
              src={generatedFrames[currentFrameIndex % generatedFrames.length]}
              alt={`Frame ${currentFrameIndex}`}
              className="object-contain pixelated transition-none"
              style={{
                transform: `scale(${config.scale / 100})`,
                imageRendering: 'pixelated',
                maxHeight: 'min(400px, 60vh)',
                maxWidth: '100%',
              }}
            />

            {/* Playback Status Icon */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                <div className="bg-black/50 text-white p-3 rounded-full backdrop-blur-sm">
                  <Play className="w-6 h-6 fill-white" />
                </div>
              </div>
            )}

            {/* Controls Overlay - wrap on narrow screens */}
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex flex-col sm:flex-row flex-wrap gap-2 max-w-full justify-end" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onDownloadApng}
                disabled={isExporting || generatedFrames.length === 0}
                className="min-h-[44px] bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 backdrop-blur-sm disabled:opacity-70 disabled:cursor-wait cursor-pointer hover:shadow-xl touch-manipulation tap-highlight"
                aria-label={t.downloadApng}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <FileVideo className="w-4 h-4 flex-shrink-0" />}
                <span className="truncate">{t.downloadApng}</span>
              </button>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={onDownloadGif}
                  disabled={isExporting || generatedFrames.length === 0}
                  className="min-h-[44px] flex-1 min-w-[100px] bg-white/95 hover:bg-white text-slate-800 px-3 py-2.5 rounded-lg text-sm font-semibold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 backdrop-blur-sm disabled:opacity-70 cursor-pointer hover:shadow-xl border border-slate-200/50 touch-manipulation tap-highlight"
                  aria-label={t.downloadGif}
                >
                  <Film className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="truncate">{t.downloadGif}</span>
                </button>
                <button
                  onClick={onDownloadZip}
                  disabled={isExporting || generatedFrames.length === 0}
                  className="min-h-[44px] flex-1 min-w-[100px] bg-white/95 hover:bg-white text-slate-800 px-3 py-2.5 rounded-lg text-sm font-semibold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 backdrop-blur-sm disabled:opacity-70 cursor-pointer hover:shadow-xl border border-slate-200/50 touch-manipulation tap-highlight"
                  aria-label={t.downloadZip}
                >
                  <Archive className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="truncate">{t.downloadZip}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-500 text-center space-y-1">
        <p>{t.exportHint}</p>
        <p className="text-green-600">{t.exportSmoothHint}</p>
      </div>
    </div>
  );
});

AnimationPreview.displayName = 'AnimationPreview';
