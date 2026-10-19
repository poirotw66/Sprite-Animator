/**
 * Provider-agnostic image generation for Sprite Animator (BYOK).
 * LINE sticker / comic paths may keep calling Gemini directly.
 */

export type ImageProviderId = 'gemini' | 'openrouter';

export type ProgressCallback = (status: string) => void;

/** Extra reference image (e.g. previous frame for continuity). */
export interface ReferenceImage {
  imageBase64: string;
  /** Caption inserted after this image for multimodal models (Gemini parts). */
  caption?: string;
}

export interface GenerateImageRequest {
  /** Character / reference image as data URL or raw base64. */
  imageBase64: string;
  /**
   * Optional caption after the primary image (Gemini multimodal parts).
   * Used by frame-by-frame mode; sprite-sheet mode omits this.
   */
  primaryImageCaption?: string;
  /** Extra references (previous frame, etc.). */
  additionalImages?: ReferenceImage[];
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
