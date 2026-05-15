import React from 'react';
import { Download, FileArchive, Check } from '../Icons';
import type { Translations } from '../../i18n/types';

export interface LineStickerDownloadSectionProps {
  t: Translations;
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
  <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4">
    {stickerSetMode ? (
      <div className="flex w-full flex-wrap gap-2">
        <button
          type="button"
          onClick={onDownloadSetOneClick}
          disabled={
            isDownloading ||
            (!processedSheetImages.every((img) => !!img) && !sheetFrames.some((arr) => arr.length > 0))
          }
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4 shrink-0" />
          {t.lineStickerDownloadAllOneClick}
        </button>
        <button
          type="button"
          onClick={onDownloadStickerSetZip}
          disabled={isDownloading || !processedSheetImages.every((img) => !!img)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileArchive className="h-4 w-4 shrink-0" />
          {t.lineStickerDownload3Zip}
        </button>
        <button
          type="button"
          onClick={onDownloadAllSheetsFramesZip}
          disabled={isDownloading || !sheetFrames.some((arr) => arr.length > 0)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileArchive className="h-4 w-4 shrink-0" />
          {t.lineStickerDownload3SheetsFramesZip}
        </button>
        <button
          type="button"
          onClick={onDownloadCurrentSheetZip}
          disabled={isDownloading || !processedSheetImagesCurrent}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-emerald-300/80 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4 shrink-0" />
          {t.lineStickerDownloadCurrentSheet}
        </button>
      </div>
    ) : (
      <div className="flex w-full flex-wrap gap-2">
        <button
          type="button"
          onClick={onDownloadAllAsZip}
          disabled={isDownloading || stickerFramesLength === 0}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4 shrink-0" />
          {t.lineStickerDownloadAll}
        </button>
        <button
          type="button"
          onClick={() => onDownloadSelectedAsZip(selectedIndices)}
          disabled={isDownloading || selectedCount === 0}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4 shrink-0" />
          {t.lineStickerDownloadSelected.replace('{n}', String(selectedCount))}
        </button>
      </div>
    )}
  </div>
);
