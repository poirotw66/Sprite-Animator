import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateImage = vi.fn();

vi.mock('../imageProviders', async () => {
  const actual = await vi.importActual<typeof import('../imageProviders')>(
    '../imageProviders',
  );
  return {
    ...actual,
    getImageProvider: () => ({
      id: 'gemini',
      generateImage,
      validateApiKey: vi.fn(),
    }),
  };
});

vi.mock('./imageUtils', async () => {
  const actual = await vi.importActual<typeof import('./imageUtils')>('./imageUtils');
  return {
    ...actual,
    normalizeBackgroundColor: vi.fn(async (image: string) => `normalized:${image}`),
    getBestAspectRatio: () => '3:2',
    getLineStickerSpriteSheetAspectRatio: () => '4:5',
  };
});

import { generateSpriteSheet } from './spriteSheet';
import { normalizeBackgroundColor } from './imageUtils';

describe('generateSpriteSheet via ImageProvider', () => {
  beforeEach(() => {
    generateImage.mockReset();
    generateImage.mockResolvedValue('data:image/png;base64,AAA');
    vi.mocked(normalizeBackgroundColor).mockClear();
  });

  it('uses animation prompt path and providerId without LINE heuristics', async () => {
    await generateSpriteSheet(
      'data:image/png;base64,ref',
      'happy bounce',
      3,
      2,
      'key',
      'gemini-2.5-flash-image',
      undefined,
      'green',
      '1K',
      undefined,
      undefined,
      { providerId: 'gemini', sheetKind: 'animation' },
    );

    expect(generateImage).toHaveBeenCalledOnce();
    const req = generateImage.mock.calls[0]![0];
    expect(req.prompt).toMatch(/Task & Motion|sprite sheet/i);
    expect(req.prompt).not.toMatch(/LINE sticker|LINE 貼圖/);
    expect(req.aspectRatio).toBe('3:2');
    expect(normalizeBackgroundColor).toHaveBeenCalled();
  });

  it('uses LINE layout when sheetKind is line-sticker', async () => {
    await generateSpriteSheet(
      'data:image/png;base64,ref',
      'cell brief without markers',
      4,
      5,
      'key',
      'gemini-2.5-flash-image',
      undefined,
      'green',
      '1K',
      false,
      undefined,
      {
        providerId: 'gemini',
        sheetKind: 'line-sticker',
        lineStickerIncludeText: false,
      },
    );

    const req = generateImage.mock.calls[0]![0];
    expect(req.aspectRatio).toBe('4:5');
    expect(req.prompt).toMatch(/4|grid|ROW|sticker/i);
  });
});
