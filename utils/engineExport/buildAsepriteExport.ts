import { buildAsepriteJsonArray, stringifyAsepriteJson } from './asepriteJson';
import { packSpriteSheetFromFrameDataUrls } from './packSpriteSheet';
import type { EngineExportLayout, EngineExportTiming } from './types';

export interface AsepriteExportFiles {
  sheetFileName: string;
  asepriteFileName: string;
  sheetPngBytes: Uint8Array;
  asepriteJsonText: string;
  layout: EngineExportLayout;
}

export function buildAsepriteExport(input: {
  frameDataUrls: string[];
  timing: EngineExportTiming;
  cols?: number;
  rows?: number;
}): AsepriteExportFiles {
  const packed = packSpriteSheetFromFrameDataUrls(input.frameDataUrls, {
    cols: input.cols,
    rows: input.rows,
  });
  const sheetFileName = 'sprite-sheet.png';
  const asepriteFileName = 'sprite-sheet.json';
  const aseprite = buildAsepriteJsonArray({
    rects: packed.rects,
    frameWidth: packed.layout.frameWidth,
    frameHeight: packed.layout.frameHeight,
    sheetWidth: packed.layout.sheetWidth,
    sheetHeight: packed.layout.sheetHeight,
    timing: input.timing,
    imageFileName: sheetFileName,
    tagName: 'default',
    filenameFormat: '{frame}',
  });

  return {
    sheetFileName,
    asepriteFileName,
    sheetPngBytes: packed.sheetPngBytes,
    asepriteJsonText: stringifyAsepriteJson(aseprite),
    layout: packed.layout,
  };
}
