// Type declarations for third-party modules without TypeScript support

declare module 'upng-js' {
  export interface APNGFrame {
    delay: number;
  }

  export interface APNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: APNGFrame[];
    tabs: Record<string, unknown>;
    data: Uint8Array;
  }

  export function encode(
    imgs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
    dels?: number[]
  ): ArrayBuffer;

  export function decode(buffer: ArrayBuffer): APNGImage;
  export function toRGBA8(img: APNGImage): ArrayBuffer[];
}

declare module 'gifenc' {
  export interface GIFEncoderOptions {
    auto?: boolean;
  }

  export class GIFEncoder {
    constructor(opts?: GIFEncoderOptions);
    writeFrame(
      index: Uint8Array | number[],
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        dispose?: number;
        transparent?: boolean | number;
        transparentIndex?: number;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    buffer: ArrayBuffer;
    stream: Uint8Array;
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string; oneBitAlpha?: boolean | number }
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string
  ): Uint8Array;
}

// Vite env types
interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
