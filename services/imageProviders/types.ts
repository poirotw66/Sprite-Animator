/**
 * Provider-agnostic image generation for Sprite Animator (BYOK).
 * LINE sticker / comic paths may keep calling Gemini directly.
 */

export type ImageProviderId = 'gemini' | 'openrouter';

export type ProgressCallback = (status: string) => void;

export interface GenerateImageRequest {
  /** Character / reference image as data URL or raw base64. */
  imageBase64: string;
  prompt: string;
  model: string;
  apiKey: string;
  /** Normalized aspect ratio string, e.g. "1:1", "4:3". */
  aspectRatio?: string;
  /** Provider-specific size tier when supported (Gemini / some OpenRouter models). */
  imageSize?: string;
  signal?: AbortSignal;
  onProgress?: ProgressCallback;
}

export interface ImageProvider {
  readonly id: ImageProviderId;
  /** Generate one image; returns a data URL (`data:image/...;base64,...`). */
  generateImage(request: GenerateImageRequest): Promise<string>;
  /** Optional connectivity check used by Settings. */
  validateApiKey(apiKey: string, signal?: AbortSignal): Promise<void>;
}

export const IMAGE_PROVIDER_IDS: readonly ImageProviderId[] = [
  'gemini',
  'openrouter',
] as const;

export function isImageProviderId(value: string): value is ImageProviderId {
  return (IMAGE_PROVIDER_IDS as readonly string[]).includes(value);
}
