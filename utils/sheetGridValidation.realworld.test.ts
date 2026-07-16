import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { decodePng } from '../scripts/line-sticker/nodeImage.mts';
import {
  buildGridCandidates,
  detectBestGridLayoutFromRgba,
  validateSheetGrid,
} from './sheetGridValidation';

const FIXTURE_PATH =
  'output/couple-set-lite-debug/sheet-1/attempts/attempt-01-processed.png';

const SET014_ATTEMPTS = [
  'output/vault-production/SET-20260712-014/sheet-1/attempts/attempt-01-processed.png',
  'output/vault-production/SET-20260712-014/sheet-1/attempts/attempt-02-processed.png',
  'output/vault-production/SET-20260712-014/sheet-1/attempts/attempt-03-processed.png',
] as const;

function loadAttemptImage(relativePath: string) {
  const path = resolve(process.cwd(), relativePath);
  return decodePng(new Uint8Array(readFileSync(path)));
}

const hasFixture = existsSync(resolve(process.cwd(), FIXTURE_PATH));
const set014Fixtures = SET014_ATTEMPTS.filter((rel) => existsSync(resolve(process.cwd(), rel)));

describe.skipIf(!hasFixture)('sheetGridValidation real-world attempts', () => {
  it('detects the saved 4x5 couple sheet as 4x5', () => {
    const image = loadAttemptImage(FIXTURE_PATH);

    const { colCandidates, rowCandidates } = buildGridCandidates(4, 5);
    const detected = detectBestGridLayoutFromRgba(
      image.data,
      image.width,
      image.height,
      colCandidates,
      rowCandidates
    );

    expect(detected).toMatchObject({ cols: 4, rows: 5 });
  });

  it('does not reject the saved 4x5 couple sheet as a wrong layout', () => {
    const image = loadAttemptImage(FIXTURE_PATH);

    const result = validateSheetGrid(image.data, image.width, image.height, 4, 5, {
      minScore: 0.8,
    });

    expect(result.detected).toMatchObject({ cols: 4, rows: 5 });
  });
});

describe.skipIf(set014Fixtures.length === 0)('sheetGridValidation SET-20260712-014 attempts', () => {
  it.each(set014Fixtures)('accepts visually correct 4x5 sheet: %s', (relativePath) => {
    const image = loadAttemptImage(relativePath);
    const result = validateSheetGrid(image.data, image.width, image.height, 4, 5, {
      minScore: 0.8,
    });

    expect(result.detected).toMatchObject({ cols: 4, rows: 5 });
    expect(result.ok || result.resliceCandidate).toBe(true);
  });
});
