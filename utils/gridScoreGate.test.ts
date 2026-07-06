import { describe, expect, it } from 'vitest';
import {
  assertGridScoresPass,
  findGridScoreFailures,
  GridScoreGateError,
} from './gridScoreGate';

describe('gridScoreGate', () => {
  it('finds sheets below the minimum score', () => {
    const failures = findGridScoreFailures({ 'sheet-1': 0.625, 'sheet-2': 0.8 }, 0.72);
    expect(failures).toEqual([{ sheet: 'sheet-1', score: 0.625 }]);
  });

  it('throws when any sheet fails the gate', () => {
    expect(() =>
      assertGridScoresPass({ 'sheet-1': 0.625, 'sheet-2': 0.699 }, 0.72)
    ).toThrow(GridScoreGateError);
  });

  it('passes when all sheets meet the minimum', () => {
    expect(() =>
      assertGridScoresPass({ 'sheet-1': 0.92, 'sheet-2': 0.8 }, 0.72)
    ).not.toThrow();
  });
});
