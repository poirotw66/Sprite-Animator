import { describe, expect, it } from 'vitest';
import {
  resolvePhraseAdaptiveCaptionTuning,
} from './lineStickerTextOverlayTypes';
import {
  lineWidthWithSpacing,
  wrapLinesWithSpacing,
} from './lineStickerTextOverlayGeometry';
import { createCanvas } from '@napi-rs/canvas';
import { composeStickerFrame } from './lineStickerCompose';
import {
  sheetPhraseOffsetFromDir,
  slicePhraseWindow,
} from './lineStickerSheetPhrases';
import { WORK_CANVAS_HEIGHT, WORK_CANVAS_WIDTH } from './lineStickerComposeLayout';

describe('resolvePhraseAdaptiveCaptionTuning', () => {
  it('boosts short phrases and tightens long phrases', () => {
    expect(resolvePhraseAdaptiveCaptionTuning('下課沒', 20, 0.16)).toEqual({
      fontSizePercent: 22,
      letterSpacingEm: 0.18,
    });
    expect(resolvePhraseAdaptiveCaptionTuning('早安你好', 20, 0.16)).toEqual({
      fontSizePercent: 20,
      letterSpacingEm: 0.16,
    });
    expect(resolvePhraseAdaptiveCaptionTuning('帥不過三秒', 20, 0.16)).toEqual({
      fontSizePercent: 19,
      letterSpacingEm: 0.14,
    });
  });
});

describe('wrapLinesWithSpacing', () => {
  it('wraps earlier than plain measureText when letter spacing is wide', () => {
    const canvas = createCanvas(400, 120);
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
    ctx.font = '700 64px sans-serif';
    const phrase = '哼才不理你';
    const maxWidth = 280;
    const spacingPx = 12;
    const spaced = wrapLinesWithSpacing(ctx, phrase, maxWidth, spacingPx);
    expect(spaced.length).toBeGreaterThan(1);
    for (const line of spaced) {
      expect(lineWidthWithSpacing(ctx, line, spacingPx)).toBeLessThanOrEqual(maxWidth + 1);
    }
  });
});

describe('sheetPhraseOffsetFromDir', () => {
  it('derives offsets from sheet folder names', () => {
    expect(sheetPhraseOffsetFromDir('/job/sheet-1', 4, 5)).toBe(0);
    expect(sheetPhraseOffsetFromDir('/job/sheet-2', 4, 5)).toBe(20);
  });

  it('slices phrase windows', () => {
    const phrases = ['a', 'b', 'c', 'd'];
    expect(slicePhraseWindow(phrases, 1, 2)).toEqual(['b', 'c']);
  });
});

describe('composeStickerFrame trimAfterCompose', () => {
  function makeSubjectBlob(width: number, height: number) {
    const data = new Uint8ClampedArray(width * height * 4);
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height * 0.65);
    const radius = Math.floor(Math.min(width, height) * 0.2);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          const i = (y * width + x) * 4;
          data[i + 3] = 255;
        }
      }
    }
    return { data, width, height };
  }

  it('trims transparent margins when trimAfterCompose is enabled', () => {
    const subject = makeSubjectBlob(180, 180);
    const untrimmed = composeStickerFrame(subject, {
      phrase: '聽你在講',
      compose: {
        enabled: true,
        layout: 'bottom_caption_top_subject',
        trimAfterCompose: false,
        phraseLengthAdaptive: false,
        tuning: { fontSizePercent: 20, fontSizeMode: 'fixed' },
      },
    });
    const trimmed = composeStickerFrame(subject, {
      phrase: '聽你在講',
      compose: {
        enabled: true,
        layout: 'bottom_caption_top_subject',
        trimAfterCompose: true,
        phraseLengthAdaptive: false,
        tuning: { fontSizePercent: 20, fontSizeMode: 'fixed' },
      },
    });
    expect(trimmed.width).toBeLessThan(untrimmed.width);
    expect(trimmed.height).toBeLessThan(untrimmed.height);
    expect(untrimmed.width).toBe(WORK_CANVAS_WIDTH);
    expect(untrimmed.height).toBe(WORK_CANVAS_HEIGHT);
  });

  it('pads trimmed portrait output to landscape when preferLandscapeAspect is enabled', () => {
    const subject = makeSubjectBlob(120, 200);
    const output = composeStickerFrame(subject, {
      phrase: '哼',
      fontKey: 'naikai',
      compose: {
        enabled: true,
        layout: 'side_caption_right_subject_left',
        trimAfterCompose: true,
        preferLandscapeAspect: true,
        minLandscapeAspect: 1.05,
        phraseLengthAdaptive: false,
        tuning: { fontSizePercent: 18, fontSizeMode: 'fixed' },
      },
    });
    expect(output.width).toBeGreaterThan(output.height);
  });
});
