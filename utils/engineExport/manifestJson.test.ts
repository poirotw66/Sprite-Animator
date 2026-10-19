import { describe, expect, it } from 'vitest';
import { layoutFrames } from './layoutFrames';
import { buildSpriteExportManifest, stringifySpriteExportManifest } from './manifestJson';
import { timingFromPlaybackSpeed } from './timing';

describe('buildSpriteExportManifest', () => {
  it('includes cols/rows, frame size, fps, frame count, and loop', () => {
    const { layout } = layoutFrames({
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 6,
      cols: 3,
      rows: 2,
    });
    const timing = timingFromPlaybackSpeed(4); // 12 FPS
    const manifest = buildSpriteExportManifest({ layout, timing });

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      cols: 3,
      rows: 2,
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 6,
      fps: 12,
      durationMs: timing.durationMs,
      loop: true,
      sheet: { fileName: 'sprite-sheet.png', width: 192, height: 128 },
      aseprite: { fileName: 'sprite-sheet.json', format: 'json-array' },
      godot: { spriteFramesFileName: 'animation.tres' },
    });

    const text = stringifySpriteExportManifest(manifest);
    expect(JSON.parse(text).frameCount).toBe(6);
  });
});
