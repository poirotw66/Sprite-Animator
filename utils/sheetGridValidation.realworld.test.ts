import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { decodePng } from '../scripts/line-sticker/nodeImage.mts';
import {
  buildGridCandidates,
  detectBestGridLayoutFromRgba,
  validateSheetGrid,
} from './sheetGridValidation';

const FIXTURE_PATH = 'utils/fixtures/line-sticker/real-huahua-sheet-4x5.png';

function loadFixture() {
  const path = resolve(process.cwd(), FIXTURE_PATH);
  return decodePng(new Uint8Array(readFileSync(path)));
}

describe('sheetGridValidation tracked real-world fixture', () => {
  it('detects the real generated sticker sheet as 4x5', () => {
    const image = loadFixture();
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

  it('accepts the real generated sticker sheet at the production threshold', () => {
    const image = loadFixture();
    const result = validateSheetGrid(image.data, image.width, image.height, 4, 5, {
      minScore: 0.8,
      ...buildGridCandidates(4, 5),
    });

    expect(result.detected).toMatchObject({ cols: 4, rows: 5 });
    expect(result.expected.score).toBeGreaterThanOrEqual(0.8);
    expect(result.ok || result.resliceCandidate).toBe(true);
  });
});
