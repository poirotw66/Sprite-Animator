import { describe, expect, it } from 'vitest';

import { runAutoSlicePipeline } from './autoSlicePipeline';
import { scoreCandidates } from './contentConsistencyStage';
import { buildGridHypotheses } from './gridHypothesisStage';
import type { AutoSliceImageData, AutoSliceScoredCandidate } from './types';

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

  it('preserves provided base candidate padding contract', () => {
    const candidates = buildGridHypotheses(4, 4, {
      shiftX: 3,
      shiftY: -2,
      paddingLeft: 2,
      paddingRight: 1,
      paddingTop: 4,
      paddingBottom: 3,
    });

    expect(candidates[0]).toMatchObject({
      shiftX: 3,
      shiftY: -2,
      paddingLeft: 2,
      paddingRight: 1,
      paddingTop: 4,
      paddingBottom: 3,
    });
  });
});

describe('scoreCandidates', () => {
  it('produces weighted deterministic scores for each candidate', () => {
    const imageData: AutoSliceImageData = {
      width: 8,
      height: 8,
      pixels: new Uint8ClampedArray(8 * 8 * 4).fill(255),
    };
    const [centerCandidate, edgeCandidate] = scoreCandidates(
      [
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
      ],
      imageData
    );

    expect(centerCandidate.score).toBeGreaterThan(edgeCandidate.score);
    expect(centerCandidate.metrics.bboxStability).toBe(1);
    expect(edgeCandidate.metrics.bboxStability).toBeLessThan(centerCandidate.metrics.bboxStability);
  });

  it('uses image content path so identical geometry can score differently', () => {
    const darkImageData: AutoSliceImageData = {
      width: 8,
      height: 8,
      pixels: new Uint8ClampedArray(8 * 8 * 4).fill(0),
    };
    const brightImageData: AutoSliceImageData = {
      width: 8,
      height: 8,
      pixels: new Uint8ClampedArray(8 * 8 * 4).fill(255),
    };
    const candidate = {
      cols: 4,
      rows: 4,
      shiftX: 0,
      shiftY: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
    };

    const darkScore = scoreCandidates([candidate], darkImageData)[0].score;
    const brightScore = scoreCandidates([candidate], brightImageData)[0].score;

    expect(brightScore).toBeGreaterThan(darkScore);
  });
});

describe('runAutoSlicePipeline', () => {
  const defaultImageData: AutoSliceImageData = {
    width: 8,
    height: 8,
    pixels: new Uint8ClampedArray(8 * 8 * 4).fill(255),
  };

  it('returns accepted result with selected candidate and confidence', async () => {
    const result = await runAutoSlicePipeline({
      base64Image: 'data:image/png;base64,accepted-sample',
      cols: 4,
      rows: 4,
      timeoutMs: 500,
      imageData: defaultImageData,
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
      imageData: defaultImageData,
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
      imageData: defaultImageData,
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
      imageData: defaultImageData,
      now: () => {
        const nextValue = nowValues.shift();
        return nextValue ?? 650;
      },
      scoreCandidates: async (candidates, imageData) => scoreCandidates(candidates, imageData),
    });

    expect(result).toEqual({
      status: 'fallback',
      reason: 'timeout',
    });
  });

  it('returns structured fallback when scoring stage throws', async () => {
    const result = await runAutoSlicePipeline({
      base64Image: 'data:image/png;base64,error-sample',
      cols: 4,
      rows: 4,
      timeoutMs: 500,
      imageData: defaultImageData,
      scoreCandidates: async () => {
        throw new Error('scoring exploded');
      },
    });

    expect(result).toEqual({
      status: 'fallback',
      reason: 'stage_error',
      stage: 'scoring',
      message: 'scoring exploded',
    });
  });

  it('preserves padding values in selected candidate path', async () => {
    const result = await runAutoSlicePipeline({
      base64Image: 'data:image/png;base64,padding-sample',
      cols: 4,
      rows: 4,
      timeoutMs: 500,
      imageData: defaultImageData,
      baseCandidate: {
        paddingLeft: 3,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 4,
      },
      scoreCandidates: async (candidates, imageData) => scoreCandidates(candidates, imageData),
    });

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.selected.candidate).toMatchObject({
        paddingLeft: 3,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 4,
      });
    }
  });
});
