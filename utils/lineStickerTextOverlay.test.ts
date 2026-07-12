import { describe, expect, it } from 'vitest';
import { getReservedCaptionBandLabelForFrame } from './lineStickerPrompt';
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
  inflatePixelRect,
  getEffectiveProgrammaticPlacementMode,
} from './lineStickerTextOverlay';
import {
  buildForegroundOverlapIndex,
  countOverlapCellsInBox,
  findLeastOverlapCaptionCenter,
  findCaptionCenterBandFirst,
  computeAutoCaptionLayout,
  preferredCaptionCenterForLabel,
} from './lineStickerTextOverlaySubject';
import {
  captionBandPixelRectForLabel,
  centerSearchBoundsForTextBoxInBand,
} from './lineStickerTextOverlayGeometry';
import { createCanvas } from '@napi-rs/canvas';

/** @napi-rs/canvas context is API-compatible but not structurally typed as DOM CanvasRenderingContext2D. */
function asDomCanvasContext(ctx: unknown): CanvasRenderingContext2D {
  return ctx as CanvasRenderingContext2D;
}

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
    const stack = resolveProgrammaticFontFamilyCss('bold', tuning);
    expect(stack).toContain('Heiti TC');
  });
});

describe('fontCssStackForPreset', () => {
  it('matches broad style families (hand / round / gothic / poster)', () => {
    expect(fontCssStackForPreset('handwritten')).toMatch(/DFKai-SB/);
    expect(fontCssStackForPreset('handwritten')).toMatch(/Kaiti TC/);
    expect(fontCssStackForPreset('round')).toMatch(/Yu Gothic UI/);
    expect(fontCssStackForPreset('round')).toMatch(/Hiragino Maru Gothic ProN/);
    expect(fontCssStackForPreset('bold')).toMatch(/Microsoft JhengHei/);
    expect(fontCssStackForPreset('bold')).toMatch(/Heiti TC/);
    expect(fontCssStackForPreset('pop')).toMatch(/Microsoft JhengHei/);
    expect(fontCssStackForPreset('thinHandwritten')).toMatch(/DFKai-SB/);
    expect(fontCssStackForPreset('thinHandwritten')).toMatch(/Ink Free/);
    expect(fontCssStackForPreset('kidDoodle')).toMatch(/Comic Sans MS/);
    expect(fontCssStackForPreset('mochiRound')).toMatch(/Yu Gothic UI/);
    expect(fontCssStackForPreset('bubblePop')).toMatch(/Comic Sans MS/);
    expect(fontCssStackForPreset('sweetChalk')).toMatch(/Yu Gothic UI/);
    expect(fontCssStackForPreset('sweetChalk')).toMatch(/Chalkboard SE/);
    expect(fontCssStackForPreset('candyScript')).toMatch(/DFKai-SB/);
    expect(fontCssStackForPreset('candyScript')).toMatch(/Segoe Script/);
    expect(fontCssStackForPreset('liyushoushu')).toMatch(/Liyu Shoushu/);
    expect(fontCssStackForPreset('fashionBitmap16')).toMatch(/FashionBitmap16/);
    expect(fontCssStackForPreset('kanaka')).toMatch(/Kanaka Font/);
    expect(fontCssStackForPreset('matchUploaded')).toMatch(/Kanaka Font/);
    expect(fontCssStackForPreset('naikai')).toMatch(/NaikaiFont/);
    expect(fontCssStackForPreset('fluffy')).toMatch(/Yu Gothic UI/);
    expect(fontCssStackForPreset('custom')).toMatch(/Yu Gothic UI/);
  });

  it('lists Windows zh-TW faces before macOS-only families', () => {
    const winBeforeMac: Array<{ key: Parameters<typeof fontCssStackForPreset>[0]; win: string; mac: string }> = [
      { key: 'handwritten', win: 'DFKai-SB', mac: 'Kaiti TC' },
      { key: 'candyScript', win: 'DFKai-SB', mac: 'Kaiti TC' },
      { key: 'sweetChalk', win: 'Yu Gothic UI', mac: 'Chalkboard SE' },
      { key: 'playful', win: 'Yu Gothic UI', mac: 'Hiragino Maru Gothic ProN' },
      { key: 'thinHandwritten', win: 'DFKai-SB', mac: 'Kaiti TC' },
    ];
    for (const { key, win, mac } of winBeforeMac) {
      const stack = fontCssStackForPreset(key);
      expect(stack.indexOf(win)).toBeGreaterThanOrEqual(0);
      expect(stack.indexOf(win)).toBeLessThan(stack.indexOf(mac));
    }
  });
});

describe('resolveCanvasFontNumericWeight', () => {
  it('caps script/chalk presets and boosts fluffy cute presets', () => {
    const tuning = { ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING, fontWeight: 700 as const };
    expect(resolveCanvasFontNumericWeight('thinHandwritten', tuning)).toBe(500);
    expect(resolveCanvasFontNumericWeight('sweetChalk', tuning)).toBe(550);
    expect(resolveCanvasFontNumericWeight('candyScript', tuning)).toBe(600);
    expect(resolveCanvasFontNumericWeight('liyushoushu', tuning)).toBe(400);
    expect(resolveCanvasFontNumericWeight('fashionBitmap16', tuning)).toBe(400);
    expect(resolveCanvasFontNumericWeight('naikai', tuning)).toBe(400);
    expect(resolveCanvasFontNumericWeight('kanaka', tuning)).toBe(500);
    expect(resolveCanvasFontNumericWeight('bubblePop', tuning)).toBe(700);
    expect(resolveCanvasFontNumericWeight('fluffy', tuning)).toBe(700);
    expect(resolveCanvasFontNumericWeight('bold', tuning)).toBe(700);
  });
});

describe('reserved caption band alignment', () => {
  it('cycle overlay placement matches prompt band label for frame index', () => {
    const tuning = { ...DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING, placementMode: 'cycle' as const };
    expect(resolveProgrammaticPlacementLabel(3, tuning)).toBe(
      getReservedCaptionBandLabelForFrame(3)
    );
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

describe('DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING', () => {
  it('defaults to auto_avoid_subject placement', () => {
    expect(DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING.placementMode).toBe('auto_avoid_subject');
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

  it('reserved caption band anchors sit inside the band zone', () => {
    const plain = layoutFromPlacementLabel('Bottom center', 100, 100, 0.06);
    const band = layoutFromPlacementLabel('Bottom center', 100, 100, 0.06, {
      useReservedCaptionBandAnchors: true,
    });
    expect(band.anchorY).toBeLessThan(plain.anchorY);
    const topBand = layoutFromPlacementLabel('Top center', 100, 100, 0.06, {
      useReservedCaptionBandAnchors: true,
    });
    const topPlain = layoutFromPlacementLabel('Top center', 100, 100, 0.06);
    expect(topBand.anchorY).toBeGreaterThan(topPlain.anchorY);
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

  it('inflatePixelRect expands bounds within frame', () => {
    const inner = { minX: 10, minY: 10, maxX: 20, maxY: 20 };
    const outer = inflatePixelRect(inner, 5, 5, 100, 100);
    expect(outer.minX).toBe(5);
    expect(outer.maxX).toBe(25);
  });
});

describe('buildForegroundOverlapIndex + countOverlapCellsInBox', () => {
  it('counts zero overlap in empty regions and positive overlap over the subject', () => {
    const canvas = createCanvas(200, 200);
    const ctx = asDomCanvasContext(canvas.getContext('2d'));
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(60, 50, 80, 100);

    const index = buildForegroundOverlapIndex(ctx, 200, 200);
    expect(countOverlapCellsInBox(index, 70, 60, 130, 140)).toBeGreaterThan(0);
    // Bottom strip is empty (subject ends at y=150, dilation adds ~1 cell).
    expect(countOverlapCellsInBox(index, 10, 175, 190, 198)).toBe(0);
  });
});

describe('findLeastOverlapCaptionCenter', () => {
  it('finds an overlap-free center away from a centered subject', () => {
    const canvas = createCanvas(200, 200);
    const ctx = asDomCanvasContext(canvas.getContext('2d'));
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(60, 20, 80, 140);

    const index = buildForegroundOverlapIndex(ctx, 200, 200);
    const preferred = preferredCaptionCenterForLabel('Bottom center', 200, 200, 100, 30, 0.06);
    const result = findLeastOverlapCaptionCenter(index, 100, 30, {
      width: 200,
      height: 200,
      insetPx: 8,
      preferredX: preferred.x,
      preferredY: preferred.y,
    });

    expect(result.overlapCells).toBe(0);
    // Only the bottom strip (y > 160) is free for a 30px-tall box.
    expect(result.centerY).toBeGreaterThan(150);
  });
});

describe('captionBandPixelRectForLabel', () => {
  it('places bottom band in the lowest 28% strip', () => {
    const band = captionBandPixelRectForLabel('Bottom center', 200, 100, 0.06);
    expect(band.minY).toBeGreaterThanOrEqual(60);
    expect(band.maxY).toBeLessThanOrEqual(100);
    expect(band.maxY - band.minY).toBeLessThanOrEqual(34);
  });
});

describe('findCaptionCenterBandFirst', () => {
  it('keeps caption in bottom band when a free spot exists there', () => {
    const canvas = createCanvas(200, 200);
    const ctx = asDomCanvasContext(canvas.getContext('2d'));
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(60, 20, 80, 120);

    const index = buildForegroundOverlapIndex(ctx, 200, 200);
    const preferred = preferredCaptionCenterForLabel('Bottom center', 200, 200, 80, 24, 0.06);
    const result = findCaptionCenterBandFirst(index, 80, 24, {
      width: 200,
      height: 200,
      insetPx: 8,
      preferredX: preferred.x,
      preferredY: preferred.y,
    }, 'Bottom center', 0.06);

    expect(result.overlapCells).toBe(0);
    const band = captionBandPixelRectForLabel('Bottom center', 200, 200, 0.06);
    const bounds = centerSearchBoundsForTextBoxInBand(band, 80, 24, 200, 200, 8)!;
    expect(result.centerY).toBeGreaterThanOrEqual(bounds.minCy - 1);
    expect(result.centerY).toBeLessThanOrEqual(bounds.maxCy + 1);
  });
});

describe('computeAutoCaptionLayout', () => {
  it('returns an overlap-free layout when free space exists', () => {
    const canvas = createCanvas(200, 200);
    const ctx = asDomCanvasContext(canvas.getContext('2d'));
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(40, 10, 120, 130);

    const layout = computeAutoCaptionLayout(ctx, {
      width: 200,
      height: 200,
      text: '測試',
      preferredLabel: 'Bottom center',
      marginRatio: 0.06,
      lineHeightMultiplier: 1.15,
      strokeScale: 1,
      baseFontSizePx: 22,
      applyFont: (px) => {
        ctx.font = `700 ${px}px sans-serif`;
      },
    });

    expect(layout.overlapCells).toBe(0);
    expect(layout.lines.length).toBeGreaterThan(0);
    expect(layout.centerY).toBeGreaterThan(140);
    expect(layout.fontSize).toBe(22); // no shrink needed
  });

  it('binary search picks a larger font when extra band space allows', () => {
    const canvas = createCanvas(200, 200);
    const ctx = asDomCanvasContext(canvas.getContext('2d'));
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(70, 30, 60, 100);

    const layout = computeAutoCaptionLayout(ctx, {
      width: 200,
      height: 200,
      text: '嗨',
      preferredLabel: 'Bottom center',
      marginRatio: 0.06,
      lineHeightMultiplier: 1.15,
      strokeScale: 1,
      baseFontSizePx: 22,
      applyFont: (px) => {
        ctx.font = `700 ${px}px sans-serif`;
      },
    });

    expect(layout.overlapCells).toBe(0);
    expect(layout.fontSize).toBe(22);
  });

  it('shrinks the font when the frame is crowded', () => {
    const canvas = createCanvas(120, 120);
    const ctx = asDomCanvasContext(canvas.getContext('2d'));
    ctx.clearRect(0, 0, 120, 120);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    // Leave only a thin bottom strip free.
    ctx.fillRect(4, 4, 112, 96);

    const layout = computeAutoCaptionLayout(ctx, {
      width: 120,
      height: 120,
      text: '很長的一句測試文字',
      preferredLabel: 'Bottom center',
      marginRatio: 0.06,
      lineHeightMultiplier: 1.15,
      strokeScale: 1,
      baseFontSizePx: 20,
      applyFont: (px) => {
        ctx.font = `700 ${px}px sans-serif`;
      },
    });

    expect(layout.fontSize).toBeLessThanOrEqual(20);
    expect(layout.lines.length).toBeGreaterThan(0);
  });

  it('fixed mode keeps baseFontSizePx when auto would shrink', () => {
    const canvas = createCanvas(120, 120);
    const ctx = asDomCanvasContext(canvas.getContext('2d'));
    ctx.clearRect(0, 0, 120, 120);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(4, 4, 112, 96);

    const shared = {
      width: 120,
      height: 120,
      text: '很長的一句測試文字',
      preferredLabel: 'Bottom center',
      marginRatio: 0.06,
      lineHeightMultiplier: 1.15,
      strokeScale: 1,
      baseFontSizePx: 20,
      applyFont: (px: number) => {
        ctx.font = `700 ${px}px sans-serif`;
      },
    };

    const autoLayout = computeAutoCaptionLayout(ctx, { ...shared, fontSizeMode: 'auto' });
    const fixedLayout = computeAutoCaptionLayout(ctx, { ...shared, fontSizeMode: 'fixed' });

    expect(fixedLayout.fontSize).toBe(20);
    expect(autoLayout.fontSize).toBeLessThan(20);
  });
});

describe('preferredCaptionCenterForLabel', () => {
  it('maps labels to their zone centers', () => {
    const top = preferredCaptionCenterForLabel('Top center', 200, 200, 80, 30, 0.06);
    expect(top.y).toBeLessThan(60);
    const bottomRight = preferredCaptionCenterForLabel('Bottom right', 200, 200, 80, 30, 0.06);
    expect(bottomRight.x).toBeGreaterThan(100);
    expect(bottomRight.y).toBeGreaterThan(140);
  });
});
