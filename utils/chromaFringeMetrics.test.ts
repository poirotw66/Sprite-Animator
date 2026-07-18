import { describe, expect, it } from 'vitest';
import { measureChromaFringe } from './chromaFringeMetrics';

describe('measureChromaFringe', () => {
  it('counts edge green separately from enclosed pocket green', () => {
    const w = 24;
    const h = 24;
    const data = new Uint8ClampedArray(w * h * 4);
    // transparent background
    for (let i = 0; i < data.length; i += 4) data[i + 3] = 0;

    // edge green pixel touching transparency (row 8 is transparent above)
    const edge = (8 * w + 4) * 4;
    data[edge] = 10;
    data[edge + 1] = 40;
    data[edge + 2] = 8;
    data[edge + 3] = 255;

    // pocket green away from transparency
    const pocket = (12 * w + 12) * 4;
    data[pocket] = 19;
    data[pocket + 1] = 29;
    data[pocket + 2] = 13;
    data[pocket + 3] = 255;
    // pocket green surrounded by opaque subject
    for (let y = 8; y <= 18; y++) {
      for (let x = 8; x <= 18; x++) {
        if (x >= 12 && x <= 14 && y >= 12 && y <= 14) continue;
        const i = (y * w + x) * 4;
        data[i] = 80;
        data[i + 1] = 50;
        data[i + 2] = 40;
        data[i + 3] = 255;
      }
    }

    const m = measureChromaFringe(data, w, h);
    expect(m.edgeGreenCount + m.pocketGreenCount).toBeGreaterThanOrEqual(2);
  });

  it('does not classify warm neutral crayon black as olive fringe', () => {
    const w = 9;
    const h = 9;
    const data = new Uint8ClampedArray(w * h * 4);
    const p = (4 * w + 4) * 4;
    data[p] = 24;
    data[p + 1] = 21;
    data[p + 2] = 16;
    data[p + 3] = 255;
    expect(measureChromaFringe(data, w, h).oliveFringeCount).toBe(0);
  });

  it('still detects visibly olive edge residue', () => {
    const w = 9;
    const h = 9;
    const data = new Uint8ClampedArray(w * h * 4);
    const p = (4 * w + 4) * 4;
    data[p] = 40;
    data[p + 1] = 45;
    data[p + 2] = 20;
    data[p + 3] = 255;
    expect(measureChromaFringe(data, w, h).oliveFringeCount).toBe(1);
  });

  it('detects magenta residue with generic counters', () => {
    const w = 16;
    const h = 16;
    const data = new Uint8ClampedArray(w * h * 4);
    const p = (4 * w + 4) * 4;
    data[p] = 60;
    data[p + 1] = 10;
    data[p + 2] = 60;
    data[p + 3] = 255;
    const metrics = measureChromaFringe(data, w, h, 'magenta');
    expect(metrics.chromaKeyColor).toBe('magenta');
    expect(metrics.edgeChromaCount).toBe(1);
    expect(metrics.edgeGreenCount).toBe(0);
  });
});
