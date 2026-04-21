export interface AutoSliceCandidate {
  cols: number;
  rows: number;
  shiftX: number;
  shiftY: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
}

export interface AutoSliceImageData {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

export interface AutoSliceMetrics {
  bboxStability: number;
  centroidDrift: number;
  foregroundOccupancy: number;
  edgePenalty: number;
  temporalConsistency: number;
}

export interface AutoSliceScoredCandidate {
  candidate: AutoSliceCandidate;
  score: number;
  metrics: AutoSliceMetrics;
}

export interface AutoSliceFallbackHint {
  suggestedCols: number;
  suggestedRows: number;
  suggestedShiftX: number;
  suggestedShiftY: number;
  reason: 'low_confidence' | 'hard_guard_failed';
}
