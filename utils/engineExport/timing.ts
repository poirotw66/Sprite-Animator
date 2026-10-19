import { ANIMATION_FPS_MULTIPLIER } from '../constants';
import type { EngineExportTiming } from './types';

/** Map AnimationConfig.speed to export FPS / per-frame duration. */
export function timingFromPlaybackSpeed(
  speed: number,
  options: { loop?: boolean } = {},
): EngineExportTiming {
  const fps = Math.max(1, speed * ANIMATION_FPS_MULTIPLIER);
  const durationMs = Math.max(1, Math.round(1000 / fps));
  return {
    fps,
    durationMs,
    loop: options.loop ?? true,
  };
}
