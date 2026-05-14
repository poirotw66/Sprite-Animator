import { describe, expect, it } from 'vitest';
import {
  extractFillHexFromTextColorPreset,
  strokeColorForFill,
  layoutFromPlacementLabel,
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

describe('layoutFromPlacementLabel', () => {
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
