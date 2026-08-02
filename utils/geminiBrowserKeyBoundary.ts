/**
 * Resolve the only API-key value that may be supplied to the browser by Vite.
 *
 * A Gemini key is safe to use as a local development convenience only: every
 * production build must receive an empty value, even when its environment has
 * `GEMINI_API_KEY` or a public-looking `VITE_*` variable set.
 */
export function resolveLocalDevelopmentGeminiApiKey(
  command: 'serve' | 'build',
  env: { GEMINI_API_KEY?: string },
): string {
  if (command !== 'serve') {
    return '';
  }

  return env.GEMINI_API_KEY?.trim() ?? '';
}
