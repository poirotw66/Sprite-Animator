import type { AutoSliceCandidate, AutoSliceMetrics, AutoSliceScoredCandidate } from './types';

const MAX_SHIFT = 2;

const METRIC_WEIGHTS = {
  bboxStability: 35,
  centroidDrift: 25,
  foregroundOccupancy: 20,
  edgePenalty: 10,
  temporalConsistency: 10,
} as const;

function clampToUnitRange(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return Number(value.toFixed(4));
}

function computeMetrics(candidate: AutoSliceCandidate): AutoSliceMetrics {
  const absShiftX = Math.abs(candidate.shiftX);
  const absShiftY = Math.abs(candidate.shiftY);
  const manhattanShift = absShiftX + absShiftY;
  const euclideanShift = Math.hypot(absShiftX, absShiftY);

  return {
    bboxStability: clampToUnitRange(1 - manhattanShift / (MAX_SHIFT * 2)),
    centroidDrift: clampToUnitRange(1 - euclideanShift / Math.hypot(MAX_SHIFT, MAX_SHIFT)),
    foregroundOccupancy: clampToUnitRange(0.9 - manhattanShift * 0.15),
    edgePenalty: clampToUnitRange(1 - Math.max(absShiftX, absShiftY) / MAX_SHIFT),
    temporalConsistency: clampToUnitRange(1 - manhattanShift / (MAX_SHIFT * 2)),
  };
}

function computeWeightedScore(metrics: AutoSliceMetrics): number {
  return Math.round(
    metrics.bboxStability * METRIC_WEIGHTS.bboxStability +
      metrics.centroidDrift * METRIC_WEIGHTS.centroidDrift +
      metrics.foregroundOccupancy * METRIC_WEIGHTS.foregroundOccupancy +
      metrics.edgePenalty * METRIC_WEIGHTS.edgePenalty +
      metrics.temporalConsistency * METRIC_WEIGHTS.temporalConsistency
  );
}

export function scoreCandidates(candidates: AutoSliceCandidate[]): AutoSliceScoredCandidate[] {
  return candidates.map((candidate) => {
    const metrics = computeMetrics(candidate);

    return {
      candidate,
      metrics,
      score: computeWeightedScore(metrics),
    };
  });
}
