import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CANONICAL_SKILL_DOCS = [
  'line-sticker-character-ref',
  'line-sticker-daily-factory',
  'line-sticker-maker',
  'line-sticker-phrase-design',
  'line-sticker-pipeline',
  'line-sticker-upload',
].map((name) => resolve(process.cwd(), '.claude/skills', name, 'SKILL.md'));

describe('LINE sticker skill paths', () => {
  it('does not reference the nonexistent .Codex skill path', () => {
    for (const path of CANONICAL_SKILL_DOCS) {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toContain('.Codex/skills');
    }
  });
});
