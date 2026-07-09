/**
 * Gemini service — public API.
 * Implementation is split into services/gemini/* for maintainability.
 */

export type { ProgressCallback } from './gemini/types';
export { API_KEY_MISSING_MESSAGE } from './gemini/types';

export { generateStickerPhrases } from './gemini/stickerPhrases';
export { generateActionDescriptions } from './gemini/actionDescriptions';
export { generateSpriteSheet } from './gemini/spriteSheet';
export { generateAnimationFrames } from './gemini/animationFrames';
export { generateComicCharacterSheet, resolveComicStyleBlock } from './gemini/comicCharacterSheet';
export { generateComicStoryboard, parseComicStoryboardJson } from './gemini/comicStoryboard';
export { generateComicPage } from './gemini/comicPage';
export { buildComicPagePrompt } from './gemini/comicPagePrompt';
