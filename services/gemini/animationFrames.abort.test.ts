import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateImage, planAnimationStoryboard } = vi.hoisted(() => ({
  generateImage: vi.fn(),
  planAnimationStoryboard: vi.fn(),
}));

vi.mock('../imageProviders', async () => {
  const actual = await vi.importActual<typeof import('../imageProviders')>('../imageProviders');
  return { ...actual, getImageProvider: () => ({ generateImage }) };
});

vi.mock('./storyboard', () => ({ planAnimationStoryboard }));

import { generateAnimationFrames } from './animationFrames';

function generate(signal: AbortSignal, delay = 4000) {
  return generateAnimationFrames('data:image/png;base64,AAA', 'jump', 2, 'mock-key', 'mock-model', undefined, delay, { signal });
}

describe('animation frame cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    generateImage.mockReset().mockResolvedValue('data:image/png;base64,FRAME');
    planAnimationStoryboard.mockReset().mockResolvedValue(['prep', 'jump']);
  });

  afterEach(() => vi.useRealTimers());

  it('does not plan or render with an already cancelled signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(generate(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(planAnimationStoryboard).not.toHaveBeenCalled();
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('ignores a non-cooperative storyboard result after cancellation', async () => {
    let finishPlanning!: (frames: string[]) => void;
    planAnimationStoryboard.mockImplementation(() => new Promise<string[]>((resolve) => { finishPlanning = resolve; }));
    const controller = new AbortController();
    const result = generate(controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(planAnimationStoryboard).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
    controller.abort();
    finishPlanning(['old prep', 'old action']);
    await rejected;
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('cancels the initial delay before any image request', async () => {
    const controller = new AbortController();
    const result = generate(controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(10000);
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('cancels between frames and does not send the remaining image requests', async () => {
    const controller = new AbortController();
    const result = generate(controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(generateImage).toHaveBeenCalledTimes(1);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(10000);
    expect(generateImage).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale image result even when its provider ignores cancellation', async () => {
    let finishImage!: (frame: string) => void;
    generateImage.mockImplementation(() => new Promise<string>((resolve) => { finishImage = resolve; }));
    const controller = new AbortController();
    const result = generate(controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(2000);
    controller.abort();
    finishImage('data:image/png;base64,STALE');
    await rejected;
    expect(generateImage).toHaveBeenCalledTimes(1);
  });
});
