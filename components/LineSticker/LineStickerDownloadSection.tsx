import React from 'react';
import { Download, FileArchive, Check } from '../Icons';

export interface LineStickerDownloadSectionProps {
  t: Record<string, string>;
  stickerSetMode: boolean;
  isDownloading: boolean;
  processedSheetImages: (string | null)[];
  sheetFrames: string[][];
  processedSheetImagesCurrent: string | null;
  stickerFramesLength: number;
  selectedCount: number;
  onDownloadSetOneClick: () => void;
  onDownloadStickerSetZip: () => void;
  onDownloadAllSheetsFramesZip: () => void;
  onDownloadCurrentSheetZip: () => void;
  onDownloadAllAsZip: () => void;
  onDownloadSelectedAsZip: (indices: number[]) => void;
  selectedIndices: number[];
}

export const LineStickerDownloadSection: React.FC<LineStickerDownloadSectionProps> = ({
  t,
  stickerSetMode,
  isDownloading,
  processedSheetImages,
  sheetFrames,
  processedSheetImagesCurrent,
  stickerFramesLength,
  selectedCount,
  onDownloadSetOneClick,
  onDownloadStickerSetZip,
  onDownloadAllSheetsFramesZip,
  onDownloadCurrentSheetZip,
  onDownloadAllAsZip,
  onDownloadSelectedAsZip,
  selectedIndices,
}) => (
  <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
    {stickerSetMode ? (
      <div className="flex flex-wrap gap-2 w-full">
        <button
          onClick={onDownloadSetOneClick}
          disabled={
            isDownloading ||
            (!processedSheetImages.every((img) => !!img) && !sheetFrames.some((arr) => arr.length > 0))
          }
          className="px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 transition-all shadow-md"
        >
          <Download className="w-4 h-4" />
          {t.lineStickerDownloadAllOneClick}
        </button>
        <button
          onClick={onDownloadStickerSetZip}
          disabled={isDownloading || !processedSheetImages.every((img) => !!img)}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md"
        >
          <FileArchive className="w-4 h-4" />
          {t.lineStickerDownload3Zip}
        </button>
        <button
          onClick={onDownloadAllSheetsFramesZip}
          disabled={isDownloading || !sheetFrames.some((arr) => arr.length > 0)}
          className="px-5 py-2.5 bg-slate-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-slate-600 disabled:opacity-50 transition-all shadow-md"
        >
          <FileArchive className="w-4 h-4" />
          {t.lineStickerDownload3SheetsFramesZip}
        </button>
        <button
          onClick={onDownloadCurrentSheetZip}
          disabled={isDownloading || !processedSheetImagesCurrent}
          className="px-5 py-2.5 bg-green-500 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-green-600 disabled:opacity-50 transition-all shadow-md"
        >
          <Download className="w-4 h-4" />
          {t.lineStickerDownloadCurrentSheet}
        </button>
      </div>
    ) : (
      <div className="flex flex-wrap gap-2 w-full">
        <button
          onClick={onDownloadAllAsZip}
          disabled={isDownloading || stickerFramesLength === 0}
          className="px-5 py-2.5 bg-green-500 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-green-600 disabled:opacity-50 transition-all shadow-md"
        >
          <Download className="w-4 h-4" />
          {t.lineStickerDownloadAll}
        </button>
        <button
          onClick={() => onDownloadSelectedAsZip(selectedIndices)}
          disabled={isDownloading || selectedCount === 0}
          className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
        >
          <Check className="w-4 h-4" />
          {t.lineStickerDownloadSelected.replace('{n}', String(selectedCount))}
        </button>
      </div>
    )}
  </div>
);
