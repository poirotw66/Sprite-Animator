import type { SliceSettings } from './imageUtils';
import { buildEmptyManualBounds, buildEqualManualBounds } from './manualGridBounds';

/** Enter manual mode with no interior lines (clears prior grid). */
export function enableManualSliceMode(
  settings: SliceSettings,
  sheetWidth: number,
  sheetHeight: number
): SliceSettings {
  const empty = buildEmptyManualBounds(sheetWidth, sheetHeight);
  return {
    ...settings,
    sliceMode: 'manual',
    manualXBounds: empty.xBounds,
    manualYBounds: empty.yBounds,
    cols: 1,
    rows: 1,
  };
}

/** Seed equal cols×rows dividers while staying in manual mode. */
export function seedEqualManualSliceMode(
  settings: SliceSettings,
  sheetWidth: number,
  sheetHeight: number
): SliceSettings {
  const seeded = buildEqualManualBounds(
    sheetWidth,
    sheetHeight,
    settings.cols,
    settings.rows
  );
  return {
    ...settings,
    sliceMode: 'manual',
    manualXBounds: seeded.xBounds,
    manualYBounds: seeded.yBounds,
    cols: seeded.xBounds.length - 1,
    rows: seeded.yBounds.length - 1,
  };
}
