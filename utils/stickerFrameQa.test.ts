import { describe, expect, it } from 'vitest';
import {
  auditStickerFrames,
  measureForegroundRatio,
  scoreDimensionAgainstMedian,
  scoreModelDrawnTextContrast,
} from './stickerFrameQa';

function solidFrame(
  width: number,
  height: number,
  fill: (i: number) => [number, number, number, number]
): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = fill(i);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width, height };
}

describe('stickerFrameQa', () => {
  it('measureForegroundRatio is low on empty chroma frame', () => {
    const frame = solidFrame(64, 64, () => [0, 255, 0, 255]);
    expect(measureForegroundRatio(frame)).toBeLessThan(0.02);
  });

  it('measureForegroundRatio is high when subject blob present', () => {
    const frame = solidFrame(64, 64, (i) => {
      const x = (i / 4) % 64;
      const y = Math.floor(i / 4 / 64);
      const inBlob = x > 20 && x < 44 && y > 20 && y < 44;
      return inBlob ? [40, 40, 200, 255] : [0, 255, 0, 255];
    });
    expect(measureForegroundRatio(frame)).toBeGreaterThan(0.1);
  });

  it('scoreDimensionAgainstMedian penalizes large drift', () => {
    expect(scoreDimensionAgainstMedian(256, 204, 256, 204)).toBe(1);
    expect(scoreDimensionAgainstMedian(320, 204, 256, 204)).toBeLessThan(0.8);
  });

  it('scoreModelDrawnTextContrast flags empty caption band', () => {
    const empty = solidFrame(64, 64, () => [0, 255, 0, 255]);
    expect(scoreModelDrawnTextContrast(empty, '早安')).toBeLessThan(0.6);
  });

  it('auditStickerFrames summarizes low-scoring stickers', () => {
    const empty = solidFrame(64, 64, () => [0, 255, 0, 255]);
    const report = auditStickerFrames([
      { globalIndex: 1, phrase: 'test', frame: empty, pngBytes: 5000 },
    ], { checkModelText: true });
    expect(report.pass).toBe(false);
    expect(report.summaryWarnings.length).toBeGreaterThan(0);
  });

  it('reports green fringe counts on sliced frames', () => {
    const frame = solidFrame(32, 32, (i) => {
      const x = (i / 4) % 32;
      const y = Math.floor(i / 4 / 32);
      if (x === 5 && y === 4) return [10, 40, 8, 255];
      if (x >= 14 && x <= 16 && y >= 14 && y <= 16) return [19, 29, 13, 255];
      if (x >= 10 && x <= 18 && y >= 10 && y <= 18) return [80, 50, 40, 255];
      return [0, 0, 0, 0];
    });
    const report = auditStickerFrames([{ globalIndex: 1, frame }]);
    expect(report.entries[0]!.edgeGreenCount).toBeGreaterThanOrEqual(1);
    expect(report.entries[0]!.pocketGreenCount).toBeGreaterThanOrEqual(1);
  });
});
