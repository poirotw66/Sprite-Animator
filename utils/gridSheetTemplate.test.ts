import { describe, expect, it } from 'vitest';
import { buildEqualGridBounds, buildGridSheetTemplate } from './gridSheetTemplate';
import { isSliceBackgroundPixel } from './imageContentAnalysis';

describe('buildEqualGridBounds', () => {
  it('returns equal 4×5 seams on 1024px canvas', () => {
    const { xBounds, yBounds } = buildEqualGridBounds(1024, 4, 5);
    expect(xBounds).toEqual([0, 256, 512, 768, 1024]);
    expect(yBounds).toEqual([0, 205, 410, 614, 819, 1024]);
  });
});

describe('buildGridSheetTemplate', () => {
  it('fills the canvas with chroma green background pixels (solid)', () => {
    const template = buildGridSheetTemplate(4, 5, { sizePx: 64, chromaKeyColor: 'green', mode: 'solid' });
    expect(template.width).toBe(64);
    expect(template.height).toBe(64);
    expect(template.mode).toBe('solid');
    expect(template.xBounds).toHaveLength(5);
    expect(template.yBounds).toHaveLength(6);

    let backgroundCount = 0;
    for (let i = 0; i < template.data.length; i += 4) {
      if (
        isSliceBackgroundPixel(
          template.data[i]!,
          template.data[i + 1]!,
          template.data[i + 2]!,
          template.data[i + 3]!
        )
      ) {
        backgroundCount++;
      }
    }
    expect(backgroundCount).toBe(64 * 64);
  });

  it('draws groove grid lines without corner ticks by default in guided mode', () => {
    const template = buildGridSheetTemplate(4, 5, { sizePx: 64, chromaKeyColor: 'green', mode: 'guided' });
    expect(template.mode).toBe('guided');

    let pureGreenCount = 0;
    let guideCount = 0;
    for (let i = 0; i < template.data.length; i += 4) {
      const r = template.data[i]!;
      const g = template.data[i + 1]!;
      const b = template.data[i + 2]!;
      if (r === 0 && g === 255 && b === 0) {
        pureGreenCount++;
      } else if (template.data[i + 3]! > 20) {
        guideCount++;
      }
    }
    expect(pureGreenCount).toBeLessThan(64 * 64);
    expect(guideCount).toBeGreaterThan(0);

    const withTicks = buildGridSheetTemplate(4, 5, {
      sizePx: 256,
      chromaKeyColor: 'green',
      mode: 'guided',
      cellCornerTicks: true,
    });
    const linesOnly = buildGridSheetTemplate(4, 5, {
      sizePx: 256,
      chromaKeyColor: 'green',
      mode: 'guided',
    });
    let tickGuideCount = 0;
    let linesOnlyCount = 0;
    for (let i = 0; i < withTicks.data.length; i += 4) {
      const r = withTicks.data[i]!;
      const g = withTicks.data[i + 1]!;
      const b = withTicks.data[i + 2]!;
      if (withTicks.data[i + 3]! > 20 && !(r === 0 && g === 255 && b === 0)) {
        tickGuideCount++;
      }
    }
    for (let i = 0; i < linesOnly.data.length; i += 4) {
      const r = linesOnly.data[i]!;
      const g = linesOnly.data[i + 1]!;
      const b = linesOnly.data[i + 2]!;
      if (linesOnly.data[i + 3]! > 20 && !(r === 0 && g === 255 && b === 0)) {
        linesOnlyCount++;
      }
    }
    expect(linesOnlyCount).toBeLessThan(tickGuideCount);
  });
});
