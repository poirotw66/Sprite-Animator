import { useCallback, useRef } from 'react';
import type { ChangeEvent, Dispatch, DragEvent, SetStateAction } from 'react';

interface UseLineStickerImageInputParams {
  setSourceImage: Dispatch<SetStateAction<string | null>>;
  setSpriteSheetImage: Dispatch<SetStateAction<string | null>>;
  setStickerFrames: Dispatch<SetStateAction<string[]>>;
  setSelectedFrames: Dispatch<SetStateAction<boolean[]>>;
  setError: (value: string | null) => void;
}

export function useLineStickerImageInput({
  setSourceImage,
  setSpriteSheetImage,
  setStickerFrames,
  setSelectedFrames,
  setError,
}: UseLineStickerImageInputParams) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetGeneratedState = useCallback(
    (imageData: string) => {
      setSourceImage(imageData);
      setSpriteSheetImage(null);
      setStickerFrames([]);
      setSelectedFrames([]);
      setError(null);
    },
    [setSourceImage, setSpriteSheetImage, setStickerFrames, setSelectedFrames, setError]
  );

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          resetGeneratedState(result);
        }
      };
      reader.readAsDataURL(file);
    },
    [resetGeneratedState]
  );

  const handleImageUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      readFile(file);
    },
    [readFile]
  );

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      readFile(file);
    },
    [readFile]
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    handleImageUpload,
    handleDrop,
    handleDragOver,
    openFilePicker,
  };
}
