/**
 * Lightweight post-slice QA for LINE sticker frames (headless-safe).
 * Used before finalize to flag empty cells, dimension drift, weak text, and upload limits.
 */

import { isSliceBackgroundPixel } from './imageContentAnalysis';
import {
  LINE_STICKER_UPLOAD,
  computeFitDimensions,
} from './lineStickerUploadSpec';

export interface RgbaFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface StickerFrameQaInput {
  globalIndex: number;
  sheet?: string;
  index?: number;
  phrase?: string;
  frame: RgbaFrame;
  /** When true, run caption-band ink heuristic (model-drawn text). */
  checkModelText?: boolean;
  /** Actual PNG byte size when available (upload check). */
  pngBytes?: number;
}

export interface StickerFrameQaEntry {
  globalIndex: number;
  sheet?: string;
  index?: number;
  phrase?: string;
  width: number;
  height: number;
  foregroundRatio: number;
  dimensionScore: number;
  textContrastScore?: number;
  lineUploadWidth: number;
  lineUploadHeight: number;
  lineUploadBytes: number;
  lineUploadScore: number;
  overallScore: number;
  warnings: string[];
}

export interface StickerQaReport {
  generatedAt: string;
  stickerCount: number;
  checkModelText: boolean;
  medianWidth: number;
  medianHeight: number;
  overallScore: number;
  pass: boolean;
  warnThreshold: number;
  entries: StickerFrameQaEntry[];
  summaryWarnings: string[];
}

export const DEFAULT_QA_WARN_THRESHOLD = 0.65;

const FOREGROUND_MIN = 0.025;
const FOREGROUND_MAX = 0.92;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Share of pixels that are not chroma / transparent background. */
export function measureForegroundRatio(frame: RgbaFrame): number {
  const { data, width, height } = frame;
  const total = width * height;
  if (total <= 0) return 0;
  let foreground = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (!isSliceBackgroundPixel(r, g, b, a)) {
      foreground++;
    }
  }
  return foreground / total;
}

/** 1 = matches median size; lower when width/height drifts (possible neighbor bleed). */
export function scoreDimensionAgainstMedian(
  width: number,
  height: number,
  medianWidth: number,
  medianHeight: number
): number {
  if (medianWidth <= 0 || medianHeight <= 0) return 1;
  const wDev = Math.abs(width - medianWidth) / medianWidth;
  const hDev = Math.abs(height - medianHeight) / medianHeight;
  const maxDev = Math.max(wDev, hDev);
  if (maxDev <= 0.08) return 1;
  if (maxDev <= 0.18) return 0.9;
  if (maxDev <= 0.28) return 0.7;
  if (maxDev <= 0.4) return 0.5;
  return 0.25;
}

/** Ink-like pixels in top/bottom caption bands (model-drawn text heuristic). */
export function measureCaptionBandInkRatio(
  frame: RgbaFrame,
  band: 'top' | 'bottom'
): number {
  const { data, width, height } = frame;
  const bandH = Math.max(8, Math.round(height * 0.28));
  const y0 = band === 'bottom' ? height - bandH : 0;
  const y1 = band === 'bottom' ? height : bandH;
  let ink = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      total++;
      const i = (y * width + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (isSliceBackgroundPixel(r, g, b, a)) continue;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < 85 || lum > 195) ink++;
    }
  }
  return total > 0 ? ink / total : 0;
}

/** 1 = likely readable model text in caption band; lower when phrase set but band is empty. */
export function scoreModelDrawnTextContrast(frame: RgbaFrame, phrase: string): number {
  const trimmed = phrase.trim();
  if (!trimmed) return 1;
  const ink = Math.max(
    measureCaptionBandInkRatio(frame, 'bottom'),
    measureCaptionBandInkRatio(frame, 'top')
  );
  if (ink >= 0.01) return 1;
  if (ink >= 0.004) return 0.75;
  if (ink >= 0.0015) return 0.55;
  return 0.35;
}

export function scoreLineUploadFit(
  frame: RgbaFrame,
  pngBytes: number
): { score: number; width: number; height: number; warnings: string[] } {
  const fit = computeFitDimensions(
    frame.width,
    frame.height,
    LINE_STICKER_UPLOAD.stickerMaxWidth,
    LINE_STICKER_UPLOAD.stickerMaxHeight
  );
  const warnings: string[] = [];
  let score = 1;
  if (pngBytes > LINE_STICKER_UPLOAD.maxFileBytes) {
    score = 0.2;
    warnings.push(
      `PNG ${pngBytes} bytes exceeds LINE limit ${LINE_STICKER_UPLOAD.maxFileBytes}`
    );
  } else if (pngBytes > LINE_STICKER_UPLOAD.maxFileBytes * 0.9) {
    score = 0.75;
    warnings.push(`PNG size ${pngBytes} bytes is close to 1MB LINE limit`);
  }
  if (frame.width > LINE_STICKER_UPLOAD.stickerMaxWidth * 1.05) {
    score = Math.min(score, 0.85);
  }
  if (frame.height > LINE_STICKER_UPLOAD.stickerMaxHeight * 1.05) {
    score = Math.min(score, 0.85);
  }
  return { score, width: fit.width, height: fit.height, warnings };
}

function scoreForegroundRatio(ratio: number): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  if (ratio < FOREGROUND_MIN) {
    warnings.push(`empty or nearly empty cell (foreground ${(ratio * 100).toFixed(1)}%)`);
    return { score: 0.2, warnings };
  }
  if (ratio > FOREGROUND_MAX) {
    warnings.push(`cell mostly opaque (${(ratio * 100).toFixed(1)}%) — possible bad chroma or bleed`);
    return { score: 0.5, warnings };
  }
  if (ratio < 0.05) {
    return { score: 0.65, warnings: [`low foreground ${(ratio * 100).toFixed(1)}%`] };
  }
  return { score: 1, warnings };
}

export function auditStickerFrame(
  input: StickerFrameQaInput,
  medianWidth: number,
  medianHeight: number
): StickerFrameQaEntry {
  const { frame, globalIndex, sheet, index, phrase = '', checkModelText = false } = input;
  const warnings: string[] = [];

  const foregroundRatio = measureForegroundRatio(frame);
  const fg = scoreForegroundRatio(foregroundRatio);
  warnings.push(...fg.warnings);

  const dimensionScore = scoreDimensionAgainstMedian(
    frame.width,
    frame.height,
    medianWidth,
    medianHeight
  );
  if (dimensionScore < 0.7) {
    warnings.push(
      `unusual size ${frame.width}×${frame.height} vs median ${Math.round(medianWidth)}×${Math.round(medianHeight)}`
    );
  }

  let textContrastScore: number | undefined;
  if (checkModelText) {
    textContrastScore = scoreModelDrawnTextContrast(frame, phrase);
    if (textContrastScore < 0.6 && phrase.trim()) {
      warnings.push('caption band may lack readable model-drawn text');
    }
  }

  const pngBytes = input.pngBytes ?? Math.round(frame.width * frame.height * 2.2);
  const line = scoreLineUploadFit(frame, pngBytes);
  warnings.push(...line.warnings);

  const parts = [fg.score, dimensionScore, line.score];
  if (textContrastScore != null) parts.push(textContrastScore);
  const overallScore = parts.reduce((sum, s) => sum + s, 0) / parts.length;

  return {
    globalIndex,
    sheet,
    index,
    phrase,
    width: frame.width,
    height: frame.height,
    foregroundRatio,
    dimensionScore,
    textContrastScore,
    lineUploadWidth: line.width,
    lineUploadHeight: line.height,
    lineUploadBytes: pngBytes,
    lineUploadScore: line.score,
    overallScore,
    warnings,
  };
}

export function auditStickerFrames(
  inputs: StickerFrameQaInput[],
  options: { checkModelText?: boolean; warnThreshold?: number } = {}
): StickerQaReport {
  const checkModelText = options.checkModelText ?? false;
  const warnThreshold = options.warnThreshold ?? DEFAULT_QA_WARN_THRESHOLD;
  const widths = inputs.map((i) => i.frame.width);
  const heights = inputs.map((i) => i.frame.height);
  const medianWidth = median(widths);
  const medianHeight = median(heights);

  const entries = inputs.map((input) =>
    auditStickerFrame(
      { ...input, checkModelText: input.checkModelText ?? checkModelText },
      medianWidth,
      medianHeight
    )
  );

  const overallScore =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + e.overallScore, 0) / entries.length
      : 1;

  const lowEntries = entries.filter((e) => e.overallScore < warnThreshold);
  const summaryWarnings: string[] = [];
  if (lowEntries.length > 0) {
    summaryWarnings.push(
      `${lowEntries.length}/${entries.length} stickers scored below ${warnThreshold.toFixed(2)}`
    );
    for (const e of lowEntries.slice(0, 8)) {
      summaryWarnings.push(
        `sticker-${String(e.globalIndex).padStart(2, '0')}: ${e.warnings.join('; ') || 'low score'}`
      );
    }
    if (lowEntries.length > 8) {
      summaryWarnings.push(`… and ${lowEntries.length - 8} more (see qa-report.json)`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    stickerCount: entries.length,
    checkModelText,
    medianWidth,
    medianHeight,
    overallScore,
    pass: lowEntries.length === 0,
    warnThreshold,
    entries,
    summaryWarnings,
  };
}
