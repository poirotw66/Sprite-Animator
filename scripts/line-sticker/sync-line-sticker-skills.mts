/**
 * Synchronize generated agent mirrors from the tracked canonical skills.
 *
 * Source of truth: skills/
 * Generated mirrors: .agents/skills/ and .claude/skills/
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_ROOT = resolve(ROOT, 'skills');
const TARGET_ROOTS = [
  resolve(ROOT, '.agents/skills'),
  resolve(ROOT, '.claude/skills'),
] as const;
const CHECK_ONLY = process.argv.includes('--check');

const SKILL_PACKAGES = [
  'line-sticker-character-ref',
  'line-sticker-daily-factory',
  'line-sticker-maker',
  'line-sticker-phrase-design',
  'line-sticker-pipeline',
  'line-sticker-upload',
  'shared',
] as const;

const FORBIDDEN_FILE_NAMES = new Set([
  '.env',
  'credentials.env',
  'gdrive_credentials.json',
  'gdrive_token.json',
]);

function assertDirectChild(root: string, target: string): void {
  const rel = relative(root, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || rel.includes(sep)) {
    throw new Error(`Refusing unsafe skill path: ${target}`);
  }
}

function isForbidden(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/');
  const parts = normalized.split('/');
  const fileName = parts.at(-1) ?? '';
  return (
    FORBIDDEN_FILE_NAMES.has(fileName) ||
    /^playwright_line_state(?:\.[^.]+)?\.json$/u.test(fileName) ||
    /^playwright_drive_state(?:\.[^.]+)?\.json$/u.test(fileName) ||
    fileName.endsWith('.pyc') ||
    parts.includes('__pycache__') ||
    parts.includes('debug_snapshots')
  );
}

async function listFiles(
  root: string,
  current = root,
  includeForbidden = false
): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, path, includeForbidden)));
    } else if (entry.isFile()) {
      const rel = relative(root, path).replaceAll('\\', '/');
      if (includeForbidden || !isForbidden(rel)) files.push(rel);
    }
  }
  return files.sort();
}

async function hashFile(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function assertSourceClean(source: string): Promise<void> {
  const forbidden = (await listFiles(source, source, true)).filter(isForbidden);
  if (forbidden.length > 0) {
    throw new Error(
      `Runtime secrets or generated artifacts found in canonical Skill ${relative(ROOT, source)}: ` +
        forbidden.join(', ')
    );
  }
}

async function directoriesMatch(source: string, target: string): Promise<boolean> {
  try {
    if (!(await stat(target)).isDirectory()) return false;
  } catch {
    return false;
  }
  const sourceFiles = await listFiles(source);
  const targetFiles = await listFiles(target, target, true);
  if (sourceFiles.join('\n') !== targetFiles.join('\n')) return false;
  for (const file of sourceFiles) {
    if ((await hashFile(resolve(source, file))) !== (await hashFile(resolve(target, file)))) {
      return false;
    }
  }
  return true;
}

async function copyFiltered(source: string, target: string): Promise<void> {
  for (const file of await listFiles(source)) {
    const destination = resolve(target, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(source, file), destination);
  }
}

async function main(): Promise<void> {
  const drifted: string[] = [];

  for (const skill of SKILL_PACKAGES) {
    await assertSourceClean(resolve(SOURCE_ROOT, skill));
  }

  for (const targetRoot of TARGET_ROOTS) {
    await mkdir(targetRoot, { recursive: true });
    for (const skill of SKILL_PACKAGES) {
      const source = resolve(SOURCE_ROOT, skill);
      const target = resolve(targetRoot, skill);
      assertDirectChild(SOURCE_ROOT, source);
      assertDirectChild(targetRoot, target);

      if (await directoriesMatch(source, target)) continue;
      const label = `${relative(ROOT, targetRoot)}/${skill}`;
      drifted.push(label);
      if (CHECK_ONLY) continue;

      await rm(target, { recursive: true, force: true });
      await mkdir(target, { recursive: true });
      await copyFiltered(source, target);
      console.log(`synced ${relative(ROOT, source)} -> ${relative(ROOT, target)}`);
    }
  }

  if (CHECK_ONLY && drifted.length > 0) {
    throw new Error(
      `LINE sticker skill mirrors are out of date: ${drifted.join(', ')}. ` +
        'Run npm run skills:sync:line-sticker.'
    );
  }

  console.log(
    drifted.length === 0
      ? 'LINE sticker skill mirrors are up to date.'
      : `Synchronized ${drifted.length} LINE sticker skill mirror package(s).`
  );
}

await main();
