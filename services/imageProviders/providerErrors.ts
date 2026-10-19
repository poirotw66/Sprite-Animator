import { getErrorMessage, isQuotaError } from '../../types/errors';

/**
 * Map provider failures to a short, user-facing message.
 * Rate-limit / overload cases keep "429"/"503" so retryOperation can detect them.
 */
export function formatImageProviderError(
  providerId: 'gemini' | 'openrouter',
  err: unknown,
): Error {
  const raw = getErrorMessage(err);
  const providerLabel = providerId === 'openrouter' ? 'OpenRouter' : 'Gemini';

  if (isQuotaError(err)) {
    return new Error(
      `${providerLabel} rate limit or overload (${raw}). Wait a moment and retry, or switch model / provider in Settings.`,
    );
  }

  const lower = raw.toLowerCase();
  if (
    lower.includes('invalid api key') ||
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('api_key_invalid')
  ) {
    return new Error(
      `${providerLabel} API key is invalid. Check Settings and paste a valid key.`,
    );
  }

  if (
    lower.includes('input_reference') ||
    lower.includes('reference image') ||
    lower.includes('image input') ||
    lower.includes('does not support')
  ) {
    return new Error(
      `${providerLabel}: this model may not support image-to-image references. Try google/gemini-*-image (OpenRouter) or switch to Gemini.`,
    );
  }

  if (!raw || raw === 'Unknown error') {
    return new Error(`${providerLabel} image generation failed.`);
  }

  if (raw.startsWith(`${providerLabel}`)) {
    return err instanceof Error ? err : new Error(raw);
  }

  return new Error(`${providerLabel}: ${raw}`);
}
