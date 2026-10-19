import { throwIfAborted } from '../../utils/abort';
import { getErrorMessage } from '../../types/errors';
import { retryOperation } from '../gemini/retry';
import type { GenerateImageRequest, ImageProvider } from './types';

const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

function toDataUrl(imageBase64: string): string {
  if (imageBase64.startsWith('data:')) return imageBase64;
  return `data:image/png;base64,${imageBase64}`;
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/poirotw66/Sprite-Animator',
    'X-Title': 'Sprite Animator',
  };
}

interface OpenRouterImageData {
  b64_json?: string;
  media_type?: string;
  url?: string;
}

interface OpenRouterImagesResponse {
  data?: OpenRouterImageData[];
  error?: { message?: string; code?: string | number };
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    return body.error?.message || body.message || response.statusText;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

function buildPromptWithCaptions(request: GenerateImageRequest): string {
  const lines: string[] = [];
  if (request.primaryImageCaption) {
    lines.push(`Primary reference: ${request.primaryImageCaption}`);
  }
  for (const [index, extra] of (request.additionalImages ?? []).entries()) {
    lines.push(
      `Additional reference ${index + 1}: ${extra.caption ?? 'context image'}`,
    );
  }
  if (lines.length === 0) return request.prompt;
  return `${lines.join('\n')}\n\n${request.prompt}`;
}

/**
 * OpenRouter BYOK image generation via POST /api/v1/images.
 * Uses input_references for character-conditioned generation (sheet + frames).
 */
export const openRouterImageProvider: ImageProvider = {
  id: 'openrouter',

  async validateApiKey(apiKey: string, signal?: AbortSignal): Promise<void> {
    if (!apiKey.trim()) {
      throw new Error('API key is empty');
    }
    throwIfAborted(signal);
    const response = await fetch(`${OPENROUTER_MODELS_URL}?limit=1`, {
      method: 'GET',
      headers: authHeaders(apiKey),
      signal,
    });
    if (!response.ok) {
      const detail = await parseErrorResponse(response);
      if (response.status === 429 || response.status === 503) {
        throw new Error(`OpenRouter rate limit (${response.status}): ${detail}`);
      }
      throw new Error(detail);
    }
  },

  async generateImage(request: GenerateImageRequest): Promise<string> {
    const {
      imageBase64,
      additionalImages,
      model,
      apiKey,
      aspectRatio,
      imageSize,
      signal,
      onProgress,
    } = request;

    if (!apiKey) {
      throw new Error(
        'API Key is missing. Please set your OpenRouter API Key in Settings.',
      );
    }
    throwIfAborted(signal);

    const inputReferences = [
      {
        type: 'image_url',
        image_url: { url: toDataUrl(imageBase64) },
      },
      ...(additionalImages ?? []).map((extra) => ({
        type: 'image_url' as const,
        image_url: { url: toDataUrl(extra.imageBase64) },
      })),
    ];

    const body: Record<string, unknown> = {
      model,
      prompt: buildPromptWithCaptions(request),
      n: 1,
      output_format: 'png',
      input_references: inputReferences,
    };
    if (aspectRatio) body.aspect_ratio = aspectRatio;
    if (imageSize) body.resolution = imageSize;

    const run = async (): Promise<string> => {
      throwIfAborted(signal);
      const response = await fetch(OPENROUTER_IMAGES_URL, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const detail = await parseErrorResponse(response);
        if (response.status === 429 || response.status === 503) {
          throw new Error(
            `OpenRouter rate limit (${response.status}): ${detail}`,
          );
        }
        throw new Error(detail);
      }

      const json = (await response.json()) as OpenRouterImagesResponse;
      if (json.error?.message) {
        throw new Error(json.error.message);
      }

      const first = json.data?.[0];
      if (first?.b64_json) {
        const mime = first.media_type || 'image/png';
        return `data:${mime};base64,${first.b64_json}`;
      }
      if (first?.url?.startsWith('data:')) {
        return first.url;
      }
      if (first?.url) {
        const imageResponse = await fetch(first.url, { signal });
        if (!imageResponse.ok) {
          throw new Error('Failed to download OpenRouter image URL');
        }
        const buffer = await imageResponse.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]!);
        }
        const b64 = btoa(binary);
        const mime =
          imageResponse.headers.get('content-type') || 'image/png';
        return `data:${mime};base64,${b64}`;
      }

      throw new Error('No image data received from OpenRouter');
    };

    try {
      return await retryOperation(run, onProgress, 3, 4000, signal);
    } catch (err) {
      throw new Error(getErrorMessage(err) || 'OpenRouter image generation failed');
    }
  },
};
