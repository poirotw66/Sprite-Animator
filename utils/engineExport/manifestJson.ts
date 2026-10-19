import type { EngineExportLayout, EngineExportTiming } from './types';

/** Compact engine-friendly manifest shipped next to atlas / frames. */
export interface SpriteExportManifest {
  schemaVersion: 1;
  generator: string;
  cols: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  durationMs: number;
  loop: boolean;
  sheet: {
    fileName: string;
    width: number;
    height: number;
  };
  aseprite: {
    fileName: string;
    format: 'json-array';
  };
  framesDirectory: string;
  godot: {
    spriteFramesFileName: string;
  };
}

export interface BuildSpriteExportManifestInput {
  layout: EngineExportLayout;
  timing: EngineExportTiming;
  sheetFileName?: string;
  asepriteFileName?: string;
  framesDirectory?: string;
  godotSpriteFramesFileName?: string;
  generator?: string;
}

export function buildSpriteExportManifest(
  input: BuildSpriteExportManifestInput,
): SpriteExportManifest {
  const {
    layout,
    timing,
    sheetFileName = 'sprite-sheet.png',
    asepriteFileName = 'sprite-sheet.json',
    framesDirectory = 'frames',
    godotSpriteFramesFileName = 'animation.tres',
    generator = 'Sprite Animator',
  } = input;

  return {
    schemaVersion: 1,
    generator,
    cols: layout.cols,
    rows: layout.rows,
    frameWidth: layout.frameWidth,
    frameHeight: layout.frameHeight,
    frameCount: layout.frameCount,
    fps: timing.fps,
    durationMs: timing.durationMs,
    loop: timing.loop,
    sheet: {
      fileName: sheetFileName,
      width: layout.sheetWidth,
      height: layout.sheetHeight,
    },
    aseprite: {
      fileName: asepriteFileName,
      format: 'json-array',
    },
    framesDirectory,
    godot: {
      spriteFramesFileName: godotSpriteFramesFileName,
    },
  };
}

export function stringifySpriteExportManifest(manifest: SpriteExportManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
