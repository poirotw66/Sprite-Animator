/**
 * Synchronize the runtime Codex skill mirror from the tracked canonical skills.
 *
 * Source of truth: .claude/skills
 * Generated runtime mirror: .agents/skills
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_ROOT = resolve(ROOT, '.claude/skills');
const TARGET_ROOT = resolve(ROOT, '.agents/skills');
const CHECK_ONLY = process.argv.includes('--check');

const LINE_STICKER_SKILLS = [
  'line-sticker-character-ref',
  'line-sticker-daily-factory',
  'line-sticker-maker',
  'line-sticker-phrase-design',
  'line-sticker-pipeline',
  'line-sticker-upload',
] as const;

function assertDirectChild(root: string, target: string): void {
  const rel = relative(root, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || rel.includes(sep)) {
    throw new Error(`Refusing unsafe skill path: ${target}`);
  }
}

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)));
    else if (entry.isFile()) files.push(relative(root, path).replaceAll('\\', '/'));
  }
  return files.sort();
}

async function hashFile(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function directoriesMatch(source: string, target: string): Promise<boolean> {
  try {
    if (!(await stat(target)).isDirectory()) return false;
  } catch {
    return false;
  }
  const sourceFiles = await listFiles(source);
  const targetFiles = await listFiles(target);
  if (sourceFiles.join('\n') !== targetFiles.join('\n')) return false;
  for (const file of sourceFiles) {
    if ((await hashFile(resolve(source, file))) !== (await hashFile(resolve(target, file)))) {
      return false;
    }
  }
  return true;
}

async function main(): Promise<void> {
  await mkdir(TARGET_ROOT, { recursive: true });
  const drifted: string[] = [];

  for (const skill of LINE_STICKER_SKILLS) {
    const source = resolve(SOURCE_ROOT, skill);
    const target = resolve(TARGET_ROOT, skill);
    assertDirectChild(SOURCE_ROOT, source);
    assertDirectChild(TARGET_ROOT, target);

    if (await directoriesMatch(source, target)) continue;
    drifted.push(skill);
    if (CHECK_ONLY) continue;

    // Targets are validated explicit children of .agents/skills above.
    await rm(target, { recursive: true, force: true });
    await cp(source, target, { recursive: true, force: true });
    console.log(`synced ${relative(ROOT, source)} -> ${relative(ROOT, target)}`);
  }

  if (CHECK_ONLY && drifted.length > 0) {
    throw new Error(
      `LINE sticker skill mirror is out of date: ${drifted.join(', ')}. Run npm run skills:sync:line-sticker.`
    );
  }

  console.log(
    drifted.length === 0
      ? 'LINE sticker skill mirror is up to date.'
      : `Synchronized ${drifted.length} LINE sticker skill(s).`
  );
}

await main();
