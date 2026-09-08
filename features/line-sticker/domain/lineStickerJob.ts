/**
 * Serializable LINE sticker job data shared by browser persistence and CLI
 * adapters. Image bytes deliberately live outside this schema; adapters store
 * them and reference them by a stable asset id/path/URL.
 */

export const LINE_STICKER_JOB_SCHEMA_VERSION = 1 as const;
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
  createdAt: string;
  updatedAt: string;
  sourceAsset?: LineStickerAssetRef;
  sheets: LineStickerJobSheet[];
  metadata?: { [key: string]: JsonValue };
}

export interface CreateLineStickerJobOptions {
  id: string;
  mode: LineStickerJobMode;
  createdAt: string;
  updatedAt?: string;
  sourceAsset?: LineStickerAssetRef;
  sheets?: LineStickerJobSheet[];
  metadata?: { [key: string]: JsonValue };
}

/** The current browser set has three 4×4 sheets, while callers may supply more. */
export function createDefaultLineStickerJobSheets(): LineStickerJobSheet[] {
  return Array.from({ length: DEFAULT_LINE_STICKER_SHEET_COUNT }, (_, index) => ({
    id: `sheet-${index}`,
    index,
    phrases: [],
  }));
}

export function createLineStickerJob({
  id,
  mode,
  createdAt,
  updatedAt = createdAt,
  sourceAsset,
  sheets = createDefaultLineStickerJobSheets(),
  metadata,
}: CreateLineStickerJobOptions): LineStickerJob {
  return {
    schemaVersion: LINE_STICKER_JOB_SCHEMA_VERSION,
    id,
    mode,
    createdAt,
    updatedAt,
    ...(sourceAsset ? { sourceAsset } : {}),
    sheets,
    ...(metadata ? { metadata } : {}),
  };
}
