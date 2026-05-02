import React, { useCallback, useRef, useState } from 'react';
import { Upload } from '../Icons';

export interface LineStickerUploadCardProps {
  title: string;
  uploadHint: string;
  sourceImage: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenFilePicker: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LineStickerUploadCard: React.FC<LineStickerUploadCardProps> = ({
  title,
  uploadHint,
  sourceImage,
  fileInputRef,
  onOpenFilePicker,
  onDrop,
  onDragOver,
  onImageUpload,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOverInner = useCallback(
    (e: React.DragEvent) => {
      onDragOver(e);
      e.preventDefault();
    },
    [onDragOver]
  );

  const handleDropInner = useCallback(
    (e: React.DragEvent) => {
      dragDepth.current = 0;
      setIsDragging(false);
      onDrop(e);
    },
    [onDrop]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpenFilePicker();
      }
    },
    [onOpenFilePicker]
  );

  return (
    <div className="bg-white rounded-2xl shadow-md shadow-slate-200/40 ring-1 ring-slate-100 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${title}: ${uploadHint}`}
        onClick={onOpenFilePicker}
        onKeyDown={handleKeyDown}
        onDrop={handleDropInner}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOverInner}
        className={`w-full max-w-[280px] sm:max-w-[320px] mx-auto aspect-square rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 border-2 border-dashed ${
          isDragging
            ? 'border-green-500 bg-green-50 scale-[1.01]'
            : 'border-slate-200 hover:border-green-400 hover:bg-emerald-50/30 bg-slate-50/80'
        }`}
      >
        {sourceImage ? (
          <img src={sourceImage} alt="" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center p-6">
            <Upload
              className={`w-11 h-11 mx-auto mb-3 transition-colors ${
                isDragging ? 'text-green-600' : 'text-slate-400 group-hover:text-green-600'
              }`}
              aria-hidden
            />
            <p className="text-sm font-medium text-slate-700">{uploadHint}</p>
            <p className="text-[11px] text-slate-400 mt-2">PNG · JPG · WebP</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onImageUpload}
          className="hidden"
          aria-hidden
        />
      </div>
    </div>
  );
};
