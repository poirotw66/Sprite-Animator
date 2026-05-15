import React from 'react';
import { Upload, ImageIcon } from '../Icons';

export interface LineStickerResultEmptyStateProps {
  placeholderText: string;
  uploadButtonText: string;
  uploadHint: string;
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const LineStickerResultEmptyState: React.FC<LineStickerResultEmptyStateProps> = ({
  placeholderText,
  uploadButtonText,
  uploadHint,
  onUploadClick,
  onFileChange,
  fileInputRef,
}) => (
  <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 text-slate-400">
    <ImageIcon className="mb-4 h-14 w-14 text-slate-300" aria-hidden />
    <p className="mb-2 max-w-sm text-center text-sm font-medium text-slate-600">{placeholderText}</p>
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={onFileChange}
      className="hidden"
      aria-hidden
    />
    <button
      type="button"
      onClick={onUploadClick}
      className="flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-green-200 bg-white px-6 py-3 font-semibold text-green-800 shadow-sm transition-colors hover:border-green-300 hover:bg-green-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
    >
      <Upload className="w-4 h-4" />
      {uploadButtonText}
    </button>
    <p className="text-xs text-slate-500 mt-4 max-w-sm text-center leading-relaxed">{uploadHint}</p>
  </div>
);
