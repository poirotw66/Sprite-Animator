import { lazy, type ComponentType } from 'react';

/** User-facing message when chunk load fails after retries (e.g. after GitHub Pages deploy). */
export const CHUNK_LOAD_ERROR_MESSAGE =
  'A new version may have been deployed. Please refresh the page (F5 or Cmd+R) to load the latest version.';

const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Wraps a dynamic import with retries. Use for React.lazy() to reduce "Failed to fetch
 * dynamically imported module" on GitHub Pages when index.html is cached but chunk hashes changed.
 */
export function lazyWithRetry<T extends { default: ComponentType<unknown> }>(
  importFn: () => Promise<T>,
  retries = DEFAULT_RETRIES
) {
  return lazy(async () => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importFn();
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
    throw new Error(
      `${CHUNK_LOAD_ERROR_MESSAGE} (Original: ${lastError?.message ?? 'chunk load failed'})`
    );
  });
}
