import { describe, expect, it } from 'vitest';
import { buildAsepriteJsonArray, stringifyAsepriteJson } from './asepriteJson';
import { layoutFrames } from './layoutFrames';
import { timingFromPlaybackSpeed } from './timing';

describe('buildAsepriteJsonArray', () => {
  it('matches Aseprite json-array shape used by Phaser load.aseprite', () => {
    const { layout, rects } = layoutFrames({
      frameWidth: 32,
      frameHeight: 48,
      frameCount: 4,
      cols: 4,
      rows: 1,
    });
    const timing = timingFromPlaybackSpeed(3); // 9 FPS → ~111ms
    const doc = buildAsepriteJsonArray({
      rects,
      frameWidth: layout.frameWidth,
      frameHeight: layout.frameHeight,
      sheetWidth: layout.sheetWidth,
      sheetHeight: layout.sheetHeight,
      timing,
      imageFileName: 'sprite-sheet.png',
      tagName: 'default',
    });

    expect(Array.isArray(doc.frames)).toBe(true);
    expect(doc.frames).toHaveLength(4);
    expect(doc.frames[0]).toMatchObject({
      filename: '0',
      frame: { x: 0, y: 0, w: 32, h: 48 },
      rotated: false,
      trimmed: false,
      duration: timing.durationMs,
    });
    expect(doc.frames[3].frame).toEqual({ x: 96, y: 0, w: 32, h: 48 });
    expect(doc.meta).toMatchObject({
      image: 'sprite-sheet.png',
      format: 'RGBA8888',
      size: { w: 128, h: 48 },
      scale: '1',
    });
    expect(doc.meta.frameTags).toEqual([
      { name: 'default', from: 0, to: 3, direction: 'forward' },
    ]);

    const parsed = JSON.parse(stringifyAsepriteJson(doc)) as typeof doc;
    expect(parsed.frames[1].filename).toBe('1');
    expect(parsed.meta.frameTags[0].to).toBe(3);
  });
});
