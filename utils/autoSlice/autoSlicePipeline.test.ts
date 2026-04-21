import { describe, expect, it } from 'vitest';

import { runAutoSlicePipeline } from './autoSlicePipeline';
import { scoreCandidates } from './contentConsistencyStage';
import { buildGridHypotheses } from './gridHypothesisStage';
import type { AutoSliceScoredCandidate } from './types';

function createScoredCandidate(
  score: number,
  overrides: Partial<AutoSliceScoredCandidate> = {}
): AutoSliceScoredCandidate {
  const baseline: AutoSliceScoredCandidate = {
    candidate: {
      cols: 4,
      rows: 4,
      shiftX: 0,
      shiftY: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
    },
    score,
    metrics: {
      bboxStability: 0.8,
      centroidDrift: 0.8,
      foregroundOccupancy: 0.8,
      edgePenalty: 0.8,
      temporalConsistency: 0.8,
    },
  };

  return {
    ...baseline,
    ...overrides,
    candidate: {
      ...baseline.candidate,
      ...(overrides.candidate ?? {}),
    },
    metrics: {
      ...baseline.metrics,
      ...(overrides.metrics ?? {}),
    },
  };
}

describe('buildGridHypotheses', () => {
  it('builds a deterministic centered candidate window', () => {
    const candidates = buildGridHypotheses(4, 4);

    expect(candidates).toHaveLength(25);
    expect(candidates[0]).toEqual({
      cols: 4,
      rows: 4,
      shiftX: 0,
      shiftY: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
    });
    expect(candidates.at(-1)).toEqual({
      cols: 4,
      rows: 4,
      shiftX: 2,
      shiftY: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
    });
    expect(new Set(candidates.map((candidate) => `${candidate.shiftX}:${candidate.shiftY}`)).size).toBe(25);
  });
});

describe('scoreCandidates', () => {
  it('produces weighted deterministic scores for each candidate', async () => {
    const [centerCandidate, edgeCandidate] = await scoreCandidates([
      {
        cols: 4,
        rows: 4,
        shiftX: 0,
        shiftY: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
      },
      {
        cols: 4,
        rows: 4,
        shiftX: 2,
        shiftY: 2,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
      },
    ]);

    expect(centerCandidate.score).toBeGreaterThan(edgeCandidate.score);
    expect(centerCandidate.metrics).toEqual({
      bboxStability: 1,
      centroidDrift: 1,
      foregroundOccupancy: 0.9,
      edgePenalty: 1,
      temporalConsistency: 1,
    });
    expect(edgeCandidate.metrics.bboxStability).toBeLessThan(centerCandidate.metrics.bboxStability);
    expect(edgeCandidate.metrics.foregroundOccupancy).toBeLessThan(centerCandidate.metrics.foregroundOccupancy);
  });
});

describe('runAutoSlicePipeline', () => {
  it('returns accepted result with selected candidate and confidence', async () => {
    const result = await runAutoSlicePipeline({
      base64Image: 'data:image/png;base64,accepted-sample',
      cols: 4,
      rows: 4,
      timeoutMs: 500,
    });

    expect(result).toMatchObject({
      status: 'accepted',
      confidence: 'high',
    });
    expect(result.selected.candidate.shiftX).toBe(0);
    expect(result.selected.candidate.shiftY).toBe(0);
  });

  it('returns low_confidence with a fallback hint when top score misses threshold', async () => {
    const result = await runAutoSlicePipeline({
      base64Image: 'data:image/png;base64,low-confidence-sample',
      cols: 4,
      rows: 4,
      timeoutMs: 500,
      scoreCandidates: async () => [createScoredCandidate(59)],
    });

    expect(result).toEqual({
      status: 'low_confidence',
      selected: createScoredCandidate(59),
      hint: {
        suggestedCols: 4,
        suggestedRows: 4,
        suggestedShiftX: 0,
        suggestedShiftY: 0,
        reason: 'low_confidence',
      },
    });
  });

  it('returns hard_guard_failed with a fallback hint when the selected candidate fails guards', async () => {
    const result = await runAutoSlicePipeline({
      base64Image: 'data:image/png;base64,hard-guard-sample',
      cols: 4,
      rows: 4,
      timeoutMs: 500,
      scoreCandidates: async () => [
        createScoredCandidate(91, {
          metrics: {
            bboxStability: 0.05,
            centroidDrift: 0.8,
            foregroundOccupancy: 0.8,
            edgePenalty: 0.8,
            temporalConsistency: 0.8,
          },
        }),
      ],
    });

    expect(result).toEqual({
      status: 'hard_guard_failed',
      selected: createScoredCandidate(91, {
        metrics: {
          bboxStability: 0.05,
          centroidDrift: 0.8,
          foregroundOccupancy: 0.8,
          edgePenalty: 0.8,
          temporalConsistency: 0.8,
        },
      }),
      hint: {
        suggestedCols: 4,
        suggestedRows: 4,
        suggestedShiftX: 0,
        suggestedShiftY: 0,
        reason: 'hard_guard_failed',
      },
    });
  });

  it('returns timeout fallback when the runtime budget is exceeded', async () => {
    const nowValues = [100, 650];
    const result = await runAutoSlicePipeline({
      base64Image: 'data:image/png;base64,timeout-sample',
      cols: 4,
      rows: 4,
      timeoutMs: 500,
      now: () => {
        const nextValue = nowValues.shift();
        return nextValue ?? 650;
      },
      scoreCandidates: async (candidates) => scoreCandidates(candidates),
    });

    expect(result).toEqual({
      status: 'fallback',
      reason: 'timeout',
    });
  });
});
