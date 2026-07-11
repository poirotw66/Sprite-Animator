import { describe, expect, it } from 'vitest';
import { getReservedCaptionBandLabelForFrame } from './lineStickerPrompt';
import { composeStickerFrame, shouldUseComposeLayout } from './lineStickerCompose';
import {
  captionFontSizePx,
  mapBandLabelToComposePreset,
  resolveComposeSlots,
  resolveEffectiveComposePreset,
  slotsAreDisjoint,
  WORK_CANVAS_HEIGHT,
  WORK_CANVAS_WIDTH,
  type ComposeLayoutPreset,
} from './lineStickerComposeLayout';
import { LINE_STICKER_UPLOAD } from './lineStickerUploadSpec';

const LAYOUT_PRESETS = [
  'top_caption_bottom_subject',
  'bottom_caption_top_subject',
  'side_caption_left_subject_right',
  'side_caption_right_subject_left',
  'corner_top_left_subject_bottom_right',
  'corner_top_right_subject_bottom_left',
  'corner_bottom_left_subject_top',
  'corner_bottom_right_subject_top',
] as const;

describe('resolveComposeSlots', () => {
  it.each(LAYOUT_PRESETS)('keeps caption and subject slots disjoint for %s', (preset) => {
    const slots = resolveComposeSlots(preset, WORK_CANVAS_WIDTH, WORK_CANVAS_HEIGHT, 0.06);
    expect(slotsAreDisjoint(slots)).toBe(true);
  });

  it.each(LAYOUT_PRESETS)('keeps slots disjoint with caption sizing for %s', (preset) => {
    const slots = resolveComposeSlots(preset, WORK_CANVAS_WIDTH, WORK_CANVAS_HEIGHT, 0.06, {
      fontSizePx: 70,
      lineHeightMultiplier: 1.25,
    });
    expect(slotsAreDisjoint(slots)).toBe(true);
  });

  it('keeps slots disjoint on a small 200x200 canvas', () => {
    for (const preset of LAYOUT_PRESETS) {
      const slots = resolveComposeSlots(preset, 200, 200, 0.06);
      expect(slotsAreDisjoint(slots)).toBe(true);
    }
  });

  it('sizes horizontal caption band to hold one full-size text line', () => {
    const slots = resolveComposeSlots(
      'top_caption_bottom_subject',
      WORK_CANVAS_WIDTH,
      WORK_CANVAS_HEIGHT,
      0.06,
      { fontSizePx: 70, lineHeightMultiplier: 1.25 }
    );
    const bandH = slots.captionSlot.maxY - slots.captionSlot.minY;
    expect(bandH).toBeGreaterThanOrEqual(Math.ceil(70 * 1.25));
  });

  it('uses a vertical full-size glyph strip for side presets', () => {
    const slots = resolveComposeSlots(
      'side_caption_right_subject_left',
      WORK_CANVAS_WIDTH,
      WORK_CANVAS_HEIGHT,
      0.06,
      { fontSizePx: 70, lineHeightMultiplier: 1.25 }
    );
    expect(slots.captionOrientation).toBe('vertical');
    const stripW = slots.captionSlot.maxX - slots.captionSlot.minX;
    expect(stripW).toBeGreaterThanOrEqual(70);
  });

  it('aligns corner presets to left or right within a full-width band', () => {
    const left = resolveComposeSlots(
      'corner_top_left_subject_bottom_right',
      WORK_CANVAS_WIDTH,
      WORK_CANVAS_HEIGHT,
      0.06
    );
    const right = resolveComposeSlots(
      'corner_top_right_subject_bottom_left',
      WORK_CANVAS_WIDTH,
      WORK_CANVAS_HEIGHT,
      0.06
    );
    expect(left.captionAlign).toBe('left');
    expect(right.captionAlign).toBe('right');
    expect(left.captionSlot.maxX - left.captionSlot.minX).toBe(
      right.captionSlot.maxX - right.captionSlot.minX
    );
  });
});

describe('mapBandLabelToComposePreset', () => {
  it('maps bottom-left and bottom-right to corner bottom presets', () => {
    expect(mapBandLabelToComposePreset('Bottom left')).toBe('corner_bottom_left_subject_top');
    expect(mapBandLabelToComposePreset('Bottom right')).toBe('corner_bottom_right_subject_top');
  });

  it('maps bottom center to bottom caption layout', () => {
    expect(mapBandLabelToComposePreset('Bottom center')).toBe('bottom_caption_top_subject');
  });

  it('maps diagonal bands to bottom-right corner caption', () => {
    expect(mapBandLabelToComposePreset('Slight diagonal offset (top-left to bottom-right)')).toBe(
      'corner_bottom_right_subject_top'
    );
  });

  it('anchors subject to the caption edge on bottom-caption presets', () => {
    for (const preset of [
      'bottom_caption_top_subject',
      'corner_bottom_left_subject_top',
      'corner_bottom_right_subject_top',
    ] as const) {
      const slots = resolveComposeSlots(preset, WORK_CANVAS_WIDTH, WORK_CANVAS_HEIGHT, 0.06, {
        fontSizePx: 70,
        lineHeightMultiplier: 1.25,
      });
      expect(slots.subjectAnchor).toBe('bottom_center');
      expect(slots.subjectScale).toBe(1.18);
    }
  });

  it('maps beside-head labels to side layouts', () => {
    expect(mapBandLabelToComposePreset('Beside head (left)')).toBe(
      'side_caption_left_subject_right'
    );
    expect(mapBandLabelToComposePreset('Beside head (right)')).toBe(
      'side_caption_right_subject_left'
    );
  });
});

describe('shouldUseComposeLayout', () => {
  it('skips compose when phrase is empty', () => {
    expect(shouldUseComposeLayout({ enabled: true }, '')).toBe(false);
    expect(shouldUseComposeLayout({ enabled: true }, '  ')).toBe(false);
    expect(shouldUseComposeLayout({ enabled: true }, '早安')).toBe(true);
    expect(shouldUseComposeLayout({ enabled: false }, '早安')).toBe(false);
  });
});

describe('composeStickerFrame without phrase', () => {
  it('returns the input frame unchanged', () => {
    const subject = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    subject.data[3] = 255;
    const output = composeStickerFrame(subject, {
      phrase: '',
      compose: { enabled: true, layout: 'top_caption_bottom_subject' },
    });
    expect(output).toBe(subject);
  });
});

describe('resolveEffectiveComposePreset', () => {
  it('resolves generation_aligned from frame band label', () => {
    const preset = resolveEffectiveComposePreset(
      'generation_aligned',
      0,
      getReservedCaptionBandLabelForFrame
    );
    expect(LAYOUT_PRESETS).toContain(preset);
  });
});

describe('captionFontSizePx', () => {
  it('uses work canvas min dimension at 20%', () => {
    expect(captionFontSizePx(WORK_CANVAS_WIDTH, WORK_CANVAS_HEIGHT, 20)).toBe(64);
  });
});

describe('composeStickerFrame', () => {
  function makeSubjectBlob(width: number, height: number): {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  } {
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
          data[i] = 40;
          data[i + 1] = 120;
          data[i + 2] = 200;
          data[i + 3] = 255;
        }
      }
    }
    return { data, width, height };
  }

  it('outputs within LINE sticker limits with even dimensions', () => {
    const subject = makeSubjectBlob(180, 180);
    const output = composeStickerFrame(subject, {
      phrase: '太扯了吧',
      compose: {
        enabled: true,
        layout: 'top_caption_bottom_subject',
        tuning: { fontSizePercent: 22, fontSizeMode: 'fixed' },
      },
    });
    expect(output.width).toBeLessThanOrEqual(LINE_STICKER_UPLOAD.stickerMaxWidth);
    expect(output.height).toBeLessThanOrEqual(LINE_STICKER_UPLOAD.stickerMaxHeight);
    expect(output.width % 2).toBe(0);
    expect(output.height % 2).toBe(0);
  });

  it('draws caption ink inside the caption slot for preset A', () => {
    const subject = makeSubjectBlob(180, 180);
    const output = composeStickerFrame(subject, {
      phrase: '早安',
      compose: {
        enabled: true,
        layout: 'top_caption_bottom_subject',
        tuning: { fontSizePercent: 22, fontSizeMode: 'fixed' },
      },
    });
    const slots = resolveComposeSlots(
      'top_caption_bottom_subject',
      WORK_CANVAS_WIDTH,
      WORK_CANVAS_HEIGHT,
      0.06
    );
    const y0 = Math.floor(slots.captionSlot.minY);
    const y1 = Math.floor(slots.captionSlot.maxY);
    let captionInk = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = 0; x < output.width; x += 1) {
        if (output.data[(y * output.width + x) * 4 + 3]! > 40) {
          captionInk += 1;
        }
      }
    }
    expect(captionInk).toBeGreaterThan(0);
  });

  it('letter spacing widens the caption ink footprint', () => {
    function captionInkWidth(letterSpacingEm: number): number {
      const subject = makeSubjectBlob(180, 180);
      const output = composeStickerFrame(subject, {
        phrase: '早安你好',
        compose: {
          enabled: true,
          layout: 'top_caption_bottom_subject',
          captionLetterSpacingEm: letterSpacingEm,
          tuning: { fontSizePercent: 20, fontSizeMode: 'fixed' },
        },
      });
      const slots = resolveComposeSlots(
        'top_caption_bottom_subject',
        WORK_CANVAS_WIDTH,
        WORK_CANVAS_HEIGHT,
        0.06,
        { fontSizePx: 64, lineHeightMultiplier: 1.25 }
      );
      const y0 = Math.floor(slots.captionSlot.minY);
      const y1 = Math.min(Math.floor(slots.captionSlot.maxY), output.height);
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      for (let y = y0; y < y1; y += 1) {
        for (let x = 0; x < output.width; x += 1) {
          if (output.data[(y * output.width + x) * 4 + 3]! > 40) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          }
        }
      }
      return maxX - minX;
    }

    expect(captionInkWidth(0.2)).toBeGreaterThan(captionInkWidth(0));
  });
});

describe('ComposeLayoutPreset coverage', () => {
  it('includes generation_aligned in the public preset union', () => {
    const preset: ComposeLayoutPreset = 'generation_aligned';
    expect(preset).toBe('generation_aligned');
  });
});
