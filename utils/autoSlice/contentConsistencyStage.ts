import type {
  AutoSliceCandidate,
  AutoSliceImageData,
  AutoSliceMetrics,
  AutoSliceScoredCandidate,
} from './types';

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

function getCellSignal(imageData: AutoSliceImageData, candidate: AutoSliceCandidate): number {
  const cellWidth = Math.max(1, Math.floor(imageData.width / Math.max(candidate.cols, 1)));
  const cellHeight = Math.max(1, Math.floor(imageData.height / Math.max(candidate.rows, 1)));
  const normalizedShiftX = ((candidate.shiftX % cellWidth) + cellWidth) % cellWidth;
  const normalizedShiftY = ((candidate.shiftY % cellHeight) + cellHeight) % cellHeight;
  const centerCellX = Math.floor(candidate.cols / 2);
  const centerCellY = Math.floor(candidate.rows / 2);
  const sampleX = Math.min(
    imageData.width - 1,
    centerCellX * cellWidth + normalizedShiftX + Math.floor(cellWidth / 2)
  );
  const sampleY = Math.min(
    imageData.height - 1,
    centerCellY * cellHeight + normalizedShiftY + Math.floor(cellHeight / 2)
  );
  const index = (sampleY * imageData.width + sampleX) * 4;
  const red = imageData.pixels[index] ?? 0;
  const green = imageData.pixels[index + 1] ?? 0;
  const blue = imageData.pixels[index + 2] ?? 0;
  const alpha = imageData.pixels[index + 3] ?? 255;
  const brightness = (red + green + blue) / (255 * 3);
  const alphaRatio = alpha / 255;

  return clampToUnitRange((brightness + alphaRatio) / 2);
}

function computeMetrics(candidate: AutoSliceCandidate, imageData: AutoSliceImageData): AutoSliceMetrics {
  const absShiftX = Math.abs(candidate.shiftX);
  const absShiftY = Math.abs(candidate.shiftY);
  const manhattanShift = absShiftX + absShiftY;
  const euclideanShift = Math.hypot(absShiftX, absShiftY);
  const contentSignal = getCellSignal(imageData, candidate);
  const paddingLoad =
    candidate.paddingLeft + candidate.paddingRight + candidate.paddingTop + candidate.paddingBottom;
  const paddingPenalty = clampToUnitRange(Math.min(paddingLoad / 16, 1));

  return {
    bboxStability: clampToUnitRange(1 - manhattanShift / (MAX_SHIFT * 2) - paddingPenalty * 0.2),
    centroidDrift: clampToUnitRange(1 - euclideanShift / Math.hypot(MAX_SHIFT, MAX_SHIFT)),
    foregroundOccupancy: clampToUnitRange(contentSignal * (1 - paddingPenalty * 0.15)),
    edgePenalty: clampToUnitRange(1 - Math.max(absShiftX, absShiftY) / MAX_SHIFT),
    temporalConsistency: clampToUnitRange((1 - manhattanShift / (MAX_SHIFT * 2)) * 0.6 + contentSignal * 0.4),
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

export function scoreCandidates(
  candidates: AutoSliceCandidate[],
  imageData: AutoSliceImageData
): AutoSliceScoredCandidate[] {
  return candidates.map((candidate) => {
    const metrics = computeMetrics(candidate, imageData);

    return {
      candidate,
      metrics,
      score: computeWeightedScore(metrics),
    };
  });
}
