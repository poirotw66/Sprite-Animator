import { useCallback, useMemo } from 'react';
import type React from 'react';
import type { SliceSettings, FrameOverride } from '../utils/imageUtils';
import type { LineStickerResultPanelViewModel } from '../components/LineSticker/LineStickerResultPanel';
import type { LineStickerSheetIndex } from '../utils/lineStickerSetSchema';

interface UseLineStickerResultPanelViewModelParams {
  stickerSetMode: boolean;
  currentSheetIndex: LineStickerSheetIndex;
  setCurrentSheetIndex: (index: LineStickerSheetIndex) => void;
  error: string | null;
  statusText: string;
  isGenerating: boolean;
  isDownloading: boolean;
  effectiveSpriteSheetImage: string | null;
  effectiveProcessedSpriteSheet: string | null;
  effectiveStickerFrames: string[];
  effectiveSelectedFrames: boolean[];
  effectiveSetSelectedFrames: React.Dispatch<React.SetStateAction<boolean[]>>;
  effectiveFrameOverrides: FrameOverride[];
  effectiveSetFrameOverrides: React.Dispatch<React.SetStateAction<FrameOverride[]>>;
  effectiveSliceSettingsForView: SliceSettings;
  effectiveSetSliceSettingsForView: React.Dispatch<React.SetStateAction<SliceSettings>>;
  effectiveSheetDimensions: { width: number; height: number };
  effectiveChromaKeyProgress: number;
  effectiveIsProcessingChromaKey: boolean;
  onImageLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  processedSheetImages: (string | null)[];
  sheetFrames: string[][];
  singleSheetProcessedImage: string | null;
  selectedCount: number;
  selectedIndices: number[];
  selectAll: () => void;
  deselectAll: () => void;
  onDownloadSetOneClick: () => void;
  onDownloadStickerSetZip: () => void;
  onDownloadAllSheetsFramesZip: () => void;
  onDownloadCurrentSheetZip: () => void;
  onDownloadAllAsZip: () => void;
  onDownloadSelectedAsZip: (indices: number[]) => void;
  setSheetImages: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  setProcessedSheetImages: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  setSingleSheetImage: React.Dispatch<React.SetStateAction<string | null>>;
  setSingleSheetProcessedImage: React.Dispatch<React.SetStateAction<string | null>>;
  reRunSetSheetChromaKey: (image: string) => Promise<string>;
  reRunSingleSheetChromaKey: (image: string) => Promise<string>;
}

export const useLineStickerResultPanelViewModel = ({
  stickerSetMode,
  currentSheetIndex,
  setCurrentSheetIndex,
  error,
  statusText,
  isGenerating,
  isDownloading,
  effectiveSpriteSheetImage,
  effectiveProcessedSpriteSheet,
  effectiveStickerFrames,
  effectiveSelectedFrames,
  effectiveSetSelectedFrames,
  effectiveFrameOverrides,
  effectiveSetFrameOverrides,
  effectiveSliceSettingsForView,
  effectiveSetSliceSettingsForView,
  effectiveSheetDimensions,
  effectiveChromaKeyProgress,
  effectiveIsProcessingChromaKey,
  onImageLoad,
  processedSheetImages,
  sheetFrames,
  singleSheetProcessedImage,
  selectedCount,
  selectedIndices,
  selectAll,
  deselectAll,
  onDownloadSetOneClick,
  onDownloadStickerSetZip,
  onDownloadAllSheetsFramesZip,
  onDownloadCurrentSheetZip,
  onDownloadAllAsZip,
  onDownloadSelectedAsZip,
  setSheetImages,
  setProcessedSheetImages,
  setSingleSheetImage,
  setSingleSheetProcessedImage,
  reRunSetSheetChromaKey,
  reRunSingleSheetChromaKey,
}: UseLineStickerResultPanelViewModelParams): LineStickerResultPanelViewModel => {
  const onReplaceOriginalImage = useCallback((dataUrl: string) => {
    if (stickerSetMode) {
      setSheetImages((prev) => {
        const next = [...prev];
        next[currentSheetIndex] = dataUrl;
        return next;
      });
      return;
    }
    setSingleSheetImage(dataUrl);
  }, [stickerSetMode, setSheetImages, currentSheetIndex, setSingleSheetImage]);

  const onReplaceProcessedImage = useCallback((dataUrl: string) => {
    if (stickerSetMode) {
      setProcessedSheetImages((prev) => {
        const next = [...prev];
        next[currentSheetIndex] = dataUrl;
        return next;
      });
      return;
    }
    setSingleSheetProcessedImage(dataUrl);
  }, [stickerSetMode, setProcessedSheetImages, currentSheetIndex, setSingleSheetProcessedImage]);

  const onApplyReprocessedImage = useCallback((dataUrl: string) => {
    if (stickerSetMode) {
      setProcessedSheetImages((prev) => {
        const next = [...prev];
        next[currentSheetIndex] = dataUrl;
        return next;
      });
      return;
    }
    setSingleSheetProcessedImage(dataUrl);
  }, [stickerSetMode, setProcessedSheetImages, currentSheetIndex, setSingleSheetProcessedImage]);

  const onReRunChromaKey = useCallback((image: string) => {
    return stickerSetMode
      ? reRunSetSheetChromaKey(image)
      : reRunSingleSheetChromaKey(image);
  }, [stickerSetMode, reRunSetSheetChromaKey, reRunSingleSheetChromaKey]);

  const onSpriteSheetUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (stickerSetMode) {
        setSheetImages((prev) => {
          const next = [...prev];
          next[currentSheetIndex] = dataUrl;
          return next;
        });
        setProcessedSheetImages((prev) => {
          const next = [...prev];
          next[currentSheetIndex] = null;
          return next;
        });
      } else {
        setSingleSheetImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [stickerSetMode, setSheetImages, currentSheetIndex, setProcessedSheetImages, setSingleSheetImage]);

  const sheet = useMemo(() => ({
    stickerSetMode,
    currentSheetIndex,
    setCurrentSheetIndex,
  }), [stickerSetMode, currentSheetIndex, setCurrentSheetIndex]);

  const status = useMemo(() => ({
    error,
    statusText,
    isGenerating,
    isDownloading,
  }), [error, statusText, isGenerating, isDownloading]);

  const viewer = useMemo(() => ({
    effectiveSpriteSheetImage,
    effectiveProcessedSpriteSheet,
    effectiveStickerFrames,
    effectiveSelectedFrames,
    effectiveSetSelectedFrames,
    effectiveFrameOverrides,
    effectiveSetFrameOverrides,
    effectiveSliceSettingsForView,
    effectiveSetSliceSettingsForView,
    effectiveSheetDimensions,
    effectiveChromaKeyProgress,
    effectiveIsProcessingChromaKey,
    lockGridSize: stickerSetMode,
    onImageLoad,
    onReplaceOriginalImage,
    onReplaceProcessedImage,
    onApplyReprocessedImage,
    onReRunChromaKey,
    onSpriteSheetUpload,
  }), [
    effectiveSpriteSheetImage,
    effectiveProcessedSpriteSheet,
    effectiveStickerFrames,
    effectiveSelectedFrames,
    effectiveSetSelectedFrames,
    effectiveFrameOverrides,
    effectiveSetFrameOverrides,
    effectiveSliceSettingsForView,
    effectiveSetSliceSettingsForView,
    effectiveSheetDimensions,
    effectiveChromaKeyProgress,
    effectiveIsProcessingChromaKey,
    stickerSetMode,
    onImageLoad,
    onReplaceOriginalImage,
    onReplaceProcessedImage,
    onApplyReprocessedImage,
    onReRunChromaKey,
    onSpriteSheetUpload,
  ]);

  const downloads = useMemo(() => ({
    processedSheetImages,
    processedSheetImagesCurrent: stickerSetMode ? (processedSheetImages[currentSheetIndex] ?? null) : singleSheetProcessedImage,
    sheetFrames,
    selectedCount,
    selectedIndices,
    selectAll,
    deselectAll,
    onDownloadSetOneClick,
    onDownloadStickerSetZip,
    onDownloadAllSheetsFramesZip,
    onDownloadCurrentSheetZip,
    onDownloadAllAsZip,
    onDownloadSelectedAsZip,
  }), [
    processedSheetImages,
    stickerSetMode,
    currentSheetIndex,
    singleSheetProcessedImage,
    sheetFrames,
    selectedCount,
    selectedIndices,
    selectAll,
    deselectAll,
    onDownloadSetOneClick,
    onDownloadStickerSetZip,
    onDownloadAllSheetsFramesZip,
    onDownloadCurrentSheetZip,
    onDownloadAllAsZip,
    onDownloadSelectedAsZip,
  ]);

  return useMemo(() => ({
    sheet,
    status,
    viewer,
    downloads,
  }), [sheet, status, viewer, downloads]);
};