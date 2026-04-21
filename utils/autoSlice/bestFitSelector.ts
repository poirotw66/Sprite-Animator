import type { AutoSliceScoredCandidate } from './types';

export type BestFitDecision =
  | {
      status: 'accepted';
      confidence: 'high' | 'low';
      selected: AutoSliceScoredCandidate;
    }
  | {
      status: 'low_confidence';
      selected: AutoSliceScoredCandidate;
    };

function compareByScoreDescending(
  left: AutoSliceScoredCandidate,
  right: AutoSliceScoredCandidate
): number {
  return right.score - left.score;
}

export function selectBestCandidate(candidates: AutoSliceScoredCandidate[]): BestFitDecision {
  const selected = [...candidates].sort(compareByScoreDescending)[0];

  if (!selected) {
    throw new Error('No auto-slice candidates available');
  }

  if (selected.score >= 75) {
    return {
      status: 'accepted',
      confidence: 'high',
      selected,
    };
  }

  if (selected.score >= 60) {
    return {
      status: 'accepted',
      confidence: 'low',
      selected,
    };
  }

  return {
    status: 'low_confidence',
    selected,
  };
}
