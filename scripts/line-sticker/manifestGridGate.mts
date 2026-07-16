/**
 * Read manifest grid scores and block upload when any sheet is below the minimum.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertGridScoresPass,
  DEFAULT_MIN_GRID_ALIGNMENT_SCORE,
  findGridScoreFailures,
  formatGridGateMessage,
} from '../../utils/gridScoreGate.ts';

export interface ManifestGridGateInput {
  gridScores?: Record<string, number>;
  config?: { minGridAlignmentScore?: number };
}

export function resolveMinGridScore(manifest: ManifestGridGateInput): number {
  return manifest.config?.minGridAlignmentScore ?? DEFAULT_MIN_GRID_ALIGNMENT_SCORE;
}

export function assertManifestGridGate(manifest: ManifestGridGateInput): void {
  const gridScores = manifest.gridScores;
  if (!gridScores || Object.keys(gridScores).length === 0) {
    throw new Error('manifest.json missing gridScores — run finalize.mts before upload');
  }
  const minScore = resolveMinGridScore(manifest);
  const failures = findGridScoreFailures(gridScores, minScore);
  if (failures.length > 0) {
    for (const message of formatGridGateMessage(failures, minScore)) {
      console.error(`✗ ${message}`);
    }
    assertGridScoresPass(gridScores, minScore);
  }
}

export async function assertOutDirGridGate(outDir: string): Promise<void> {
  const manifestPath = resolve(outDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ManifestGridGateInput;
  assertManifestGridGate(manifest);
}
