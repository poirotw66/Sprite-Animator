import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertSourceClean, directoriesMatch } from './sync-line-sticker-skills.mts';

describe('skill mirror policy', () => {
  let root: string;
  let source: string;
  let target: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'skill-sync-'));
    source = join(root, 'source');
    target = join(root, 'target');
    await Promise.all([mkdir(source), mkdir(target)]);
    await Promise.all([
      writeFile(join(source, 'SKILL.md'), 'canonical'),
      writeFile(join(target, 'SKILL.md'), 'canonical'),
    ]);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('ignores Python caches in canonical source and runtime mirrors', async () => {
    await mkdir(join(source, '__pycache__'));
    await writeFile(join(source, '__pycache__', 'helper.cpython-312.pyc'), 'cache');
    await writeFile(join(target, 'helper.pyo'), 'cache');
    await expect(assertSourceClean(source)).resolves.toBeUndefined();
    await expect(directoriesMatch(source, target)).resolves.toBe(true);
  });

  it.each(['credentials.env', 'gdrive_token.json', 'playwright_line_state.w1.json'])(
    'blocks canonical credentials or sessions: %s', async (name) => {
      await writeFile(join(source, name), 'fixture');
      await expect(assertSourceClean(source)).rejects.toThrow(name);
    },
  );

  it('detects forbidden files in mirrors even when content matches', async () => {
    await writeFile(join(target, 'gdrive_credentials.json'), 'fixture');
    await expect(directoriesMatch(source, target)).resolves.toBe(false);
  });

  it('does not allow cache directories to hide credentials', async () => {
    await mkdir(join(source, '__pycache__'));
    await writeFile(join(source, '__pycache__', 'credentials.env'), 'fixture');
    await expect(assertSourceClean(source)).rejects.toThrow('credentials.env');
  });

  it('detects stale content and extra non-cache files', async () => {
    await writeFile(join(target, 'SKILL.md'), 'outdated');
    await expect(directoriesMatch(source, target)).resolves.toBe(false);
    await writeFile(join(target, 'SKILL.md'), 'canonical');
    await writeFile(join(target, 'obsolete.py'), 'obsolete');
    await expect(directoriesMatch(source, target)).resolves.toBe(false);
  });
});
