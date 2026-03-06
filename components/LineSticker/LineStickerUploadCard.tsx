import React from 'react';
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
}) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
    <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>
    <div
      onClick={onOpenFilePicker}
      onDrop={onDrop}
      onDragOver={onDragOver}
      className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-green-400 bg-slate-50 transition-all overflow-hidden"
    >
      {sourceImage ? (
        <img src={sourceImage} alt="Source" className="w-full h-full object-contain" />
      ) : (
        <div className="text-center p-4">
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-600 font-medium">{uploadHint}</p>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onImageUpload}
        className="hidden"
      />
    </div>
  </div>
);
