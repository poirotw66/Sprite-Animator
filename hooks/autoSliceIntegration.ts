import {
  getEffectivePadding,
  runAutoSlicePipeline,
  type AutoSliceCandidate,
  type AutoSliceFallbackHint,
  type AutoSlicePipelineResult,
  type SliceSettings,
} from '../utils/imageUtils';
import type { AutoSliceImageData } from '../utils/autoSlice/types';

const DEFAULT_AUTO_SLICE_TIMEOUT_MS = 500;

export interface ResolveAutoSlicePipelineDependencies {
  loadImageData?: (base64Image: string) => Promise<AutoSliceImageData | null>;
  runPipeline?: typeof runAutoSlicePipeline;
  timeoutMs?: number;
}

export function buildAutoSliceAttemptKey(
  base64Image: string,
  sliceSettings: SliceSettings
): string {
  return `${base64Image}::${sliceSettings.cols}x${sliceSettings.rows}`;
}

export function applyAutoSliceCandidateToSettings(
  sliceSettings: SliceSettings,
  candidate: AutoSliceCandidate
): SliceSettings {
  return {
    ...sliceSettings,
    cols: candidate.cols,
    rows: candidate.rows,
    paddingX: Math.round((candidate.paddingLeft + candidate.paddingRight) / 2),
    paddingY: Math.round((candidate.paddingTop + candidate.paddingBottom) / 2),
    paddingLeft: candidate.paddingLeft,
    paddingRight: candidate.paddingRight,
    paddingTop: candidate.paddingTop,
    paddingBottom: candidate.paddingBottom,
    shiftX: candidate.shiftX,
    shiftY: candidate.shiftY,
  };
}

export function applyAutoSliceHintToSettings(
  sliceSettings: SliceSettings,
  hint: AutoSliceFallbackHint
): SliceSettings {
  return {
    ...sliceSettings,
    cols: hint.suggestedCols,
    rows: hint.suggestedRows,
    shiftX: hint.suggestedShiftX,
    shiftY: hint.suggestedShiftY,
  };
}

export function shouldShowAutoSliceHint(
  result: AutoSlicePipelineResult | null
): result is Extract<AutoSlicePipelineResult, { hint: AutoSliceFallbackHint }> {
  return result?.status === 'low_confidence' || result?.status === 'hard_guard_failed';
}

export function didAutoSliceSettingsChange(
  current: SliceSettings,
  next: SliceSettings
): boolean {
  return (
    current.cols !== next.cols ||
    current.rows !== next.rows ||
    current.paddingX !== next.paddingX ||
    current.paddingY !== next.paddingY ||
    current.paddingLeft !== next.paddingLeft ||
    current.paddingRight !== next.paddingRight ||
    current.paddingTop !== next.paddingTop ||
    current.paddingBottom !== next.paddingBottom ||
    current.shiftX !== next.shiftX ||
    current.shiftY !== next.shiftY
  );
}

export async function resolveAutoSlicePipelineForSettings(
  base64Image: string,
  sliceSettings: SliceSettings,
  dependencies: ResolveAutoSlicePipelineDependencies = {}
): Promise<AutoSlicePipelineResult | null> {
  const loadImageData = dependencies.loadImageData ?? loadAutoSliceImageData;
  const runPipeline = dependencies.runPipeline ?? runAutoSlicePipeline;
  const imageData = await loadImageData(base64Image);

  if (!imageData) {
    return null;
  }

  const padding = getEffectivePadding(sliceSettings);

  return runPipeline({
    base64Image,
    cols: sliceSettings.cols,
    rows: sliceSettings.rows,
    timeoutMs: dependencies.timeoutMs ?? DEFAULT_AUTO_SLICE_TIMEOUT_MS,
    baseCandidate: {
      shiftX: sliceSettings.shiftX,
      shiftY: sliceSettings.shiftY,
      paddingLeft: padding.left,
      paddingRight: padding.right,
      paddingTop: padding.top,
      paddingBottom: padding.bottom,
    },
    imageData,
  });
}

export async function loadAutoSliceImageData(
  base64Image: string
): Promise<AutoSliceImageData | null> {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        resolve({
          width: imageData.width,
          height: imageData.height,
          pixels: imageData.data,
        });
      } catch {
        resolve(null);
      }
    };

    image.onerror = () => {
      resolve(null);
    };

    image.src = base64Image;
  });
}
