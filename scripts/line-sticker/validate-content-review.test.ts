import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { validateContentReview } from './validate-content-review.mts';

const roots: string[] = [];
const checks = () => Object.fromEntries(
  ['text', 'character', 'action', 'cropping'].map((name) => [name, { status: 'pass', observation: `${name} inspected at sticker size` }]),
);

async function fixture(count = 4) {
  const root = await mkdtemp(join(tmpdir(), 'content-review-'));
  roots.push(root);
  await mkdir(join(root, 'stickers'));
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffbbaa80' } }).png().toBuffer();
  const sha256 = createHash('sha256').update(png).digest('hex');
  await writeFile(join(root, 'reference.png'), png);
  const manifest = {
    completionStatus: 'completed',
    config: {
      ...(count === 4 ? { scope: 'single', cols: 2, rows: 2 } : { scope: 'set', stickerCount: count }),
      referenceImage: 'reference.png',
      customActionDescs: Array.from({ length: count }, (_, index) => `Wave ${index + 1}`),
    },
    stickers: Array.from({ length: count }, (_, index) => ({
      globalIndex: index + 1,
      file: `sheet-1/sticker-${String(index % 20 + 1).padStart(2, '0')}.png`,
      uploadFile: `stickers/sticker-${String(index + 1).padStart(2, '0')}.png`,
      phrase: index === 0 ? '' : `Phrase ${index + 1}`,
    })),
  };
  const review = {
    format: 'line-sticker-content-review', version: 1,
    references: [{ path: 'reference.png', sha256 }],
    stickers: manifest.stickers.map((sticker, index) => ({
      globalIndex: sticker.globalIndex, finalPath: sticker.uploadFile, sha256,
      phrase: sticker.phrase, actionDesc: manifest.config.customActionDescs[index],
      checks: checks() as Record<string, { status: string; observation: string }>,
      defects: [] as Array<{ check: string; description: string; state: string; acceptanceEvidence?: string }>,
    })),
  };
  await Promise.all(manifest.stickers.map((sticker) => writeFile(join(root, sticker.uploadFile), png)));
  const save = async () => {
    await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(root, 'content-review.json'), JSON.stringify(review));
  };
  await save();
  return { root, manifest, review, save, png };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('content review record validation', () => {
  it.each([4, 40, 48])('covers a configured %i-sticker output using final delivery mappings', async (count) => {
    const { root } = await fixture(count);
    const before = await readFile(join(root, 'manifest.json'));
    const result = await validateContentReview(root);
    expect(result).toMatchObject({ recordValid: true, reviewResolved: true, allChecksPass: true,
      expectedStickerCount: count, reviewedStickerCount: count, checkedStickerCount: count,
      scope: 'record-consistency-only' });
    expect(await readFile(join(root, 'manifest.json'))).toEqual(before);
  });

  it('detects changed final PNGs and changed reference identities', async () => {
    const { root } = await fixture();
    const changed = await sharp({ create: { width: 3, height: 2, channels: 4, background: '#99887780' } }).png().toBuffer();
    await writeFile(join(root, 'stickers/sticker-01.png'), changed);
    await writeFile(join(root, 'reference.png'), changed);
    const result = await validateContentReview(root);
    expect(result.reviewResolved).toBe(false);
    expect(result.errors).toContain('Sticker 1 final PNG hash is missing or stale');
    expect(result.errors).toContain('Reference 1 hash changed');
  });

  it('requires complete unique indices and paths, with no extra entries', async () => {
    const { root, review, save } = await fixture();
    review.stickers[3] = { ...review.stickers[0] };
    review.stickers.push({ ...review.stickers[1], globalIndex: 5 });
    await save();
    const result = await validateContentReview(root);
    expect(result.recordValid).toBe(false);
    expect(result.reviewedStickerCount).toBe(3);
    expect(result.errors).toContain('Duplicate review globalIndex 1');
    expect(result.errors).toContain('Missing review or manifest mapping for sticker 4');
    expect(result.unverifiedChecks).toBe(4);
  });

  it('does not infer missing review entries or manifest mappings from file count', async () => {
    const { root, manifest, review, save } = await fixture();
    manifest.stickers.pop();
    review.stickers.pop();
    await save();
    const result = await validateContentReview(root);
    expect(result.errors).toContain('Manifest must map all 4 configured stickers');
    expect(result.errors).toContain('Review must contain exactly 4 sticker entries');
    expect(result.reviewResolved).toBe(false);
  });

  it('compares expected phrases and actions, including intentionally empty captions', async () => {
    const { root, review, save } = await fixture();
    review.stickers[0].phrase = 'Invented caption';
    review.stickers[1].actionDesc = 'Different action';
    await save();
    const result = await validateContentReview(root);
    expect(result.errors).toContain('Sticker 1 phrase differs from the manifest or configured caption');
    expect(result.errors).toContain('Sticker 2 actionDesc differs from the configured action');
  });

  it('rejects contradictory action sources even when the review follows edited sticker metadata', async () => {
    const { root, manifest, review, save } = await fixture();
    Object.assign(manifest.stickers[0], { actionDesc: 'Dance instead' });
    review.stickers[0].actionDesc = 'Dance instead';
    await save();
    const result = await validateContentReview(root);
    expect(result.allChecksPass).toBe(false);
    expect(result.errors).toContain('Sticker 1 manifest actionDesc conflicts with the configured action');
    expect(result.errors).toContain('Sticker 1 actionDesc differs from the configured action');
  });

  it('uses configured captions, preserving intentionally empty captions, over contradictory metadata', async () => {
    const { root, manifest, review, save } = await fixture();
    Object.assign(manifest.config, { customPhrases: manifest.stickers.map((sticker) => sticker.phrase) });
    await save();
    expect((await validateContentReview(root)).allChecksPass).toBe(true);
    manifest.stickers[0].phrase = 'Invented caption';
    review.stickers[0].phrase = 'Invented caption';
    await save();
    const result = await validateContentReview(root);
    expect(result.allChecksPass).toBe(false);
    expect(result.errors).toContain('Sticker 1 manifest phrase conflicts with the configured caption');
    expect(result.errors).toContain('Sticker 1 phrase differs from the manifest or configured caption');
  });

  it('uses sticker action metadata only when the configured action is absent', async () => {
    const { root, manifest, save } = await fixture();
    manifest.stickers.forEach((sticker, index) => Object.assign(sticker, { actionDesc: manifest.config.customActionDescs[index] }));
    manifest.config.customActionDescs = [];
    await save();
    expect((await validateContentReview(root)).allChecksPass).toBe(true);
  });

  it('locates direct-maker references using an explicitly selected original config', async () => {
    const { root, manifest, review, save, png } = await fixture();
    const origin = await mkdtemp(join(tmpdir(), 'original-maker-config-'));
    roots.push(origin);
    const configPath = join(origin, 'job.config.json');
    await writeFile(configPath, JSON.stringify(manifest.config));
    await writeFile(join(origin, 'reference.png'), png);
    await rm(join(root, 'reference.png'));
    review.references[0].path = join(origin, 'reference.png');
    await save();
    expect((await validateContentReview(root)).reviewResolved).toBe(false);
    expect(await validateContentReview(root, undefined, configPath)).toMatchObject({
      recordValid: true, reviewResolved: true, allChecksPass: true,
    });
    const cli = JSON.parse(execFileSync('npx', ['tsx', resolve('scripts/line-sticker/validate-content-review.mts'),
      '--out', root, '--config', configPath], { encoding: 'utf8' }));
    expect(cli.allChecksPass).toBe(true);
  }, 15000);

  it('rejects a conflicting original config and keeps an unavailable origin unverified', async () => {
    const { root, manifest } = await fixture();
    const configPath = join(root, 'wrong.config.json');
    await writeFile(configPath, JSON.stringify({ ...manifest.config, referenceImage: 'unrelated.png' }));
    const wrong = await validateContentReview(root, undefined, configPath);
    expect(wrong.allChecksPass).toBe(false);
    expect(wrong.errors).toContain('Original config referenceImage differs from the manifest');
    const missing = await validateContentReview(root, undefined, join(root, 'missing.config.json'));
    expect(missing.recordValid).toBe(true);
    expect(missing.unverifiedSources).toContain('Original reference config is unavailable or invalid');
    expect(missing.reviewResolved).toBe(false);
  });

  it('keeps missing source actions unverified even when the review claims a pass', async () => {
    const { root, manifest, save } = await fixture();
    manifest.config.customActionDescs = [];
    await save();
    const result = await validateContentReview(root);
    expect(result.recordValid).toBe(true);
    expect(result.unverifiedSources).toHaveLength(4);
    expect(result.reviewResolved).toBe(false);
  });

  it('does not substitute a companion reference for an unavailable primary reference', async () => {
    const { root, manifest, save } = await fixture();
    Object.assign(manifest.config, { referenceImage: '', referenceImage2: 'reference.png' });
    await save();
    const result = await validateContentReview(root);
    expect(result.recordValid).toBe(true);
    expect(result.unverifiedSources).toContain('Missing configured primary character reference');
    expect(result.reviewResolved).toBe(false);
  });

  it('keeps an unavailable configured reference unverified', async () => {
    const { root } = await fixture();
    await rm(join(root, 'reference.png'));
    const result = await validateContentReview(root);
    expect(result.recordValid).toBe(true);
    expect(result.unverifiedSources).toContain('Reference 1 is unavailable or not a readable image');
    expect(result.checkedStickerCount).toBe(0);
    expect(result.reviewResolved).toBe(false);
  });

  it('rejects unknown statuses and observations missing evidence', async () => {
    const { root, review, save } = await fixture();
    review.stickers[0].checks.text.status = 'skipped';
    review.stickers[1].checks.action.observation = '';
    await save();
    const result = await validateContentReview(root);
    expect(result.recordValid).toBe(false);
    expect(result.unverifiedChecks).toBe(1);
    expect(result.checkedStickerCount).toBe(2);
  });

  it('keeps explicit unverified checks unresolved without misclassifying a well-formed record', async () => {
    const { root, review, save } = await fixture();
    review.stickers[0].checks.action = { status: 'unverified', observation: 'Reference action is unavailable' };
    await save();
    const result = await validateContentReview(root);
    expect(result).toMatchObject({ recordValid: true, reviewResolved: false, allChecksPass: false, unverifiedChecks: 1 });
  });

  it('preserves accepted failed checks and separates them from pending defects', async () => {
    const { root, review, save } = await fixture();
    review.stickers[0].checks.cropping.status = 'fail';
    review.stickers[0].defects.push({ check: 'cropping', description: 'Ear tip clipped', state: 'pending-acceptance' });
    await save();
    expect(await validateContentReview(root)).toMatchObject({ recordValid: true, reviewResolved: false,
      allChecksPass: false, failedChecks: 1, pendingDefects: 1, acceptedExceptions: 0 });
    review.stickers[0].defects[0] = { check: 'cropping', description: 'Ear tip clipped', state: 'accepted',
      acceptanceEvidence: 'User explicitly accepted sticker 1 clipped ear on 2026-10-30 in the task conversation.' };
    await save();
    expect(await validateContentReview(root)).toMatchObject({ recordValid: true, reviewResolved: true,
      allChecksPass: false, failedChecks: 1, pendingDefects: 0, acceptedExceptions: 1 });
  });

  it.each(['missing-defect', 'accepted-without-evidence', 'pass-with-defect'])('rejects inconsistent defect evidence: %s', async (kind) => {
    const { root, review, save } = await fixture();
    review.stickers[0].checks.text.status = kind === 'pass-with-defect' ? 'pass' : 'fail';
    if (kind !== 'missing-defect') review.stickers[0].defects.push({ check: 'text', description: 'Misspelling', state: 'accepted' });
    await save();
    expect((await validateContentReview(root)).recordValid).toBe(false);
  });

  it('rejects finalPath escape even when the referenced bytes match', async () => {
    const { root, review, save, png } = await fixture();
    const parent = await mkdtemp(join(tmpdir(), 'outside-review-'));
    roots.push(parent);
    await writeFile(join(parent, 'outside.png'), png);
    review.stickers[0].finalPath = join(parent, 'outside.png');
    await save();
    expect((await validateContentReview(root)).errors).toContain('Sticker 1 finalPath must match its output-relative manifest delivery PNG');
  });

  it('rejects symlinked delivery images and missing files', async () => {
    const { root, png } = await fixture();
    await writeFile(join(root, 'outside.png'), png);
    await rm(join(root, 'stickers/sticker-01.png'));
    await symlink(join(root, 'outside.png'), join(root, 'stickers/sticker-01.png'));
    await rm(join(root, 'stickers/sticker-02.png'));
    const result = await validateContentReview(root);
    expect(result.errors).toContain('Sticker 1 final PNG is missing, unsafe or unreadable');
    expect(result.errors).toContain('Sticker 2 final PNG is missing, unsafe or unreadable');
  });

  it('does not accept invalid JSON or a header-only PNG', async () => {
    const { root, png, review, save } = await fixture();
    const truncated = png.subarray(0, 33);
    await writeFile(join(root, 'stickers/sticker-01.png'), truncated);
    review.stickers[0].sha256 = createHash('sha256').update(truncated).digest('hex');
    await save();
    expect((await validateContentReview(root)).recordValid).toBe(false);
    await writeFile(join(root, 'content-review.json'), '{invalid');
    expect((await validateContentReview(root)).errors).toContain('Cannot read a regular manifest.json and valid content-review JSON object');
  });

  it('uses CLI exit 2 for usage errors and exit 1 for unresolved review records', async () => {
    const script = resolve('scripts/line-sticker/validate-content-review.mts');
    const { root, review, save } = await fixture();
    const good = JSON.parse(execFileSync('npx', ['tsx', script, '--out', root], { encoding: 'utf8' }));
    expect(good.allChecksPass).toBe(true);
    expect(spawnSync('npx', ['tsx', script], { encoding: 'utf8' }).status).toBe(2);
    review.stickers[0].checks.action.status = 'unverified';
    await save();
    const unresolved = spawnSync('npx', ['tsx', script, '--out', root], { encoding: 'utf8' });
    expect(unresolved.status).toBe(1);
    expect(JSON.parse(unresolved.stdout).reviewResolved).toBe(false);
  }, 15000);
});
