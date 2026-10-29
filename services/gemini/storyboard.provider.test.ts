import { beforeEach, describe, expect, it, vi } from 'vitest';
import { planAnimationStoryboard } from './storyboard';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent,
    };
  },
}));

describe('planAnimationStoryboard', () => {
  beforeEach(() => { generateContent.mockReset(); });
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

  it('passes cancellation to Gemini and does not treat it as a fallback request', async () => {
    const controller = new AbortController();
    generateContent.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    await expect(planAnimationStoryboard({
      providerId: 'gemini',
      apiKey: 'mock-key',
      imageBase64: 'data:image/png;base64,AAA',
      userPrompt: 'jump',
      frameCount: 2,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(generateContent).toHaveBeenCalledOnce();
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ abortSignal: controller.signal }) }));
  });

  it('rejects a late Gemini storyboard success after cancellation', async () => {
    const controller = new AbortController();
    generateContent.mockImplementation(async () => {
      controller.abort();
      return { text: '1. Old prep\n2. Old action' };
    });
    await expect(planAnimationStoryboard({
      providerId: 'gemini',
      apiKey: 'mock-key',
      imageBase64: 'data:image/png;base64,AAA',
      userPrompt: 'jump',
      frameCount: 2,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
