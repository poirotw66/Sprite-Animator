import { describe, expect, it } from 'vitest';
import {
  buildGridCandidates,
  buildGridRetryPromptSuffix,
  columnWidthCoefficientOfVariation,
  rankSheetAttempt,
  validateSheetGrid,
} from './sheetGridValidation';

function fillGreen(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
}

describe('sheetGridValidation', () => {
  it('buildGridCandidates includes neighbors of expected grid', () => {
    expect(buildGridCandidates(4, 5)).toEqual({
      colCandidates: [3, 4, 5],
      rowCandidates: [4, 5, 6],
    });
  });

  it('validateSheetGrid rejects expected grid when best-fit layout differs', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    fillGreen(data);
    const probe = validateSheetGrid(data, width, height, 4, 5, {
      minScore: 0,
      maxColumnWidthCv: 1,
    });
    if (probe.detected.cols !== 4 || probe.detected.rows !== 5) {
      expect(probe.ok).toBe(false);
      expect(probe.reason).toMatch(/layout looks like/);
    }
  });

  it('validateSheetGrid fails on low-confidence sheets', () => {
    const result = validateSheetGrid(new Uint8ClampedArray(16), 2, 2, 4, 5, {
      minScore: 0.99,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('buildGridRetryPromptSuffix mentions exact column count', () => {
    const suffix = buildGridRetryPromptSuffix(4, 5, { detected: { cols: 5, rows: 5, score: 0.9 } });
    expect(suffix).toContain('4 columns × 5 rows');
    expect(suffix).toContain('NOT 5 columns');
    expect(suffix).toContain('5×5');
    expect(suffix).toContain('row by row');
  });

  it('validateSheetGrid hard-rejects wrong detected layout', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    fillGreen(data);
    const result = validateSheetGrid(data, width, height, 4, 5, { minScore: 0.5 });
    if (result.detected.cols !== 4 || result.detected.rows !== 5) {
      expect(result.ok).toBe(false);
      expect(result.resliceCandidate).toBeDefined();
    }
  });

  it('columnWidthCoefficientOfVariation is zero for equal widths', () => {
    expect(columnWidthCoefficientOfVariation([0, 25, 50, 75, 100])).toBe(0);
  });

  it('rankSheetAttempt penalizes wrong layout', () => {
    const good = rankSheetAttempt(
      {
        ok: true,
        expected: { cols: 4, rows: 5, score: 0.8 },
        detected: { cols: 4, rows: 5, score: 0.8 },
        columnWidthCv: 0.05,
      },
      4,
      5
    );
    const bad = rankSheetAttempt(
      {
        ok: false,
        expected: { cols: 4, rows: 5, score: 0.8 },
        detected: { cols: 5, rows: 5, score: 0.85 },
        columnWidthCv: 0.05,
      },
      4,
      5
    );
    expect(good).toBeGreaterThan(bad);
  });
});
