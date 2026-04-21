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
    }
  | {
      status: 'hard_guard_failed';
      selected: AutoSliceScoredCandidate;
    };

function compareByScoreDescending(
  left: AutoSliceScoredCandidate,
  right: AutoSliceScoredCandidate
): number {
  return right.score - left.score;
}

function isFiniteScoreCandidate(candidate: AutoSliceScoredCandidate): boolean {
  return Number.isFinite(candidate.score);
}

function failsHardGuards(candidate: AutoSliceScoredCandidate): boolean {
  const { foregroundOccupancy, bboxStability } = candidate.metrics;
  return foregroundOccupancy < 0.1 || bboxStability < 0.1;
}

export function selectBestCandidate(candidates: AutoSliceScoredCandidate[]): BestFitDecision {
  const selected = [...candidates].sort(compareByScoreDescending)[0];

  if (!selected) {
    throw new Error('No auto-slice candidates available');
  }

  if (!isFiniteScoreCandidate(selected) || failsHardGuards(selected)) {
    return {
      status: 'hard_guard_failed',
      selected,
    };
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
