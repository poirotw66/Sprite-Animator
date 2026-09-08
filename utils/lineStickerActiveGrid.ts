import type { SliceSettings } from './imageUtils';
import { LINE_STICKER_SET_COLS, LINE_STICKER_SET_ROWS } from './lineStickerSetSchema';

/** Set mode is always 4 × 4; one-sheet mode follows the viewer's slice grid. */
export function getLineStickerActiveGrid(
  stickerSetMode: boolean,
  singleSheetSliceSettings: Pick<SliceSettings, 'cols' | 'rows'>,
) {
  return stickerSetMode
    ? { cols: LINE_STICKER_SET_COLS, rows: LINE_STICKER_SET_ROWS }
    : { cols: singleSheetSliceSettings.cols, rows: singleSheetSliceSettings.rows };
}
