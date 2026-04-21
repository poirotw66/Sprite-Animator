import { selectBestCandidate } from './bestFitSelector';
import { scoreCandidates as defaultScoreCandidates } from './contentConsistencyStage';
import { buildFallbackHint } from './fallbackHintStage';
import { buildGridHypotheses } from './gridHypothesisStage';
import type { AutoSliceCandidate, AutoSliceScoredCandidate } from './types';

type ScoreStage = (
  candidates: AutoSliceCandidate[]
) => AutoSliceScoredCandidate[] | Promise<AutoSliceScoredCandidate[]>;

export interface AutoSlicePipelineInput {
  base64Image: string;
  cols: number;
  rows: number;
  timeoutMs: number;
  scoreCandidates?: ScoreStage;
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
      reason: 'timeout';
    };

function hasTimedOut(startedAt: number, timeoutMs: number, now: () => number): boolean {
  return now() - startedAt > timeoutMs;
}

export async function runAutoSlicePipeline(
  input: AutoSlicePipelineInput
): Promise<AutoSlicePipelineResult> {
  const now = input.now ?? Date.now;
  const scoreStage = input.scoreCandidates ?? defaultScoreCandidates;
  const startedAt = now();
  const candidates = buildGridHypotheses(input.cols, input.rows);
  const scoredCandidates = await Promise.resolve(scoreStage(candidates));

  if (hasTimedOut(startedAt, input.timeoutMs, now)) {
    return {
      status: 'fallback',
      reason: 'timeout',
    };
  }

  const decision = selectBestCandidate(scoredCandidates);

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
      reason: 'timeout',
    };
  }

  return {
    status: decision.status,
    selected: decision.selected,
    hint,
  };
}
