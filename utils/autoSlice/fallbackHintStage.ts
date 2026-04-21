import type { BestFitDecision } from './bestFitSelector';
import type { AutoSliceFallbackHint } from './types';

export function buildFallbackHint(decision: BestFitDecision): AutoSliceFallbackHint | null {
  if (decision.status === 'accepted') {
    return null;
  }

  const { candidate } = decision.selected;

  return {
    suggestedCols: candidate.cols,
    suggestedRows: candidate.rows,
    suggestedShiftX: candidate.shiftX,
    suggestedShiftY: candidate.shiftY,
    reason: decision.status === 'hard_guard_failed' ? 'hard_guard_failed' : 'low_confidence',
  };
}
