import React, { useRef } from 'react';
import { ImageIcon } from './Icons';

interface ImageUploadProps {
  sourceImage: string | null;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = React.memo(({
  sourceImage,
  onImageUpload,
  onDrop,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span className="bg-slate-100 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
          1
        </span>
        上傳角色圖片
      </h2>

      <div
        className={`border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative overflow-hidden group
          ${sourceImage ? 'border-orange-300 bg-orange-50/50' : 'border-slate-300 hover:border-orange-400 hover:bg-slate-50 hover:shadow-sm'}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="上傳圖片區域"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onImageUpload}
          accept="image/*"
          className="hidden"
          aria-label="選擇圖片文件"
        />

        {sourceImage ? (
          <img
            src={sourceImage}
            alt="Uploaded character"
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-50 to-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-200 shadow-sm">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-slate-700 font-medium text-sm">點擊或拖拽圖片</p>
            <p className="text-slate-400 text-xs mt-1">支援 PNG、JPG、WebP</p>
          </div>
        )}
      </div>
    </div>
  );
});

ImageUpload.displayName = 'ImageUpload';
