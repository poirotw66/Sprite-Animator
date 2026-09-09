/** Backward-compatible CLI exports; the canonical layout lives in shared domain. */
export {
  DEFAULT_LINE_STICKER_SET_COUNT,
  LINE_STICKER_SET_LAYOUTS,
  resolveLineStickerSetLayout as resolveSetLayout,
  splitPhrasesAcrossSheets,
  totalFramesFromLayouts,
} from '../../features/line-sticker/domain/lineStickerLayout.ts';

export type {
  LineStickerSheetLayout as GridSize,
  SupportedLineStickerSetCount,
} from '../../features/line-sticker/domain/lineStickerLayout.ts';
