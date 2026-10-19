import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateImage = vi.fn();
const planAnimationStoryboard = vi.fn();

vi.mock('../imageProviders', async () => {
  const actual = await vi.importActual<typeof import('../imageProviders')>(
    '../imageProviders',
  );
  return {
    ...actual,
    getImageProvider: (id: 'gemini' | 'openrouter') => ({
      id,
      generateImage,
      validateApiKey: vi.fn(),
    }),
  };
});

vi.mock('./storyboard', () => ({
  planAnimationStoryboard: (...args: unknown[]) => planAnimationStoryboard(...args),
  getAnimationStoryboard: vi.fn(),
}));

vi.mock('./retry', async () => {
  const actual = await vi.importActual<typeof import('./retry')>('./retry');
  return {
    ...actual,
    wait: vi.fn(async () => undefined),
  };
});

import { generateAnimationFrames } from './animationFrames';

const TINY = 'data:image/png;base64,AAA';

describe('generateAnimationFrames via ImageProvider', () => {
  beforeEach(() => {
    generateImage.mockReset();
    planAnimationStoryboard.mockReset();
    planAnimationStoryboard.mockResolvedValue(['prep pose', 'action pose']);
    generateImage.mockResolvedValue(TINY);
  });

  it('uses Gemini provider with character + previous-frame references', async () => {
    generateImage
      .mockResolvedValueOnce('data:image/png;base64,FRAME1')
      .mockResolvedValueOnce('data:image/png;base64,FRAME2');

    const frames = await generateAnimationFrames(
      TINY,
      'jump',
      2,
      'gemini-key',
      'gemini-2.5-flash-image',
      undefined,
      0,
      { providerId: 'gemini' },
    );

    expect(planAnimationStoryboard).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'gemini',
        apiKey: 'gemini-key',
        userPrompt: 'jump',
        frameCount: 2,
      }),
    );
    expect(frames).toHaveLength(2);
    expect(generateImage).toHaveBeenCalledTimes(2);

    const first = generateImage.mock.calls[0]![0];
    expect(first.primaryImageCaption).toContain('Reference Character');
    expect(first.additionalImages).toBeUndefined();
    expect(first.prompt).toContain('Pose Description: prep pose');

    const second = generateImage.mock.calls[1]![0];
    expect(second.additionalImages).toHaveLength(1);
    expect(second.additionalImages[0].imageBase64).toBe(
      'data:image/png;base64,FRAME1',
    );
    expect(second.additionalImages[0].caption).toContain('Previous Frame');
  });

  it('routes OpenRouter frame generation through the OpenRouter provider', async () => {
    await generateAnimationFrames(
      TINY,
      'wave',
      2,
      'sk-or-test',
      'google/gemini-2.5-flash-image',
      undefined,
      0,
      { providerId: 'openrouter' },
    );

    expect(planAnimationStoryboard).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'openrouter' }),
    );
    expect(generateImage).toHaveBeenCalled();
    expect(generateImage.mock.calls[0]![0].model).toBe(
      'google/gemini-2.5-flash-image',
    );
    expect(generateImage.mock.calls[0]![0].apiKey).toBe('sk-or-test');
  });

  it('surfaces a clear OpenRouter rate-limit message', async () => {
    generateImage.mockRejectedValueOnce(
      new Error('OpenRouter rate limit (429): Too Many Requests'),
    );

    await expect(
      generateAnimationFrames(
        TINY,
        'run',
        1,
        'sk-or-test',
        'google/gemini-2.5-flash-image',
        undefined,
        0,
        { providerId: 'openrouter' },
      ),
    ).rejects.toThrow(/OpenRouter rate limit/i);
  });
});
