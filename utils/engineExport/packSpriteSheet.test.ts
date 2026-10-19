import UPNG from 'upng-js';
import { describe, expect, it } from 'vitest';
import { buildAsepriteExport } from './buildAsepriteExport';
import { packSpriteSheetFromFrameDataUrls } from './packSpriteSheet';
import { timingFromPlaybackSpeed } from './timing';

function solidPngDataUrl(width: number, height: number, rgba: [number, number, number, number]): string {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  const buffer = UPNG.encode([data.buffer], width, height, 0);
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:image/png;base64,${btoa(binary)}`;
}

describe('packSpriteSheetFromFrameDataUrls', () => {
  it('packs equal frames into a horizontal atlas', () => {
    const frames = [
      solidPngDataUrl(2, 2, [255, 0, 0, 255]),
      solidPngDataUrl(2, 2, [0, 255, 0, 255]),
    ];
    const packed = packSpriteSheetFromFrameDataUrls(frames);
    expect(packed.layout).toMatchObject({
      sheetWidth: 4,
      sheetHeight: 2,
      cols: 2,
      rows: 1,
      frameCount: 2,
    });
    expect(packed.sheetPngBytes.byteLength).toBeGreaterThan(20);
  });
});

describe('buildAsepriteExport', () => {
  it('pairs atlas bytes with Phaser-loadable Aseprite JSON', () => {
    const frames = [
      solidPngDataUrl(4, 4, [10, 20, 30, 255]),
      solidPngDataUrl(4, 4, [40, 50, 60, 255]),
      solidPngDataUrl(4, 4, [70, 80, 90, 255]),
    ];
    const exported = buildAsepriteExport({
      frameDataUrls: frames,
      timing: timingFromPlaybackSpeed(1),
      cols: 3,
      rows: 1,
    });
    const aseprite = JSON.parse(exported.asepriteJsonText) as {
      frames: Array<{ duration: number; frame: { x: number } }>;
      meta: { image: string; frameTags: Array<{ from: number; to: number }> };
    };

    expect(exported.sheetFileName).toBe('sprite-sheet.png');
    expect(aseprite.meta.image).toBe('sprite-sheet.png');
    expect(aseprite.frames).toHaveLength(3);
    expect(aseprite.meta.frameTags[0]).toMatchObject({ from: 0, to: 2 });
    expect(exported.sheetPngBytes.byteLength).toBeGreaterThan(40);
  });
});
