/**
 * Grid alignment gate for LINE sticker sheets — blocks finalize/upload when scores are too low.
 */

export const DEFAULT_MIN_GRID_ALIGNMENT_SCORE = 0.72;

export interface GridScoreFailure {
  sheet: string;
  score: number;
}

export class GridScoreGateError extends Error {
  readonly failures: GridScoreFailure[];
  readonly minScore: number;

  constructor(failures: GridScoreFailure[], minScore: number) {
    const detail = failures
      .map((f) => `${f.sheet}=${f.score.toFixed(3)}`)
      .join(', ');
    super(
      `Grid alignment below minimum ${minScore.toFixed(2)}: ${detail}. ` +
        'Regenerate failing sheet(s) with generate.mts --sheet … then finalize.mts.'
    );
    this.name = 'GridScoreGateError';
    this.failures = failures;
    this.minScore = minScore;
  }
}

export function findGridScoreFailures(
  gridScores: Record<string, number>,
  minScore: number = DEFAULT_MIN_GRID_ALIGNMENT_SCORE
): GridScoreFailure[] {
  return Object.entries(gridScores)
    .filter(([, score]) => score < minScore)
    .map(([sheet, score]) => ({ sheet, score }))
    .sort((a, b) => a.score - b.score);
}

export function assertGridScoresPass(
  gridScores: Record<string, number>,
  minScore: number = DEFAULT_MIN_GRID_ALIGNMENT_SCORE
): void {
  const failures = findGridScoreFailures(gridScores, minScore);
  if (failures.length > 0) {
    throw new GridScoreGateError(failures, minScore);
  }
}

export function formatGridGateMessage(
  failures: GridScoreFailure[],
  minScore: number
): string[] {
  return failures.map(
    (f) => `grid ${f.sheet} score ${f.score.toFixed(3)} < minimum ${minScore.toFixed(2)}`
  );
}
