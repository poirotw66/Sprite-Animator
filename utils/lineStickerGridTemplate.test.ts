import { describe, expect, it } from 'vitest';
import {
  modelSkipsGridTemplateAttachment,
  resolveEffectiveGridTemplate,
  resolveSliceTemplateBounds,
} from './lineStickerGridTemplate';

describe('lineStickerGridTemplate', () => {
  it('skips template attachment for gemini-3.1-flash-image only', () => {
    expect(modelSkipsGridTemplateAttachment('gemini-3.1-flash-image')).toBe(true);
    expect(modelSkipsGridTemplateAttachment('gemini-3.1-flash-image-preview')).toBe(true);
    expect(modelSkipsGridTemplateAttachment('gemini-3.1-flash-lite-image')).toBe(false);
    expect(modelSkipsGridTemplateAttachment('gemini-3-pro-image')).toBe(false);
  });

  it('drops guided request for flash-image', () => {
    expect(resolveEffectiveGridTemplate('gemini-3.1-flash-image', 'guided')).toBe(false);
    expect(resolveEffectiveGridTemplate('gemini-3.1-flash-lite-image', 'guided')).toBe('guided');
  });

  it('uses detected bounds when no guided template is present', () => {
    const width = 200;
    const height = 200;
    const cols = 2;
    const rows = 2;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 255;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    const bounds = resolveSliceTemplateBounds(data, width, height, cols, rows, null);
    expect(bounds.source).toBe('detected');
    expect(bounds.xBounds).toHaveLength(cols + 1);
    expect(bounds.yBounds).toHaveLength(rows + 1);
  });
});
