/**
 * Retry utilities for Gemini API calls (rate limit / quota handling).
 */

import { isQuotaError as checkQuotaError } from '../../types/errors';
import { logger } from '../../utils/logger';

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const isQuotaError = (error: unknown): boolean => checkQuotaError(error);

/**
 * Retries an async operation with exponential backoff on quota/rate-limit errors.
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  onStatusUpdate?: (msg: string) => void,
  retries = 5,
  baseDelay = 4000
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      if (isQuotaError(error) && i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
        const waitSeconds = Math.round(delay / 1000);

        logger.warn(
          `Rate limit/Overload hit (Attempt ${i + 1}/${retries}). Retrying in ${waitSeconds}s...`
        );
        if (onStatusUpdate) {
          onStatusUpdate(
            `API 繁忙 (429/503)，等待 ${waitSeconds} 秒後重試... (嘗試 ${i + 1}/${retries})`
          );
        }

        await wait(delay);
        continue;
      }

      throw error;
    }
  }
  throw lastError;
}
