import { describe, expect, it } from 'vitest';
import { buildFallbackHint } from './fallbackHintStage';
import { selectBestCandidate } from './bestFitSelector';
import type { AutoSliceScoredCandidate } from './types';
import type { AutoSliceScoredCandidate as ReExportedAutoSliceScoredCandidate } from '../imageUtils';

function createCandidate(score: number): AutoSliceScoredCandidate {
  return {
    candidate: {
      cols: 4,
      rows: 4,
      shiftX: 1,
      shiftY: -1,
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
      paddingBottom: 1,
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
}

describe('selectBestCandidate', () => {
  it('returns accepted with high confidence for score >= 75', () => {
    const result = selectBestCandidate([createCandidate(80)]);

    expect(result).toMatchObject({
      status: 'accepted',
      confidence: 'high',
    });
    expect(result.selected.score).toBe(80);
  });

  it('returns accepted with low confidence for score between 60 and 74', () => {
    const result = selectBestCandidate([createCandidate(60)]);

    expect(result).toMatchObject({
      status: 'accepted',
      confidence: 'low',
    });
    expect(result.selected.score).toBe(60);
  });

  it('returns low-confidence decision below threshold', () => {
    const candidates: AutoSliceScoredCandidate[] = [createCandidate(59)];
    const reExportSurfaceGuard: ReExportedAutoSliceScoredCandidate[] = candidates;

    const result = selectBestCandidate(candidates);

    expect(reExportSurfaceGuard).toHaveLength(1);
    expect(result.status).toBe('low_confidence');
  });

  it('throws when no candidates are available', () => {
    expect(() => selectBestCandidate([])).toThrow('No auto-slice candidates available');
  });
});

describe('buildFallbackHint', () => {
  it('returns null for accepted decisions', () => {
    const decision = selectBestCandidate([createCandidate(75)]);

    expect(buildFallbackHint(decision)).toBeNull();
  });

  it('builds a low-confidence fallback hint from the selected candidate', () => {
    const decision = selectBestCandidate([createCandidate(59)]);

    expect(buildFallbackHint(decision)).toEqual({
      suggestedCols: 4,
      suggestedRows: 4,
      suggestedShiftX: 1,
      suggestedShiftY: -1,
      reason: 'low_confidence',
    });
  });
});
