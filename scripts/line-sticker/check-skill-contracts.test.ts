import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkSkillContracts } from './check-skill-contracts.mts';

describe('skill documentation contracts', () => {
  let root: string;
  const phraseSet = (count: number) => ({
    format: 'line-sticker-phrase-set', version: 1, mode: 'set',
    phrases: Array.from({ length: count }, (_, index) => `Caption ${index + 1}`),
    actionDescs: Array.from({ length: count }, () => 'Wave one hand'),
  });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'skill-contracts-'));
    await mkdir(join(root, 'references'));
    await writeFile(join(root, 'references', 'guide.md'), 'Local reference');
    await writeFile(join(root, 'phrases.json'), JSON.stringify(phraseSet(40)));
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  const check = () => checkSkillContracts({
    root, markdownPaths: ['SKILL.md'], phraseExamplePaths: ['phrases.json'],
    importDocumentPaths: ['SKILL.md'],
  });

  it('checks local inline/reference links and actual importable input', async () => {
    await writeFile(join(root, 'SKILL.md'), '[Guide](references/guide.md#section)\n[ref]: references/guide.md\n[external](https://example.com/not-fetched)');
    expect(await check()).toEqual({ markdownFiles: 1, phraseExamples: 1, errors: [] });
  });

  it('reports broken local references and ignores code examples', async () => {
    await writeFile(join(root, 'SKILL.md'), '[Broken](references/missing.md)\n```md\n[Example](not-a-real-file.md)\n```\n`[inline example](also-not-real.md)`');
    const report = await check();
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain('references/missing.md');
  });

  it('handles encoded paths, angle-delimited paths and link titles', async () => {
    await writeFile(join(root, 'references', 'with space.md'), 'Reference');
    await writeFile(join(root, 'SKILL.md'), '[Encoded](references/with%20space.md "Guide")\n[Angle](<references/with space.md>)');
    expect((await check()).errors).toEqual([]);
  });

  it('reports undefined explicit references and resolves reference labels case-insensitively', async () => {
    await writeFile(join(root, 'SKILL.md'), '[Guide][missing]\n[Other][]\n[Known][ GUIDE ]\n[guide]: references/guide.md\nStandalone [words] are prose.');
    const report = await check();
    expect(report.errors).toHaveLength(2);
    expect(report.errors).toContainEqual(expect.stringContaining('missing'));
    expect(report.errors).toContainEqual(expect.stringContaining('Other'));
  });

  it('does not treat a linked job config as a phrase-set example', async () => {
    await writeFile(join(root, 'job.json'), JSON.stringify({ referenceImage: 'character.png' }));
    await writeFile(join(root, 'SKILL.md'), '[Job config](job.json)');
    expect((await check()).errors).toEqual([]);
  });

  it('rejects a syntactically valid phrase example with the wrong set size', async () => {
    await writeFile(join(root, 'SKILL.md'), '[Example](phrases.json)');
    await writeFile(join(root, 'phrases.json'), JSON.stringify(phraseSet(2)));
    expect((await check()).errors).toEqual([expect.stringContaining('rejected by the importer')]);
  });

  it('rejects an invalid complete JSON example embedded in importer docs', async () => {
    await writeFile(join(root, 'SKILL.md'), `\`\`\`json\n${JSON.stringify(phraseSet(2))}\n\`\`\``);
    expect((await check()).errors).toEqual([expect.stringContaining('block 1')]);
  });

  it('does not apply the importer size contract to conversational sheet plans', async () => {
    await writeFile(join(root, 'SKILL.md'), `\`\`\`json\n${JSON.stringify(phraseSet(20))}\n\`\`\``);
    const report = await checkSkillContracts({
      root, markdownPaths: ['SKILL.md'], phraseExamplePaths: [], importDocumentPaths: [],
    });
    expect(report.errors).toEqual([]);
  });

  it('validates the canonical repository documentation and production example', async () => {
    const report = await checkSkillContracts();
    expect(report.errors).toEqual([]);
    expect(report.markdownFiles).toBeGreaterThanOrEqual(8);
    expect(report.phraseExamples).toBeGreaterThanOrEqual(1);
  });
});
