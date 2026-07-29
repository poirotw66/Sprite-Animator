import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL_NAMES = [
  'line-sticker-character-ref',
  'line-sticker-daily-factory',
  'line-sticker-maker',
  'line-sticker-phrase-design',
  'line-sticker-pipeline',
  'line-sticker-upload',
];
const CANONICAL_SKILL_DOCS = SKILL_NAMES.map((name) =>
  resolve(process.cwd(), 'skills', name, 'SKILL.md')
);
const MIRROR_ROOTS = ['.agents/skills', '.claude/skills'];

describe('LINE sticker skill paths', () => {
  it('does not reference the nonexistent .Codex skill path', () => {
    for (const path of CANONICAL_SKILL_DOCS) {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toContain('.Codex/skills');
    }
  });

  it('keeps every relative Markdown link in canonical Skill docs valid', () => {
    for (const path of CANONICAL_SKILL_DOCS) {
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const href = match[1]!;
        if (/^(?:https?:|#)/.test(href)) continue;
        expect(existsSync(resolve(dirname(path), href)), `${path}: broken link ${href}`).toBe(true);
      }
    }
  });

  it('provides OpenAI UI metadata for every canonical Skill', () => {
    for (const name of SKILL_NAMES) {
      const metadata = resolve(process.cwd(), 'skills', name, 'agents/openai.yaml');
      expect(existsSync(metadata), `${name}: missing agents/openai.yaml`).toBe(true);
      expect(readFileSync(metadata, 'utf8')).toContain(`$${name}`);
    }
  });

  it('keeps both generated mirrors complete and free of runtime secrets', () => {
    const forbidden =
      /^(?:credentials\.env|gdrive_(?:credentials|token)\.json|playwright_(?:line|drive)_state.*\.json)$/;
    for (const mirrorRoot of MIRROR_ROOTS) {
      for (const name of SKILL_NAMES) {
        const skillRoot = resolve(process.cwd(), mirrorRoot, name);
        expect(existsSync(resolve(skillRoot, 'SKILL.md')), `${mirrorRoot}/${name}`).toBe(true);
        expect(existsSync(resolve(skillRoot, 'agents/openai.yaml')), `${mirrorRoot}/${name}`).toBe(
          true
        );
        const queue = [skillRoot];
        while (queue.length > 0) {
          const current = queue.pop()!;
          for (const entry of readdirSync(current, { withFileTypes: true })) {
            if (entry.isDirectory()) queue.push(resolve(current, entry.name));
            if (entry.isFile()) expect(entry.name).not.toMatch(forbidden);
          }
        }
      }
    }
  });
});
