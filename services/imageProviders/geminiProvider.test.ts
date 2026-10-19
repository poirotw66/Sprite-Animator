import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();
const list = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent,
      list,
    };
  },
}));

import { geminiImageProvider } from './geminiProvider';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('geminiImageProvider', () => {
  beforeEach(() => {
    generateContent.mockReset();
    list.mockReset();
  });

  it('validates API keys via models.list', async () => {
    list.mockResolvedValue({ models: [] });
    await geminiImageProvider.validateApiKey('AIza-test');
    expect(list).toHaveBeenCalledOnce();
  });

  it('returns a data URL from generateContent parts', async () => {
    generateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: 'image/png', data: TINY_PNG_B64 } }],
          },
        },
      ],
    });

    const result = await geminiImageProvider.generateImage({
      imageBase64: `data:image/png;base64,${TINY_PNG_B64}`,
      prompt: 'walk cycle',
      model: 'gemini-2.5-flash-image',
      apiKey: 'AIza-test',
      aspectRatio: '3:2',
      imageSize: '1K',
    });

    expect(result).toBe(`data:image/png;base64,${TINY_PNG_B64}`);
    expect(generateContent).toHaveBeenCalled();
    const arg = generateContent.mock.calls[0]![0];
    expect(arg.model).toBe('gemini-2.5-flash-image');
    expect(arg.config.imageConfig.aspectRatio).toBe('3:2');
    expect(arg.config.imageConfig.imageSize).toBe('1K');
  });
});
