import { selectBestCandidate } from './bestFitSelector';
import { scoreCandidates as defaultScoreCandidates } from './contentConsistencyStage';
import { buildFallbackHint } from './fallbackHintStage';
import { buildGridHypotheses } from './gridHypothesisStage';
import type { AutoSliceCandidate, AutoSliceImageData, AutoSliceScoredCandidate } from './types';

type ScoreStage = (
  candidates: AutoSliceCandidate[],
  imageData: AutoSliceImageData
) => AutoSliceScoredCandidate[] | Promise<AutoSliceScoredCandidate[]>;

type HypothesisStage = (cols: number, rows: number, seed?: Partial<AutoSliceCandidate>) => AutoSliceCandidate[];

export interface AutoSlicePipelineInput {
  base64Image: string;
  cols: number;
  rows: number;
  timeoutMs: number;
  baseCandidate?: Partial<AutoSliceCandidate>;
  buildGridHypotheses?: HypothesisStage;
  scoreCandidates?: ScoreStage;
  imageData?: AutoSliceImageData;
  now?: () => number;
}

export type AutoSlicePipelineResult =
  | {
      status: 'accepted';
      confidence: 'high' | 'low';
      selected: AutoSliceScoredCandidate;
    }
  | {
      status: 'low_confidence';
      selected: AutoSliceScoredCandidate;
      hint: NonNullable<ReturnType<typeof buildFallbackHint>>;
    }
  | {
      status: 'hard_guard_failed';
      selected: AutoSliceScoredCandidate;
      hint: NonNullable<ReturnType<typeof buildFallbackHint>>;
    }
  | {
      status: 'fallback';
      reason: 'timeout' | 'stage_error';
      stage?: 'hypothesis' | 'scoring' | 'selection';
      message?: string;
    };

function hasTimedOut(startedAt: number, timeoutMs: number, now: () => number): boolean {
  return now() - startedAt > timeoutMs;
}

export async function runAutoSlicePipeline(
  input: AutoSlicePipelineInput
): Promise<AutoSlicePipelineResult> {
  const now = input.now ?? Date.now;
  const scoreStage = input.scoreCandidates ?? defaultScoreCandidates;
  const hypothesisStage = input.buildGridHypotheses ?? buildGridHypotheses;
  const startedAt = now();
  // Keep base64Image in the contract for integration hand-off.
  void input.base64Image;
  let candidates: AutoSliceCandidate[];
  let scoredCandidates: AutoSliceScoredCandidate[];

  if (!input.imageData) {
    return {
      status: 'fallback',
      reason: 'stage_error',
      stage: 'scoring',
      message: 'Real imageData is required for content-aware scoring',
    };
  }

  try {
    candidates = hypothesisStage(input.cols, input.rows, input.baseCandidate);
  } catch (error) {
    return {
      status: 'fallback',
      reason: 'stage_error',
      stage: 'hypothesis',
      message: error instanceof Error ? error.message : 'Unknown hypothesis stage error',
    };
  }

  try {
    scoredCandidates = await Promise.resolve(scoreStage(candidates, input.imageData));
  } catch (error) {
    return {
      status: 'fallback',
      reason: 'stage_error',
      stage: 'scoring',
      message: error instanceof Error ? error.message : 'Unknown scoring stage error',
    };
  }

  if (hasTimedOut(startedAt, input.timeoutMs, now)) {
    return {
      status: 'fallback',
      reason: 'timeout',
    };
  }

  let decision: ReturnType<typeof selectBestCandidate>;
  try {
    decision = selectBestCandidate(scoredCandidates);
  } catch (error) {
    return {
      status: 'fallback',
      reason: 'stage_error',
      stage: 'selection',
      message: error instanceof Error ? error.message : 'Unknown selection stage error',
    };
  }

  if (decision.status === 'accepted') {
    return {
      status: 'accepted',
      confidence: decision.confidence,
      selected: decision.selected,
    };
  }

  const hint = buildFallbackHint(decision);

  if (!hint) {
    return {
      status: 'fallback',
      reason: 'stage_error',
      stage: 'selection',
      message: 'Fallback hint is unavailable for non-accepted decision',
    };
  }

  return {
    status: decision.status,
    selected: decision.selected,
    hint,
  };
}
