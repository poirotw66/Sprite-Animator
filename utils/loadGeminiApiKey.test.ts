import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from '../skills/shared/loadGeminiApiKey.mts';

describe('shared Gemini API key loader', () => {
  it('resolves paths from the repository root', () => {
    expect(REPO_ROOT).toBe(resolve(process.cwd()));
  });
});
