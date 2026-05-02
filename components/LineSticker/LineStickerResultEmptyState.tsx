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
  <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200/80 rounded-3xl p-8 bg-gradient-to-br from-slate-50/80 via-white to-emerald-50/50">
    <ImageIcon className="w-16 h-16 mb-5 text-slate-300" aria-hidden />
    <p className="text-sm font-semibold text-slate-600 mb-2 text-center max-w-sm">{placeholderText}</p>
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
      className="px-6 py-3 min-h-[48px] bg-white border-2 border-green-200 rounded-xl text-green-800 font-semibold hover:bg-green-50 hover:border-green-300 flex items-center gap-2 transition-all shadow-md shadow-green-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
    >
      <Upload className="w-4 h-4" />
      {uploadButtonText}
    </button>
    <p className="text-xs text-slate-500 mt-4 max-w-sm text-center leading-relaxed">{uploadHint}</p>
  </div>
);
