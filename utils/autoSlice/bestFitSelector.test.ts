import { describe, expect, it } from 'vitest';
import { selectBestCandidate } from './bestFitSelector';
import type { AutoSliceScoredCandidate } from './types';

describe('selectBestCandidate', () => {
  it('returns low-confidence decision below threshold', () => {
    const candidates: AutoSliceScoredCandidate[] = [
      {
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
        score: 59,
        metrics: {
          bboxStability: 0.5,
          centroidDrift: 0.5,
          foregroundOccupancy: 0.5,
          edgePenalty: 0.5,
          temporalConsistency: 0.5,
        },
      },
    ];

    const result = selectBestCandidate(candidates);

    expect(result.status).toBe('low_confidence');
  });
});
