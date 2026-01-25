import React from 'react';

interface FrameGridProps {
  frames: string[];
  currentFrameIndex: number;
  onFrameClick: (index: number) => void;
}

export const FrameGrid: React.FC<FrameGridProps> = React.memo(({ frames, currentFrameIndex, onFrameClick }) => {
  if (frames.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center justify-between">
        動作分解 (Extracted Frames)
        <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500">點擊切換</span>
      </h3>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
        {frames.map((frame, idx) => (
          <div
            key={idx}
            className={`aspect-square rounded-lg border-2 overflow-hidden cursor-pointer bg-white transition-all hover:scale-105 active:scale-95 shadow-sm
              ${idx === currentFrameIndex ? 'border-orange-500 ring-2 ring-orange-100' : 'border-gray-200 hover:border-orange-300'}`}
            onClick={() => onFrameClick(idx)}
            role="button"
            tabIndex={0}
            aria-label={`切換到第 ${idx + 1} 幀`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFrameClick(idx);
              }
            }}
          >
            <img
              src={frame}
              alt={`Frame ${idx + 1}`}
              className="w-full h-full object-contain p-1"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

FrameGrid.displayName = 'FrameGrid';
