import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRouterImageProvider } from './openRouterProvider';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('openRouterImageProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('validates API keys via models list', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await openRouterImageProvider.validateApiKey('sk-or-test');
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(call[0])).toContain('openrouter.ai/api/v1/models');
    expect(call[1].headers).toMatchObject({
      Authorization: 'Bearer sk-or-test',
    });
  });

  it('generates an image via POST /api/v1/images', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/v1/images') && !url.includes('models')) {
          return new Response(
            JSON.stringify({
              data: [{ b64_json: TINY_PNG_B64, media_type: 'image/png' }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('not found', { status: 404 });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await openRouterImageProvider.generateImage({
      imageBase64: `data:image/png;base64,${TINY_PNG_B64}`,
      prompt: 'bounce walk cycle sprite sheet',
      model: 'google/gemini-2.5-flash-image',
      apiKey: 'sk-or-test',
      aspectRatio: '2:1',
      imageSize: '1K',
    });

    expect(result).toBe(`data:image/png;base64,${TINY_PNG_B64}`);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.model).toBe('google/gemini-2.5-flash-image');
    expect(body.aspect_ratio).toBe('2:1');
    expect(body.resolution).toBe('1K');
    expect(body.input_references).toHaveLength(1);
    expect(body.input_references[0].image_url.url).toContain('data:image/png');
  });

  it('sends previous-frame references for frame-by-frame continuity', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            data: [{ b64_json: TINY_PNG_B64, media_type: 'image/png' }],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await openRouterImageProvider.generateImage({
      imageBase64: `data:image/png;base64,${TINY_PNG_B64}`,
      primaryImageCaption: 'Reference Character (Style/Design Source)',
      additionalImages: [
        {
          imageBase64: `data:image/png;base64,${TINY_PNG_B64}`,
          caption: 'Previous Frame 1 (Motion Context)',
        },
      ],
      prompt: 'Frame 2 of 4',
      model: 'google/gemini-2.5-flash-image',
      apiKey: 'sk-or-test',
    });

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.input_references).toHaveLength(2);
    expect(body.prompt).toContain('Reference Character');
    expect(body.prompt).toContain('Previous Frame 1');
  });

  it('surfaces HTTP errors from OpenRouter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
        }),
      ),
    );

    await expect(
      openRouterImageProvider.generateImage({
        imageBase64: TINY_PNG_B64,
        prompt: 'test',
        model: 'google/gemini-2.5-flash-image',
        apiKey: 'bad',
      }),
    ).rejects.toThrow(/Invalid API key/);
  });
});
