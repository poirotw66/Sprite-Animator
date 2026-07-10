import { describe, expect, it } from 'vitest';
import { processChromaKeyForge } from './chromaKeyForge';

function fillGreen(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
}

describe('processChromaKeyForge', () => {
  it('removes green background connected to borders', () => {
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    fillGreen(data);
    // white blob in center
    for (let y = 3; y <= 4; y++) {
      for (let x = 3; x <= 4; x++) {
        const i = (y * w + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }

    processChromaKeyForge(data, w, h, { r: 0, g: 255, b: 0 });

    expect(data[0 * 4 + 3]).toBe(0);
    expect(data[(3 * w + 3) * 4 + 3]).toBe(255);
  });

  it('leaves interior green pocket opaque when not border-connected', () => {
    const w = 6;
    const h = 6;
    const data = new Uint8ClampedArray(w * h * 4);
    fillGreen(data);
    for (let y = 2; y <= 3; y++) {
      for (let x = 2; x <= 3; x++) {
        const i = (y * w + x) * 4;
        data[i] = 200;
        data[i + 1] = 80;
        data[i + 2] = 80;
      }
    }

    processChromaKeyForge(data, w, h, { r: 0, g: 255, b: 0 }, { threshold: 40, edgeThreshold: 60 });

    const center = (2 * w + 2) * 4 + 3;
    expect(data[center]).toBe(255);
    expect(data[0 * 4 + 3]).toBe(0);
  });
});
