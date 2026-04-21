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

interface CellStats {
  occupancy: number;
  centroidX: number;
  centroidY: number;
  bboxWidthRatio: number;
  bboxHeightRatio: number;
  edgeTouch: number;
}

interface GlobalContentCenter {
  normalizedX: number;
  normalizedY: number;
}

function getPixelIntensity(imageData: AutoSliceImageData, x: number, y: number): number {
  const index = (y * imageData.width + x) * 4;
  const red = imageData.pixels[index] ?? 0;
  const green = imageData.pixels[index + 1] ?? 0;
  const blue = imageData.pixels[index + 2] ?? 0;
  const alpha = imageData.pixels[index + 3] ?? 255;
  const brightness = (red + green + blue) / (255 * 3);
  const alphaRatio = alpha / 255;
  return clampToUnitRange((brightness + alphaRatio) / 2);
}

function analyzeCell(
  imageData: AutoSliceImageData,
  startX: number,
  startY: number,
  cellWidth: number,
  cellHeight: number
): CellStats {
  let foregroundCount = 0;
  let centroidSumX = 0;
  let centroidSumY = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let edgeTouchCount = 0;

  for (let localY = 0; localY < cellHeight; localY += 1) {
    for (let localX = 0; localX < cellWidth; localX += 1) {
      const pixelX = ((startX + localX) % imageData.width + imageData.width) % imageData.width;
      const pixelY = ((startY + localY) % imageData.height + imageData.height) % imageData.height;

      const intensity = getPixelIntensity(imageData, pixelX, pixelY);
      if (intensity < 0.45) {
        continue;
      }

      foregroundCount += 1;
      centroidSumX += localX;
      centroidSumY += localY;
      minX = Math.min(minX, localX);
      minY = Math.min(minY, localY);
      maxX = Math.max(maxX, localX);
      maxY = Math.max(maxY, localY);

      if (localX === 0 || localY === 0 || localX === cellWidth - 1 || localY === cellHeight - 1) {
        edgeTouchCount += 1;
      }
    }
  }

  const cellArea = Math.max(1, cellWidth * cellHeight);
  if (foregroundCount === 0) {
    return {
      occupancy: 0,
      centroidX: 0.5,
      centroidY: 0.5,
      bboxWidthRatio: 0,
      bboxHeightRatio: 0,
      edgeTouch: 0,
    };
  }

  const bboxWidth = Math.max(1, maxX - minX + 1);
  const bboxHeight = Math.max(1, maxY - minY + 1);
  return {
    occupancy: clampToUnitRange(foregroundCount / cellArea),
    centroidX: clampToUnitRange((centroidSumX / foregroundCount) / Math.max(1, cellWidth - 1)),
    centroidY: clampToUnitRange((centroidSumY / foregroundCount) / Math.max(1, cellHeight - 1)),
    bboxWidthRatio: clampToUnitRange(bboxWidth / Math.max(1, cellWidth)),
    bboxHeightRatio: clampToUnitRange(bboxHeight / Math.max(1, cellHeight)),
    edgeTouch: clampToUnitRange(edgeTouchCount / foregroundCount),
  };
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanAbsoluteDeviation(values: number[]): number {
  if (values.length === 0) {
    return 1;
  }
  const avg = mean(values);
  return values.reduce((sum, value) => sum + Math.abs(value - avg), 0) / values.length;
}

function computeGlobalContentCenter(imageData: AutoSliceImageData): GlobalContentCenter {
  let weightSum = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const intensity = getPixelIntensity(imageData, x, y);
      if (intensity < 0.45) {
        continue;
      }

      weightSum += intensity;
      weightedX += intensity * ((x + 0.5) / imageData.width);
      weightedY += intensity * ((y + 0.5) / imageData.height);
    }
  }

  if (weightSum === 0) {
    return { normalizedX: 0.5, normalizedY: 0.5 };
  }

  return {
    normalizedX: clampToUnitRange(weightedX / weightSum),
    normalizedY: clampToUnitRange(weightedY / weightSum),
  };
}

function computeShiftPenalty(candidate: AutoSliceCandidate): number {
  const absShiftX = Math.abs(candidate.shiftX);
  const absShiftY = Math.abs(candidate.shiftY);
  const manhattanShift = absShiftX + absShiftY;
  return clampToUnitRange(manhattanShift / (MAX_SHIFT * 2));
}

function sampleCells(imageData: AutoSliceImageData, candidate: AutoSliceCandidate): CellStats[] {
  const safeCols = Math.max(1, candidate.cols);
  const safeRows = Math.max(1, candidate.rows);
  const cellWidth = Math.max(1, Math.floor(imageData.width / safeCols));
  const cellHeight = Math.max(1, Math.floor(imageData.height / safeRows));
  const cells: CellStats[] = [];

  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      const startX = col * cellWidth + candidate.shiftX;
      const startY = row * cellHeight + candidate.shiftY;
      cells.push(analyzeCell(imageData, startX, startY, cellWidth, cellHeight));
    }
  }
  return cells;
}

function computeMetrics(
  candidate: AutoSliceCandidate,
  imageData: AutoSliceImageData,
  globalContentCenter: GlobalContentCenter
): AutoSliceMetrics {
  const cells = sampleCells(imageData, candidate);
  const safeCols = Math.max(1, candidate.cols);
  const occupancyValues = cells.map((cell) => cell.occupancy);
  const centroidXs = cells.map((cell) => cell.centroidX);
  const centroidYs = cells.map((cell) => cell.centroidY);
  const bboxSizes = cells.map((cell) => (cell.bboxWidthRatio + cell.bboxHeightRatio) / 2);
  const edgeTouches = cells.map((cell) => cell.edgeTouch);
  const occupancyByRow = Array.from({ length: Math.max(1, candidate.rows) }, (_, rowIndex) => {
    const start = rowIndex * safeCols;
    const end = start + safeCols;
    return mean(occupancyValues.slice(start, end));
  });
  const shiftPenalty = computeShiftPenalty(candidate);
  const paddingLoad =
    candidate.paddingLeft + candidate.paddingRight + candidate.paddingTop + candidate.paddingBottom;
  const paddingPenalty = clampToUnitRange(Math.min(paddingLoad / 16, 1));
  const occupancyMean = mean(occupancyValues);
  const expectedShiftX = (globalContentCenter.normalizedX - 0.5) * 2;
  const expectedShiftY = (globalContentCenter.normalizedY - 0.5) * 2;
  const normalizedShiftX = candidate.shiftX / Math.max(1, MAX_SHIFT);
  const normalizedShiftY = candidate.shiftY / Math.max(1, MAX_SHIFT);
  const alignmentScore = clampToUnitRange(
    1 - (Math.abs(normalizedShiftX - expectedShiftX) + Math.abs(normalizedShiftY - expectedShiftY)) / 4
  );
  const bboxStability = clampToUnitRange(1 - meanAbsoluteDeviation(bboxSizes) - paddingPenalty * 0.2);
  const centroidStability =
    1 - (meanAbsoluteDeviation(centroidXs) + meanAbsoluteDeviation(centroidYs)) / 2 - shiftPenalty * 0.2;
  const occupancyScore = clampToUnitRange(occupancyMean * (1 - paddingPenalty * 0.15));
  const edgeSafety = clampToUnitRange(1 - mean(edgeTouches) - shiftPenalty * 0.1);
  const temporalContinuity = clampToUnitRange(alignmentScore);

  return {
    bboxStability,
    centroidDrift: clampToUnitRange(centroidStability),
    foregroundOccupancy: occupancyScore,
    edgePenalty: edgeSafety,
    temporalConsistency: temporalContinuity,
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
  const globalContentCenter = computeGlobalContentCenter(imageData);
  return candidates.map((candidate) => {
    const metrics = computeMetrics(candidate, imageData, globalContentCenter);

    return {
      candidate,
      metrics,
      score: computeWeightedScore(metrics),
    };
  });
}
