import type { EngineExportTiming } from './types';

export interface BuildGodotSpriteFramesInput {
  frameCount: number;
  timing: EngineExportTiming;
  /** Directory prefix inside the ZIP / project, e.g. "frames". */
  framesDirectory?: string;
  /** Animation name in SpriteFrames. */
  animationName?: string;
  /** Godot resource format version. */
  format?: 3;
}

function frameFileName(index: number): string {
  return `frame_${String(index + 1).padStart(3, '0')}.png`;
}

/**
 * Build a minimal Godot 4 SpriteFrames `.tres` that references individual PNG frames.
 * Copy the ZIP `frames/` folder next to this file (or adjust paths) and open in Godot 4.
 */
export function buildGodotSpriteFramesTres(input: BuildGodotSpriteFramesInput): string {
  const {
    frameCount,
    timing,
    framesDirectory = 'frames',
    animationName = 'default',
    format = 3,
  } = input;

  if (frameCount < 1) {
    throw new Error('frameCount must be at least 1');
  }

  const loadSteps = frameCount + 1;
  const lines: string[] = [
    `[gd_resource type="SpriteFrames" load_steps=${loadSteps} format=${format}]`,
    '',
  ];

  for (let index = 0; index < frameCount; index += 1) {
    const id = index + 1;
    const path = `res://${framesDirectory}/${frameFileName(index)}`;
    lines.push(`[ext_resource type="Texture2D" path="${path}" id="${id}"]`);
  }

  lines.push('');

  const frameEntries = Array.from({ length: frameCount }, (_, index) => {
    const id = index + 1;
    return `{\n"duration": 1.0,\n"texture": ExtResource("${id}")\n}`;
  }).join(', ');

  // Godot SpriteFrames animation speed is FPS.
  lines.push('[resource]');
  lines.push(
    `animations = [{
"frames": [${frameEntries}],
"loop": ${timing.loop ? 'true' : 'false'},
"name": &"${animationName}",
"speed": ${timing.fps.toFixed(1)}
}]`,
  );
  lines.push('');

  return lines.join('\n');
}
