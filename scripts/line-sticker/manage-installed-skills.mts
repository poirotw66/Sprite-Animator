/** Inspect optional global skill copies and update one reviewed installation. */
import { createHash } from 'node:crypto';
import {
  copyFile, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CliUsageError, cliBoolean, parseCliArgs, printCliHelp, reportCliError,
} from './cli.mts';
import { isForbidden, isIgnored } from './sync-line-sticker-skills.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = 'Usage: manage-installed-skills.mts [--skill <name>] [--installed-root <path>] [--update --expect-installed <sha256>]';

interface SkillSnapshot {
  fingerprint: string;
  files: Map<string, string>;
}

export interface InstalledSkillOptions {
  sourceRoot?: string;
  installedRoot?: string;
  skill?: string;
}

export interface InstalledSkillReport {
  skill: string;
  status: 'current' | 'linked' | 'drift' | 'missing';
  sourceFingerprint: string;
  installedFingerprint: string | null;
  changedFiles: string[];
}

export function defaultInstalledRoot(): string {
  return resolve(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills');
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function assertDirectory(path: string, optional = false): Promise<boolean> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`Expected a real directory, not a symlink: ${path}`);
    }
    return true;
  } catch (error) {
    if (optional && isMissing(error)) return false;
    throw error;
  }
}

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return !path || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}

async function physicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (!isMissing(error)) throw error;
    return resolve(await physicalPath(dirname(path)), basename(path));
  }
}

async function validateRoots(sourceRoot: string, installedRoot: string): Promise<void> {
  await assertDirectory(sourceRoot);
  await assertDirectory(installedRoot, true);
  const physicalSource = await realpath(sourceRoot);
  const physicalInstalled = await physicalPath(installedRoot);
  if (contains(physicalSource, physicalInstalled) || contains(physicalInstalled, physicalSource)) {
    throw new Error('Canonical and installed skill roots must not overlap');
  }
}

async function snapshotSkill(root: string): Promise<SkillSnapshot> {
  await assertDirectory(root);
  const files = new Map<string, string>();
  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      const name = relative(root, path).split(sep).join('/');
      if (entry.isSymbolicLink()) throw new Error(`Refusing symlink in skill ${root}: ${name}`);
      // Inspect names before opening files, including files beneath ignored caches.
      if (isForbidden(name) || (entry.name !== '.env.example' && /(^|\/)\.env(?:\.|$)/u.test(name))) {
        throw new Error(`Refusing forbidden credentials or state artifact in ${root}: ${name}`);
      }
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        if (!isIgnored(name)) {
          files.set(name, createHash('sha256').update(await readFile(path)).digest('hex'));
        }
      } else {
        throw new Error(`Refusing unsupported file type in skill ${root}: ${name}`);
      }
    }
  }
  await visit(root);
  const ordered = [...files].sort(([left], [right]) => left.localeCompare(right, 'en'));
  return {
    files: new Map(ordered),
    fingerprint: createHash('sha256').update(JSON.stringify(ordered)).digest('hex'),
  };
}

async function canonicalNames(sourceRoot: string): Promise<string[]> {
  const names: string[] = [];
  for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    if (entry.name === 'shared') {
      names.push(entry.name);
      continue;
    }
    try {
      const info = await lstat(join(sourceRoot, entry.name, 'SKILL.md'));
      if (info.isSymbolicLink()) throw new Error(`Refusing symlink: ${entry.name}/SKILL.md`);
      if (info.isFile()) names.push(entry.name);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  return names.sort();
}

function changedFiles(source: SkillSnapshot, installed: SkillSnapshot | null): string[] {
  return [...new Set([...source.files.keys(), ...(installed?.files.keys() ?? [])])]
    .filter((file) => source.files.get(file) !== installed?.files.get(file))
    .sort();
}

export async function inspectInstalledSkills(
  options: InstalledSkillOptions = {},
): Promise<InstalledSkillReport[]> {
  const sourceRoot = resolve(options.sourceRoot ?? join(ROOT, 'skills'));
  const installedRoot = resolve(options.installedRoot ?? defaultInstalledRoot());
  await validateRoots(sourceRoot, installedRoot);
  const names = await canonicalNames(sourceRoot);
  if (options.skill && !names.includes(options.skill)) {
    throw new CliUsageError(`Unknown canonical skill: ${options.skill}`);
  }
  const reports: InstalledSkillReport[] = [];
  for (const skill of options.skill ? [options.skill] : names) {
    const sourcePath = join(sourceRoot, skill);
    const source = await snapshotSkill(sourcePath);
    const installedPath = join(installedRoot, skill);
    let linked = false;
    try {
      if ((await lstat(installedPath)).isSymbolicLink()) {
        if (await realpath(installedPath) !== await realpath(sourcePath)) {
          throw new Error(`Refusing installed skill symlink outside its canonical package: ${skill}`);
        }
        linked = true;
      }
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    if (linked) {
      // Inspect canonical files only; never traverse or replace the installed link.
      reports.push({
        skill, status: 'linked', sourceFingerprint: source.fingerprint,
        installedFingerprint: source.fingerprint, changedFiles: [],
      });
      continue;
    }
    const present = await assertDirectory(installedPath, true);
    const installed = present ? await snapshotSkill(installedPath) : null;
    reports.push({
      skill,
      status: !installed ? 'missing' : installed.fingerprint === source.fingerprint ? 'current' : 'drift',
      sourceFingerprint: source.fingerprint,
      installedFingerprint: installed?.fingerprint ?? null,
      changedFiles: changedFiles(source, installed),
    });
  }
  return reports;
}

export async function updateInstalledSkill(
  options: InstalledSkillOptions & { skill: string; expectedInstalledFingerprint: string },
): Promise<{ backupPath: string | null; report: InstalledSkillReport }> {
  if (!/^[a-f0-9]{64}$/u.test(options.expectedInstalledFingerprint)) {
    throw new CliUsageError('--expect-installed must be the inspected SHA-256 fingerprint');
  }
  const [report] = await inspectInstalledSkills(options);
  if (report.status === 'linked') {
    throw new Error('Installed skill is linked to its canonical package; updates never replace symlinks');
  }
  if (report.installedFingerprint !== options.expectedInstalledFingerprint) {
    throw new Error('Installed skill changed or is missing; inspect it again before updating');
  }
  if (report.status === 'current') return { backupPath: null, report };

  const sourceRoot = resolve(options.sourceRoot ?? join(ROOT, 'skills'));
  const installedRoot = resolve(options.installedRoot ?? defaultInstalledRoot());
  const source = join(sourceRoot, options.skill);
  const target = join(installedRoot, options.skill);
  const backupRoot = join(dirname(installedRoot), 'skill-backups');
  await assertDirectory(backupRoot, true);
  await mkdir(backupRoot, { recursive: true });
  const physicalBackup = await realpath(backupRoot);
  if (contains(await realpath(sourceRoot), physicalBackup) || contains(await realpath(installedRoot), physicalBackup)) {
    throw new Error('Skill backups must be outside canonical and discoverable installed skills');
  }
  const stage = await mkdtemp(join(dirname(installedRoot), '.skill-update-'));
  let backupContainer: string | null = null;
  let backupPath: string | null = null;
  let movedOriginal = false;
  try {
    const snapshot = await snapshotSkill(source);
    for (const file of snapshot.files.keys()) {
      await mkdir(dirname(join(stage, file)), { recursive: true });
      await copyFile(join(source, file), join(stage, file));
    }
    const staged = await snapshotSkill(stage);
    const [latest] = await inspectInstalledSkills(options);
    if (staged.fingerprint !== report.sourceFingerprint || latest.sourceFingerprint !== report.sourceFingerprint) {
      throw new Error('Canonical skill changed while staging; inspect it again before updating');
    }
    if (latest.installedFingerprint !== options.expectedInstalledFingerprint) {
      throw new Error('Installed skill changed while staging; inspect it again before updating');
    }
    backupContainer = await mkdtemp(join(backupRoot, `${options.skill}-`));
    backupPath = join(backupContainer, options.skill);
    await rename(target, backupPath);
    movedOriginal = true;
    try {
      await rename(stage, target);
    } catch (error) {
      try {
        await rename(backupPath, target);
        movedOriginal = false;
      } catch {
        throw new Error(`Update failed; original installation remains recoverable at ${backupPath}`, { cause: error });
      }
      throw error;
    }
    const [updated] = await inspectInstalledSkills(options);
    return { backupPath, report: updated };
  } finally {
    await rm(stage, { recursive: true, force: true });
    if (!movedOriginal && backupContainer) await rm(backupContainer, { recursive: true, force: true });
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseCliArgs(argv, {
    values: ['skill', 'installed-root', 'expect-installed'],
    booleans: ['update', 'help'],
  });
  if (cliBoolean(args.help)) {
    printCliHelp(USAGE);
    return;
  }
  const options: InstalledSkillOptions = {
    ...(typeof args.skill === 'string' ? { skill: args.skill } : {}),
    ...(typeof args['installed-root'] === 'string'
      ? { installedRoot: resolve(ROOT, args['installed-root']) }
      : {}),
  };
  if (cliBoolean(args.update)) {
    if (!options.skill || typeof args['expect-installed'] !== 'string') {
      throw new CliUsageError('--update requires --skill and --expect-installed');
    }
    const result = await updateInstalledSkill({
      ...options, skill: options.skill, expectedInstalledFingerprint: args['expect-installed'],
    });
    console.log(`${result.report.skill}: ${result.report.status}`);
    if (result.backupPath) console.log(`Backup: ${result.backupPath}`);
    return;
  }
  if (args['expect-installed'] !== undefined) throw new CliUsageError('--expect-installed requires --update');
  const reports = await inspectInstalledSkills(options);
  for (const report of reports) {
    console.log(`${report.skill}: ${report.status}`);
    if (report.status === 'missing') continue;
    console.log(`  source:    ${report.sourceFingerprint}`);
    console.log(`  installed: ${report.installedFingerprint}`);
    for (const file of report.changedFiles) console.log(`  changed: ${file}`);
  }
  if (reports.some((report) => report.status === 'drift' || (options.skill && report.status === 'missing'))) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => reportCliError(error, USAGE));
}
