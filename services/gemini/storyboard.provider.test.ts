import { describe, expect, it, vi } from 'vitest';
import { planAnimationStoryboard } from './storyboard';

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: vi.fn(),
    };
  },
}));

describe('planAnimationStoryboard', () => {
  it('returns algorithmic keyframes for OpenRouter without calling Gemini', async () => {
    const result = await planAnimationStoryboard({
      providerId: 'openrouter',
      apiKey: 'sk-or-test',
      imageBase64: 'data:image/png;base64,AAA',
      userPrompt: 'spin jump',
      frameCount: 4,
    });

    expect(result).toHaveLength(4);
    expect(result[0]).toMatch(/Preparation: spin jump/);
    expect(result[2]).toMatch(/Action: spin jump/);
    expect(result[3]).toMatch(/Recovery: spin jump/);
  });
});
