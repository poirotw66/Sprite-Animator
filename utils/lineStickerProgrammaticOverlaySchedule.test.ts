import { describe, expect, it } from 'vitest';
import {
  collectSheetsNeedingFullRes,
  digestPhrasesForSheet,
  planOverlayComposeSheets,
} from './lineStickerProgrammaticOverlaySchedule';

describe('planOverlayComposeSheets', () => {
  it('returns only dirty sheets that have raw frames', () => {
    const plan = planOverlayComposeSheets({
      dirtySheets: new Set([0, 1, 2]),
      fullResPendingSheets: new Set(),
      currentSheetIndex: 1,
      sheetsWithRaw: new Set([0, 2]),
    });

    expect(plan.map((item) => item.sheetIndex)).toEqual([0, 2]);
    expect(plan.find((item) => item.sheetIndex === 0)?.useFullRes).toBe(false);
    expect(plan.find((item) => item.sheetIndex === 2)?.useFullRes).toBe(false);
  });

  it('uses full resolution when a sheet is explicitly pending full res', () => {
    const plan = planOverlayComposeSheets({
      dirtySheets: new Set([2]),
      fullResPendingSheets: new Set([2]),
      currentSheetIndex: 0,
      sheetsWithRaw: new Set([2]),
    });

    expect(plan).toEqual([{ sheetIndex: 2, useFullRes: true }]);
  });
});

describe('collectSheetsNeedingFullRes', () => {
  it('lists sheets with raw frames that are still preview-only', () => {
    const pending = collectSheetsNeedingFullRes({
      sheetsWithRaw: new Set([0, 1, 2]),
      fullResSheets: new Set([1]),
    });

    expect(pending).toEqual([0, 2]);
  });
});

describe('digestPhrasesForSheet', () => {
  it('scopes phrase digest to one sheet slice', () => {
    const phrases = Array.from({ length: 48 }, (_, index) => `p${index}`);
    const sheet0 = digestPhrasesForSheet(phrases, 0);
    const sheet1 = digestPhrasesForSheet(phrases, 1);

    expect(sheet0).not.toBe(sheet1);
    expect(sheet0).toContain('p0');
    expect(sheet0).not.toContain('p16');
  });
});
