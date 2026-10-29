import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inspectInstalledSkills, updateInstalledSkill } from './manage-installed-skills.mts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return { ...original, rename: vi.fn(original.rename) };
});

describe('installed skill maintenance', () => {
  let root: string;
  let sourceRoot: string;
  let installedRoot: string;
  const skill = 'example-skill';
  const body = '---\nname: example-skill\ndescription: Test skill\n---\nNew instructions\n';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'installed-skills-'));
    sourceRoot = join(root, 'repo', 'skills');
    installedRoot = join(root, 'codex', 'skills');
    await mkdir(join(sourceRoot, skill), { recursive: true });
    await mkdir(join(installedRoot, skill), { recursive: true });
    await writeFile(join(sourceRoot, skill, 'SKILL.md'), body);
    await writeFile(join(installedRoot, skill, 'SKILL.md'), 'Old instructions');
  });

  afterEach(async () => {
    vi.mocked(rename).mockReset();
    vi.mocked(rename).mockImplementation(async (from, to) => {
      const original = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
      return original.rename(from, to);
    });
    await rm(root, { recursive: true, force: true });
  });

  async function fingerprint(): Promise<string> {
    const [report] = await inspectInstalledSkills({ sourceRoot, installedRoot, skill });
    return report.installedFingerprint!;
  }

  it('reports drift and missing optional skills without touching unrelated installations', async () => {
    await mkdir(join(sourceRoot, 'optional-skill'));
    await writeFile(join(sourceRoot, 'optional-skill', 'SKILL.md'), 'Optional');
    await mkdir(join(installedRoot, 'unrelated-skill'));
    await writeFile(join(installedRoot, 'unrelated-skill', '.env.local'), 'Do not read');
    const reports = await inspectInstalledSkills({ sourceRoot, installedRoot });
    expect(reports.map(({ skill: name, status }) => [name, status])).toEqual([
      [skill, 'drift'], ['optional-skill', 'missing'],
    ]);
    expect(reports[0].changedFiles).toEqual(['SKILL.md']);
    expect(reports[0].installedFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(join(installedRoot, skill, 'SKILL.md'), 'utf8')).toBe('Old instructions');
    expect(await readdir(join(root, 'codex'))).toEqual(['skills']);
  });

  it('updates exactly the inspected skill and saves the complete old installation outside discovery', async () => {
    await mkdir(join(installedRoot, skill, '__pycache__'));
    await writeFile(join(installedRoot, skill, '__pycache__', 'helper.pyc'), 'local cache');
    await writeFile(join(installedRoot, skill, 'local-note.txt'), 'local custom note');
    await mkdir(join(installedRoot, 'unrelated-skill'));
    await writeFile(join(installedRoot, 'unrelated-skill', 'SKILL.md'), 'Unchanged');
    const result = await updateInstalledSkill({
      sourceRoot, installedRoot, skill, expectedInstalledFingerprint: await fingerprint(),
    });
    expect(result.report.status).toBe('current');
    expect(result.backupPath).toContain(`${join(root, 'codex', 'skill-backups')}/`);
    expect(await readFile(join(result.backupPath!, 'SKILL.md'), 'utf8')).toBe('Old instructions');
    expect(await readFile(join(result.backupPath!, 'local-note.txt'), 'utf8')).toBe('local custom note');
    expect(await readFile(join(result.backupPath!, '__pycache__', 'helper.pyc'), 'utf8')).toBe('local cache');
    expect(await readFile(join(installedRoot, skill, 'SKILL.md'), 'utf8')).toBe(body);
    expect(await readFile(join(installedRoot, 'unrelated-skill', 'SKILL.md'), 'utf8')).toBe('Unchanged');
  });

  it('refuses stale fingerprints and missing installations instead of overwriting or creating them', async () => {
    const expectedInstalledFingerprint = await fingerprint();
    await writeFile(join(installedRoot, skill, 'SKILL.md'), 'New human edit');
    await expect(updateInstalledSkill({ sourceRoot, installedRoot, skill, expectedInstalledFingerprint }))
      .rejects.toThrow('changed or is missing');
    expect(await readFile(join(installedRoot, skill, 'SKILL.md'), 'utf8')).toBe('New human edit');
    await rm(join(installedRoot, skill), { recursive: true });
    await expect(updateInstalledSkill({ sourceRoot, installedRoot, skill, expectedInstalledFingerprint }))
      .rejects.toThrow('changed or is missing');
  });

  it('ignores cache contents for drift but refuses credentials even inside ignored caches', async () => {
    await writeFile(join(installedRoot, skill, 'SKILL.md'), body);
    await mkdir(join(installedRoot, skill, '__pycache__'));
    await writeFile(join(installedRoot, skill, '__pycache__', 'helper.pyc'), 'cache');
    expect((await inspectInstalledSkills({ sourceRoot, installedRoot, skill }))[0].status).toBe('current');
    await writeFile(join(installedRoot, skill, '__pycache__', 'credentials.env'), 'not opened');
    await expect(inspectInstalledSkills({ sourceRoot, installedRoot, skill })).rejects.toThrow('forbidden');
  });

  it('rejects root overlap, traversal, and symlinks', async () => {
    await expect(inspectInstalledSkills({ sourceRoot, installedRoot: sourceRoot })).rejects.toThrow('overlap');
    await expect(inspectInstalledSkills({ sourceRoot, installedRoot, skill: '../other' })).rejects.toThrow('Unknown');
    await symlink(join(sourceRoot, skill, 'SKILL.md'), join(installedRoot, skill, 'linked.md'));
    await expect(inspectInstalledSkills({ sourceRoot, installedRoot, skill })).rejects.toThrow('symlink');
    await rm(join(installedRoot, skill, 'linked.md'));
    const linkRoot = join(root, 'linked-skills');
    await symlink(installedRoot, linkRoot);
    await expect(inspectInstalledSkills({ sourceRoot, installedRoot: linkRoot })).rejects.toThrow('symlink');
  });

  it('restores the previous installation when publishing the staged copy fails', async () => {
    const original = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    vi.mocked(rename)
      .mockImplementationOnce(original.rename)
      .mockRejectedValueOnce(new Error('simulated publication failure'));
    await expect(updateInstalledSkill({
      sourceRoot, installedRoot, skill, expectedInstalledFingerprint: await fingerprint(),
    })).rejects.toThrow('simulated publication failure');
    expect(await readFile(join(installedRoot, skill, 'SKILL.md'), 'utf8')).toBe('Old instructions');
    expect(await readdir(join(root, 'codex'))).toEqual(['skill-backups', 'skills']);
    expect(await readdir(join(root, 'codex', 'skill-backups'))).toEqual([]);
  });

  it('reports an exact canonical package link without replacing or traversing it', async () => {
    await rm(join(installedRoot, skill), { recursive: true });
    await symlink(join(sourceRoot, skill), join(installedRoot, skill));
    const [report] = await inspectInstalledSkills({ sourceRoot, installedRoot, skill });
    expect(report.status).toBe('linked');
    expect(report.installedFingerprint).toBe(report.sourceFingerprint);
    expect(report.changedFiles).toEqual([]);
    await expect(updateInstalledSkill({
      sourceRoot, installedRoot, skill, expectedInstalledFingerprint: report.installedFingerprint!,
    })).rejects.toThrow('never replace symlinks');
    expect(await readdir(join(root, 'codex'))).toEqual(['skills']);
    expect(await readFile(join(sourceRoot, skill, 'SKILL.md'), 'utf8')).toBe(body);
  });

  it('refuses a package link to any different directory', async () => {
    const other = join(root, 'other-package');
    await mkdir(other);
    await writeFile(join(other, 'SKILL.md'), body);
    await rm(join(installedRoot, skill), { recursive: true });
    await symlink(other, join(installedRoot, skill));
    await expect(inspectInstalledSkills({ sourceRoot, installedRoot, skill }))
      .rejects.toThrow('outside its canonical package');
  });

  it('allows the exact environment example template but rejects real environment files with package context', async () => {
    await writeFile(join(sourceRoot, skill, '.env.example'), 'KEY=example');
    await writeFile(join(installedRoot, skill, '.env.example'), 'KEY=example');
    await writeFile(join(installedRoot, skill, 'SKILL.md'), body);
    expect((await inspectInstalledSkills({ sourceRoot, installedRoot, skill }))[0].status).toBe('current');
    await writeFile(join(installedRoot, skill, '.env.local'), 'not opened');
    await expect(inspectInstalledSkills({ sourceRoot, installedRoot, skill }))
      .rejects.toThrow(`forbidden credentials or state artifact in ${join(installedRoot, skill)}: .env.local`);
  });

  it('inspects all real repository skill sources against an empty optional installation', async () => {
    const emptyRoot = join(root, 'empty-installed');
    await mkdir(emptyRoot);
    const reports = await inspectInstalledSkills({ installedRoot: emptyRoot });
    expect(reports.length).toBeGreaterThanOrEqual(8);
    expect(reports.every((report) => report.status === 'missing')).toBe(true);
    expect(reports.find((report) => report.skill === 'line-sticker-upload')?.sourceFingerprint)
      .toMatch(/^[a-f0-9]{64}$/);
    expect(await readdir(emptyRoot)).toEqual([]);
  });

  it('handles an absent optional global root without creating it', async () => {
    const missingRoot = join(root, 'absent', 'codex', 'skills');
    const reports = await inspectInstalledSkills({ sourceRoot, installedRoot: missingRoot });
    expect(reports[0].status).toBe('missing');
    expect(await readdir(root)).not.toContain('absent');
  });
});
