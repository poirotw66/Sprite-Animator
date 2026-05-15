import { describe, expect, it } from 'vitest';
import {
  extractFillHexFromTextColorPreset,
  strokeColorForFill,
  layoutFromPlacementLabel,
  resolveProgrammaticPlacementLabel,
  resolveProgrammaticFontFamilyCss,
  fontCssStackForPreset,
  resolveCanvasFontNumericWeight,
  DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
  rectangleIntersectionArea,
  rectangleMinSeparation,
  estimateTextBlockBox,
  estimateTextBlockBoxFromMeasuredLines,
  getEffectiveProgrammaticPlacementMode,
} from './lineStickerTextOverlay';

describe('extractFillHexFromTextColorPreset', () => {
  it('parses hex from preset promptDesc', () => {
    expect(extractFillHexFromTextColorPreset('black')).toBe('#000000');
    expect(extractFillHexFromTextColorPreset('white')).toBe('#FFFFFF');
    expect(extractFillHexFromTextColorPreset('navy')).toBe('#1e3a5f');
  });
});

describe('strokeColorForFill', () => {
  it('uses dark stroke on light fills', () => {
    expect(strokeColorForFill('#FFFFFF')).toBe('#1a1a1a');
  });

  it('uses white stroke on dark fills', () => {
    expect(strokeColorForFill('#000000')).toBe('#ffffff');
  });
});

describe('resolveProgrammaticFontFamilyCss', () => {
  it('uses custom string when source is custom and non-empty', () => {
    const tuning = {
      ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
      fontFamilySource: 'custom' as const,
      customFontFamily: '"Georgia", serif',
    };
    expect(resolveProgrammaticFontFamilyCss('handwritten', tuning)).toBe('"Georgia", serif');
  });

  it('falls back to preset stack when custom is blank', () => {
    const tuning = {
      ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
      fontFamilySource: 'custom' as const,
      customFontFamily: '   ',
    };
    const stack = resolveProgrammaticFontFamilyCss('pixelRetro', tuning);
    expect(stack).toContain('monospace');
  });
});

describe('fontCssStackForPreset', () => {
  it('matches broad style families (hand / round / gothic / poster / mono)', () => {
    expect(fontCssStackForPreset('handwritten')).toMatch(/Kaiti TC/);
    expect(fontCssStackForPreset('round')).toMatch(/Hiragino Maru Gothic ProN/);
    expect(fontCssStackForPreset('bold')).toMatch(/Heiti TC/);
    expect(fontCssStackForPreset('pop')).toMatch(/^"PingFang TC"/);
    expect(fontCssStackForPreset('thinHandwritten')).toMatch(/Bradley Hand ITC/);
    expect(fontCssStackForPreset('neonGlow')).toMatch(/^"Impact"/);
    expect(fontCssStackForPreset('comicBook')).toMatch(/^"Impact"/);
    expect(fontCssStackForPreset('pixelRetro')).toMatch(/monospace/);
    expect(fontCssStackForPreset('cherryBlossom')).toMatch(/Mincho/);
  });
});

describe('resolveCanvasFontNumericWeight', () => {
  it('caps thinHandwritten so bold slider does not defeat the light style', () => {
    const tuning = { ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING, fontWeight: 700 as const };
    expect(resolveCanvasFontNumericWeight('thinHandwritten', tuning)).toBe(600);
    expect(resolveCanvasFontNumericWeight('bold', tuning)).toBe(700);
  });
});

describe('resolveProgrammaticPlacementLabel', () => {
  it('returns fixed anchors for non-cycle modes', () => {
    const tuningBottom = {
      ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
      placementMode: 'bottom_center' as const,
    };
    expect(resolveProgrammaticPlacementLabel(0, tuningBottom)).toBe('Bottom center');
    const tuningTop = { ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING, placementMode: 'top_center' as const };
    expect(resolveProgrammaticPlacementLabel(99, tuningTop)).toBe('Top center');
    const tuningMid = { ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING, placementMode: 'middle_center' as const };
    expect(resolveProgrammaticPlacementLabel(3, tuningMid)).toBe('Middle center');
  });
});

describe('getEffectiveProgrammaticPlacementMode', () => {
  it('uses per-frame override when set', () => {
    const tuning: typeof DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING = {
      ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
      placementMode: 'cycle',
      placementModeOverrides: ['top_center', null],
    };
    expect(getEffectiveProgrammaticPlacementMode(tuning, 0)).toBe('top_center');
    expect(getEffectiveProgrammaticPlacementMode(tuning, 1)).toBe('cycle');
  });
});

describe('layoutFromPlacementLabel', () => {
  it('places middle center at canvas center', () => {
    const { anchorX, anchorY, textBaseline } = layoutFromPlacementLabel('Middle center', 200, 100);
    expect(textBaseline).toBe('middle');
    expect(anchorX).toBe(100);
    expect(anchorY).toBe(50);
  });

  it('places bottom center near bottom edge', () => {
    const { anchorY, textBaseline } = layoutFromPlacementLabel('Bottom center', 100, 200);
    expect(textBaseline).toBe('bottom');
    expect(anchorY).toBeGreaterThan(150);
  });

  it('places top left in upper-left quadrant', () => {
    const { anchorX, anchorY, textAlign, textBaseline } = layoutFromPlacementLabel('Top left', 200, 100);
    expect(textAlign).toBe('left');
    expect(textBaseline).toBe('top');
    expect(anchorX).toBeLessThan(50);
    expect(anchorY).toBeLessThan(20);
  });
});

describe('estimateTextBlockBox and rectangle helpers', () => {
  it('reports zero separation when rectangles overlap', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
    expect(rectangleIntersectionArea(a, b)).toBeGreaterThan(0);
    expect(rectangleMinSeparation(a, b)).toBe(0);
  });

  it('reports positive separation when disjoint', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 20, minY: 0, maxX: 30, maxY: 10 };
    expect(rectangleMinSeparation(a, b)).toBe(10);
  });

  it('estimates text box below anchor for bottom baseline', () => {
    const layout = layoutFromPlacementLabel('Bottom center', 100, 100, 0.06);
    const box = estimateTextBlockBox(100, 100, layout, 1, 14);
    expect(box.maxY).toBeLessThanOrEqual(100);
    expect(box.minY).toBeLessThan(box.maxY);
  });

  it('measured-line box is narrower than max-width band for short centered text', () => {
    const layout = layoutFromPlacementLabel('Bottom center', 200, 200, 0.06);
    const mockCtx = {
      measureText: (s: string) => ({ width: (s.length || 1) * 8 }),
    } as unknown as CanvasRenderingContext2D;
    const loose = estimateTextBlockBox(200, 200, layout, 1, 14);
    const tight = estimateTextBlockBoxFromMeasuredLines(
      mockCtx,
      200,
      200,
      layout,
      ['OK'],
      14,
      0,
      0
    );
    expect(tight.maxX - tight.minX).toBeLessThan(loose.maxX - loose.minX);
    expect(tight.maxX - tight.minX).toBe(16);
  });
});
