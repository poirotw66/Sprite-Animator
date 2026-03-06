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
  <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-3xl p-6">
    <ImageIcon className="w-20 h-20 mb-4 opacity-10" />
    <p className="text-sm font-medium mb-4">{placeholderText}</p>
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
      className="px-5 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 transition-all shadow-sm"
    >
      <Upload className="w-4 h-4" />
      {uploadButtonText}
    </button>
    <p className="text-xs text-slate-400 mt-3 max-w-sm text-center">{uploadHint}</p>
  </div>
);
