/**
 * Serializable LINE sticker job data shared by browser persistence and CLI
 * adapters. Image bytes deliberately live outside this schema; adapters store
 * them and reference them by a stable asset id/path/URL.
 */

import {
  resolveLineStickerSetLayout,
  totalFramesFromLayouts,
  type SupportedLineStickerSetCount,
} from './lineStickerLayout';

export const LINE_STICKER_JOB_SCHEMA_VERSION = 2 as const;
export const DEFAULT_BROWSER_LINE_STICKER_SET_COUNT = 48;
export const DEFAULT_LINE_STICKER_SHEET_COUNT = 3;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type PipelineStage =
  | 'idle'
  | 'validating'
  | 'queued'
  | 'generating'
  | 'processing'
  | 'slicing'
  | 'qa'
  | 'packaging'
  | 'ready'
  | 'failed'
  | 'cancelled';

export type LineStickerJobMode = 'single' | 'set';

export interface LineStickerAssetRef {
  /** Adapter-owned identifier, such as an IndexedDB key or relative file path. */
  id: string;
  mimeType?: string;
}

export interface LineStickerJobSheet {
  /** Stable across retries, persistence, and a CLI resume. */
  id: string;
  /** Display/order position. It is not required to be a contiguous array index. */
  index: number;
  cols: number;
  rows: number;
  expectedFrames: number;
  phrases: string[];
  actionDescriptions?: string[];
  sourceAsset?: LineStickerAssetRef;
  generatedAsset?: LineStickerAssetRef;
  processedAsset?: LineStickerAssetRef;
  frameAssets?: LineStickerAssetRef[];
}

export interface LineStickerJob {
  schemaVersion: typeof LINE_STICKER_JOB_SCHEMA_VERSION;
  id: string;
  mode: LineStickerJobMode;
  stickerCount: number;
  createdAt: string;
  updatedAt: string;
  sourceAsset?: LineStickerAssetRef;
  sheets: LineStickerJobSheet[];
  metadata?: { [key: string]: JsonValue };
}

export interface CreateLineStickerJobOptions {
  id: string;
  mode: LineStickerJobMode;
  stickerCount?: SupportedLineStickerSetCount;
  createdAt: string;
  updatedAt?: string;
  sourceAsset?: LineStickerAssetRef;
  sheets?: LineStickerJobSheet[];
  metadata?: { [key: string]: JsonValue };
}

/** The current browser set has three 4×4 sheets, while callers may supply more. */
export function createLineStickerJobSheets(stickerCount: SupportedLineStickerSetCount): LineStickerJobSheet[] {
  return resolveLineStickerSetLayout(stickerCount).map(({ cols, rows }, index) => ({
    id: `sheet-${index}`,
    index,
    cols,
    rows,
    expectedFrames: cols * rows,
    phrases: [],
  }));
}

/** Current browser default: the legacy 48-sticker, three-sheet workspace. */
export function createDefaultLineStickerJobSheets(): LineStickerJobSheet[] {
  return createLineStickerJobSheets(DEFAULT_BROWSER_LINE_STICKER_SET_COUNT);
}

export function createLineStickerJob({
  id,
  mode,
  stickerCount = DEFAULT_BROWSER_LINE_STICKER_SET_COUNT,
  createdAt,
  updatedAt = createdAt,
  sourceAsset,
  sheets = createLineStickerJobSheets(stickerCount),
  metadata,
}: CreateLineStickerJobOptions): LineStickerJob {
  return {
    schemaVersion: LINE_STICKER_JOB_SCHEMA_VERSION,
    id,
    mode,
    stickerCount: totalFramesFromLayouts(sheets),
    createdAt,
    updatedAt,
    ...(sourceAsset ? { sourceAsset } : {}),
    sheets,
    ...(metadata ? { metadata } : {}),
  };
}
