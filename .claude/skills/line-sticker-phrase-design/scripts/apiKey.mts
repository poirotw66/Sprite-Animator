/**
 * Load GEMINI_API_KEY: env var > repo .env > repo .env.local
 */

export { loadGeminiApiKey as loadApiKey, REPO_ROOT as ROOT_DIR } from '../../shared/loadGeminiApiKey.mts';
