import { describe, expect, it } from 'vitest';
import { buildGodotSpriteFramesTres } from './godotSpriteFrames';
import { timingFromPlaybackSpeed } from './timing';

describe('buildGodotSpriteFramesTres', () => {
  it('emits a Godot 4 SpriteFrames resource referencing frame PNGs', () => {
    const timing = timingFromPlaybackSpeed(2); // 6 FPS
    const tres = buildGodotSpriteFramesTres({
      frameCount: 3,
      timing,
      framesDirectory: 'frames',
      animationName: 'default',
    });

    expect(tres).toContain('[gd_resource type="SpriteFrames" load_steps=4 format=3]');
    expect(tres).toContain(
      '[ext_resource type="Texture2D" path="res://frames/frame_001.png" id="1"]',
    );
    expect(tres).toContain(
      '[ext_resource type="Texture2D" path="res://frames/frame_003.png" id="3"]',
    );
    expect(tres).toContain('"name": &"default"');
    expect(tres).toContain('"loop": true');
    expect(tres).toContain(`"speed": ${timing.fps.toFixed(1)}`);
  });
});
