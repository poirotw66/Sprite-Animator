import { describe, expect, it } from 'vitest';
import {
  extractFillHexFromTextColorPreset,
  strokeColorForFill,
  layoutFromPlacementLabel,
  resolveProgrammaticPlacementLabel,
  resolveProgrammaticFontFamilyCss,
  DEFAULT_PROGRAMMATIC_TEXT_OVERLAY_TUNING,
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

describe('resolveProgrammaticPlacementLabel', () => {
  it('returns fixed anchors for non-cycle modes', () => {
    expect(resolveProgrammaticPlacementLabel(0, 'bottom_center')).toBe('Bottom center');
    expect(resolveProgrammaticPlacementLabel(99, 'top_center')).toBe('Top center');
    expect(resolveProgrammaticPlacementLabel(3, 'middle_center')).toBe('Middle center');
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
