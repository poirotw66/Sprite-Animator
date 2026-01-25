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
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-500 mb-4 flex items-center gap-2">
        <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">
          1
        </span>
        上傳角色圖片
      </h2>

      <div
        className={`border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group
          ${sourceImage ? 'border-orange-200 bg-orange-50' : 'border-gray-300 hover:border-orange-400 hover:bg-gray-50'}`}
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
            <div className="w-12 h-12 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-gray-600 font-medium text-sm">點擊或拖拽圖片</p>
          </div>
        )}
      </div>
    </div>
  );
});

ImageUpload.displayName = 'ImageUpload';
