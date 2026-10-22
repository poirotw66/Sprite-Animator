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
  onDownloadAsepriteJson: () => void;
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
  onDownloadAsepriteJson,
}) => {
  const { t } = useLanguage();

  return (
    <div className="ui-panel p-4 sm:p-5 flex flex-col">
      <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="ui-step">
            4
          </span>
          {t.previewTitle}
        </span>
        {generatedFrames.length > 0 && (
          <span className="text-xs text-signal bg-signal-soft px-2.5 py-1 rounded-full font-semibold border border-signal/25">
            {t.frame} {currentFrameIndex + 1} / {generatedFrames.length}
          </span>
        )}
      </h2>

      <div
        className="ui-canvas flex flex-col items-center justify-center min-h-[240px] sm:min-h-[300px] touch-manipulation"
        onClick={generatedFrames.length > 0 ? onTogglePlay : undefined}
        title={generatedFrames.length > 0 ? t.clickToPlayPause : undefined}
        role={generatedFrames.length > 0 ? 'button' : undefined}
        tabIndex={generatedFrames.length > 0 ? 0 : undefined}
        aria-pressed={generatedFrames.length > 0 ? isPlaying : undefined}
        aria-label={t.previewArea}
        onKeyDown={(e) => {
          if (generatedFrames.length > 0 && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onTogglePlay();
          }
        }}
      >
        {!isGenerating && generatedFrames.length === 0 && (
          <div className="text-center max-w-sm p-6">
            <div className="w-14 h-14 border border-line bg-surface rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Play className="w-8 h-8 text-ink-muted ml-1" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">{t.previewArea}</h3>
            <p className="text-slate-500 mt-2 text-sm">{t.previewHint}</p>
          </div>
        )}

        {isGenerating && (
          <div className="text-center z-10 p-6 max-w-sm">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-signal/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-signal rounded-full border-t-transparent animate-spin"></div>
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
          </div>
        )}
      </div>

      {/* Export actions stay below the canvas to keep artwork visible. */}
      {generatedFrames.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={onDownloadApng}
            disabled={isExporting}
            className="ui-btn-primary w-full"
            aria-label={t.downloadApng}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <FileVideo className="w-4 h-4 flex-shrink-0" />}
            <span className="truncate">{t.downloadApng}</span>
          </button>

          <button
            onClick={onDownloadGif}
            disabled={isExporting}
            className="ui-btn-secondary min-w-0 px-2"
            aria-label={t.downloadGif}
          >
            <Film className="w-4 h-4 text-ink-muted flex-shrink-0" />
            <span className="truncate">{t.downloadGif}</span>
          </button>
          <button
            onClick={onDownloadZip}
            disabled={isExporting}
            className="ui-btn-secondary min-w-0 px-2"
            aria-label={t.downloadZip}
          >
            <Archive className="w-4 h-4 text-ink-muted flex-shrink-0" />
            <span className="truncate">{t.downloadZip}</span>
          </button>
          <button
            onClick={onDownloadAsepriteJson}
            disabled={isExporting}
            className="ui-btn-secondary min-w-0 px-2"
            aria-label={t.downloadAsepriteJson}
          >
            <Archive className="w-4 h-4 text-signal flex-shrink-0" />
            <span className="truncate">{t.downloadAsepriteJson}</span>
          </button>
        </div>
      )}

      {generatedFrames.length > 0 && (
        <div className="mt-4 text-xs leading-relaxed text-ink-muted space-y-1">
          <p>{t.exportHint}</p>
          <p className="text-ok">{t.exportSmoothHint}</p>
        </div>
      )}
    </div>
  );
});

AnimationPreview.displayName = 'AnimationPreview';
