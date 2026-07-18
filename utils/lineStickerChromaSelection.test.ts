import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../scripts/line-sticker/nodeImage.mts';
import {
  detectSheetChromaKeyColor,
  selectChromaKeyColor,
  type ChromaReferenceImage,
} from './lineStickerChromaSelection';

function solid(r: number, g: number, b: number, width = 8, height = 8): ChromaReferenceImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

describe('LINE sticker chroma selection', () => {
  it('chooses magenta for green character art', () => {
    const result = selectChromaKeyColor('auto', [solid(30, 190, 55)]);
    expect(result.color).toBe('magenta');
    expect(result.green).toBeGreaterThan(result.magenta);
  });

  it('chooses green for magenta character art', () => {
    const result = selectChromaKeyColor('auto', [solid(220, 35, 190)]);
    expect(result.color).toBe('green');
    expect(result.magenta).toBeGreaterThan(result.green);
  });

  it('uses green as the neutral tie-breaker and preserves explicit overrides', () => {
    expect(selectChromaKeyColor('auto', [solid(245, 245, 245)]).color).toBe('green');
    expect(selectChromaKeyColor('magenta', [solid(30, 190, 55)]).color).toBe('magenta');
  });

  it('rejects invalid runtime config values', () => {
    expect(() =>
      selectChromaKeyColor('blue' as unknown as 'auto', [solid(245, 245, 245)])
    ).toThrow('Invalid chromaKeyColor');
  });

  it('detects generated sheet chroma from its border', () => {
    expect(detectSheetChromaKeyColor(solid(0, 255, 0))).toBe('green');
    expect(detectSheetChromaKeyColor(solid(255, 0, 255))).toBe('magenta');
  });

  it('selects green for the tracked real Huahua artwork fixture', () => {
    const fixture = decodePng(
      new Uint8Array(
        readFileSync(resolve(process.cwd(), 'utils/fixtures/line-sticker/real-huahua-sheet-4x5.png'))
      )
    );
    const result = selectChromaKeyColor('auto', [fixture]);
    expect(result.color).toBe('green');
    expect(result.sampledPixels).toBeGreaterThan(0);
    expect(result.green).toBeLessThanOrEqual(result.magenta);
  });
});
