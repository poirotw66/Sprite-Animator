import type { AsepriteFrameRect, EngineExportTiming } from './types';

/** Aseprite CLI `--format json-array` frame entry (subset used by Phaser). */
export interface AsepriteJsonArrayFrame {
  filename: string;
  frame: AsepriteFrameRect;
  rotated: false;
  trimmed: false;
  spriteSourceSize: AsepriteFrameRect;
  sourceSize: { w: number; h: number };
  duration: number;
}

export interface AsepriteFrameTag {
  name: string;
  from: number;
  to: number;
  direction: 'forward' | 'reverse' | 'pingpong';
}

/** Document shape matching Aseprite json-array + Tags meta (Phaser load.aseprite). */
export interface AsepriteJsonArrayDocument {
  frames: AsepriteJsonArrayFrame[];
  meta: {
    app: string;
    version: string;
    image: string;
    format: 'RGBA8888';
    size: { w: number; h: number };
    scale: string;
    frameTags: AsepriteFrameTag[];
  };
}

export interface BuildAsepriteJsonArrayInput {
  rects: AsepriteFrameRect[];
  frameWidth: number;
  frameHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  timing: EngineExportTiming;
  /** Atlas PNG filename referenced by meta.image (e.g. sprite-sheet.png). */
  imageFileName?: string;
  /** Tag name for the full animation range. Default: "default". */
  tagName?: string;
  /** Frame filename pattern; `{frame}` is 0-based index. Default: `{frame}`. */
  filenameFormat?: string;
  app?: string;
  version?: string;
}

/**
 * Build an Aseprite-compatible JSON Array document.
 * Compatible with Aseprite `--format json-array` and Phaser `this.load.aseprite`.
 */
export function buildAsepriteJsonArray(
  input: BuildAsepriteJsonArrayInput,
): AsepriteJsonArrayDocument {
  const {
    rects,
    frameWidth,
    frameHeight,
    sheetWidth,
    sheetHeight,
    timing,
    imageFileName = 'sprite-sheet.png',
    tagName = 'default',
    filenameFormat = '{frame}',
    app = 'https://github.com/poirotw66/Sprite-Animator',
    version = '1.2.0',
  } = input;

  if (rects.length < 1) {
    throw new Error('rects must not be empty');
  }

  const frames: AsepriteJsonArrayFrame[] = rects.map((rect, index) => {
    const filename = filenameFormat.replace('{frame}', String(index));
    return {
      filename,
      frame: { ...rect },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
      sourceSize: { w: frameWidth, h: frameHeight },
      duration: timing.durationMs,
    };
  });

  return {
    frames,
    meta: {
      app,
      version,
      image: imageFileName,
      format: 'RGBA8888',
      size: { w: sheetWidth, h: sheetHeight },
      scale: '1',
      frameTags: [
        {
          name: tagName,
          from: 0,
          to: rects.length - 1,
          direction: 'forward',
        },
      ],
    },
  };
}

export function stringifyAsepriteJson(document: AsepriteJsonArrayDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
