import { useCallback, useRef } from 'react';
import type { ProfilerOnRenderCallback } from 'react';
import { logger } from '../utils/logger';
import { updateRenderProfilerEntry } from '../utils/renderProfilerStore';

interface RenderProfilerStats {
  renderCount: number;
  totalDuration: number;
  maxDuration: number;
}

const round = (value: number) => Number(value.toFixed(2));

export const useRenderProfiler = (id: string): ProfilerOnRenderCallback => {
  const statsRef = useRef<RenderProfilerStats>({
    renderCount: 0,
    totalDuration: 0,
    maxDuration: 0,
  });

  return useCallback<ProfilerOnRenderCallback>((profilerId, phase, actualDuration, baseDuration) => {
    const nextRenderCount = statsRef.current.renderCount + 1;
    const nextTotalDuration = statsRef.current.totalDuration + actualDuration;
    const nextMaxDuration = Math.max(statsRef.current.maxDuration, actualDuration);

    statsRef.current = {
      renderCount: nextRenderCount,
      totalDuration: nextTotalDuration,
      maxDuration: nextMaxDuration,
    };

    logger.debug(`render-profiler:${id}`, {
      profilerId,
      phase,
      renderCount: nextRenderCount,
      actualDuration: round(actualDuration),
      baseDuration: round(baseDuration),
      averageDuration: round(nextTotalDuration / nextRenderCount),
      maxDuration: round(nextMaxDuration),
    });

    updateRenderProfilerEntry({
      id,
      profilerId,
      phase,
      renderCount: nextRenderCount,
      actualDuration: round(actualDuration),
      baseDuration: round(baseDuration),
      averageDuration: round(nextTotalDuration / nextRenderCount),
      maxDuration: round(nextMaxDuration),
      lastUpdatedAt: Date.now(),
    });
  }, [id]);
};