/** Read-only consistency checks for agent-authored visual review records. */
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CliUsageError, cliBoolean, parseCliArgs, printCliHelp, reportCliError } from './cli.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = 'Usage: validate-content-review.mts --out <job-dir> [--review <review.json>] [--config <original-job.config.json>]';
const CHECKS = ['text', 'character', 'action', 'cropping'] as const;
const HASH = /^[a-f0-9]{64}$/u;
type ObjectValue = Record<string, unknown>;

export interface ContentReviewValidation {
  recordValid: boolean;
  reviewResolved: boolean;
  allChecksPass: boolean;
  expectedStickerCount: number;
  reviewedStickerCount: number;
  checkedStickerCount: number;
  failedChecks: number;
  unverifiedChecks: number;
  pendingDefects: number;
  acceptedExceptions: number;
  unverifiedSources: string[];
  errors: string[];
  scope: 'record-consistency-only';
}

function object(value: unknown): ObjectValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as ObjectValue : {};
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function jsonFile(path: string): Promise<ObjectValue> {
  const info = await lstat(path);
  if (!info.isFile()) throw new Error('not a regular file');
  return object(JSON.parse(await readFile(path, 'utf8')));
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

async function imageHash(path: string, pngOnly = false): Promise<string> {
  if (!(await lstat(path)).isFile()) throw new Error('not a regular image file');
  const bytes = await readFile(path);
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  if (pngOnly ? metadata.format !== 'png' : !['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) {
    throw new Error('unsupported image format');
  }
  // Decode pixels as well: a matching hash/header cannot validate a truncated PNG.
  await sharp(bytes, { failOn: 'error' }).raw().toBuffer();
  return hash(bytes);
}

/** Does not certify visual observations or authenticate recorded human acceptance. */
export async function validateContentReview(
  outputDir: string,
  reviewPath = resolve(outputDir, 'content-review.json'),
  originConfigPath?: string,
): Promise<ContentReviewValidation> {
  const result: ContentReviewValidation = {
    recordValid: false, reviewResolved: false, allChecksPass: false,
    expectedStickerCount: 0, reviewedStickerCount: 0, checkedStickerCount: 0,
    failedChecks: 0, unverifiedChecks: 0, pendingDefects: 0, acceptedExceptions: 0,
    unverifiedSources: [], errors: [], scope: 'record-consistency-only',
  };
  const error = (message: string): void => { result.errors.push(message); };
  let manifest: ObjectValue;
  let review: ObjectValue;
  let root: string;
  try {
    root = await realpath(outputDir);
    manifest = await jsonFile(resolve(root, 'manifest.json'));
    review = await jsonFile(reviewPath);
  } catch {
    error('Cannot read a regular manifest.json and valid content-review JSON object');
    return result;
  }
  if (review.format !== 'line-sticker-content-review' || review.version !== 1) {
    error('Expected line-sticker-content-review version 1');
  }
  const config = object(manifest.config);
  const cols = config.cols ?? 4;
  const rows = config.rows ?? 6;
  const count = config.scope === 'single'
    ? typeof cols === 'number' && typeof rows === 'number' &&
      Number.isInteger(cols) && Number.isInteger(rows) && cols >= 1 && cols <= 8 && rows >= 1 && rows <= 8
      ? cols * rows : NaN
    : config.stickerCount ?? 40;
  if (!Number.isInteger(count) || Number(count) < 1 || Number(count) > 64 ||
      (config.scope !== 'single' && count !== 40 && count !== 48)) {
    error('Manifest has an invalid configured sticker count');
    return result;
  }
  if (config.scope !== undefined && config.scope !== 'set' && config.scope !== 'single') {
    error('Manifest has an unsupported scope');
  }
  result.expectedStickerCount = Number(count);
  const manifestStickers = Array.isArray(manifest.stickers) ? manifest.stickers.map(object) : [];
  if (manifestStickers.length !== count) error(`Manifest must map all ${count} configured stickers`);

  const references = Array.isArray(review.references) ? review.references.map(object) : [];
  const configuredReferences = [config.referenceImage, config.referenceImage2].filter(text);
  let referenceBase = root;
  let originAvailable = true;
  if (originConfigPath) {
    try {
      const origin = await jsonFile(originConfigPath);
      for (const field of ['referenceImage', 'referenceImage2']) {
        if (origin[field] !== config[field]) {
          error(`Original config ${field} differs from the manifest`);
          originAvailable = false;
        }
      }
      referenceBase = dirname(resolve(originConfigPath));
    } catch {
      result.unverifiedSources.push('Original reference config is unavailable or invalid');
      originAvailable = false;
    }
  }
  if (!text(config.referenceImage)) result.unverifiedSources.push('Missing configured primary character reference');
  if (references.length !== configuredReferences.length) error('Reference evidence does not cover configured references');
  for (let index = 0; index < configuredReferences.length; index++) {
    if (!originAvailable) continue;
    const expected = resolve(referenceBase, configuredReferences[index]);
    const evidence = references[index] ?? {};
    if (!text(evidence.path) || resolve(root, evidence.path) !== expected ||
        !text(evidence.sha256) || !HASH.test(evidence.sha256)) {
      error(`Reference ${index + 1} path/hash does not match the configured reference`);
      continue;
    }
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extname(expected).toLowerCase())) {
      error(`Reference ${index + 1} must identify an image`);
      continue;
    }
    try {
      if (await imageHash(expected) !== evidence.sha256) error(`Reference ${index + 1} hash changed`);
    } catch {
      result.unverifiedSources.push(`Reference ${index + 1} is unavailable or not a readable image`);
    }
  }
  const referencesCurrent = result.errors.length === 0 && result.unverifiedSources.length === 0;

  const entries = Array.isArray(review.stickers) ? review.stickers.map(object) : [];
  if (entries.length !== count) error(`Review must contain exactly ${count} sticker entries`);
  const byIndex = new Map<number, ObjectValue>();
  const paths = new Set<string>();
  for (const entry of entries) {
    const index = entry.globalIndex;
    if (!Number.isInteger(index) || Number(index) < 1 || Number(index) > Number(count)) {
      error('Review contains an out-of-range globalIndex');
    } else if (byIndex.has(Number(index))) {
      error(`Duplicate review globalIndex ${index}`);
    } else {
      byIndex.set(Number(index), entry);
    }
    if (text(entry.finalPath)) {
      const path = resolve(root, entry.finalPath);
      if (paths.has(path)) error(`Duplicate finalPath for sticker ${index}`);
      paths.add(path);
    }
  }
  result.reviewedStickerCount = byIndex.size;
  const manifestByIndex = new Map<number, ObjectValue>();
  for (const sticker of manifestStickers) {
    const index = sticker.globalIndex;
    if (!Number.isInteger(index) || Number(index) < 1 || Number(index) > Number(count) ||
        manifestByIndex.has(Number(index))) {
      error('Manifest contains duplicate or out-of-range globalIndex');
    } else manifestByIndex.set(Number(index), sticker);
  }
  const actions = Array.isArray(config.customActionDescs) ? config.customActionDescs : [];
  const phrases = Array.isArray(config.customPhrases) ? config.customPhrases : [];
  for (let index = 1; index <= Number(count); index++) {
    const entry = byIndex.get(index);
    const expected = manifestByIndex.get(index);
    if (!entry || !expected) {
      error(`Missing review or manifest mapping for sticker ${index}`);
      result.unverifiedChecks += CHECKS.length;
      continue;
    }
    const label = `Sticker ${index}`;
    const errorsBeforeEntry = result.errors.length;
    const sourcesBeforeEntry = result.unverifiedSources.length;
    const expectedPath = `stickers/sticker-${String(index).padStart(2, '0')}.png`;
    if (expected.uploadFile !== expectedPath) error(`${label} manifest delivery path is not ${expectedPath}`);
    const finalPath = text(entry.finalPath) ? resolve(root, entry.finalPath) : '';
    if (!finalPath || isAbsolute(String(entry.finalPath)) || !inside(root, finalPath) ||
        finalPath !== resolve(root, expectedPath)) {
      error(`${label} finalPath must match its output-relative manifest delivery PNG`);
    } else {
      try {
        if (!inside(root, await realpath(finalPath))) throw new Error('path escapes output');
        const actualHash = await imageHash(finalPath, true);
        if (!text(entry.sha256) || !HASH.test(entry.sha256) || actualHash !== entry.sha256) {
          error(`${label} final PNG hash is missing or stale`);
        }
      } catch {
        error(`${label} final PNG is missing, unsafe or unreadable`);
      }
    }
    if (typeof entry.phrase !== 'string' || typeof entry.actionDesc !== 'string') {
      error(`${label} requires string phrase and actionDesc fields`);
    }
    const expectedPhrase = index - 1 in phrases ? phrases[index - 1] : expected.phrase;
    if (index - 1 in phrases && expected.phrase !== expectedPhrase) {
      error(`${label} manifest phrase conflicts with the configured caption`);
    }
    if (typeof expectedPhrase !== 'string') result.unverifiedSources.push(`${label} expected phrase is unavailable`);
    else if (entry.phrase !== expectedPhrase) error(`${label} phrase differs from the manifest or configured caption`);
    const expectedAction = index - 1 in actions ? actions[index - 1] : expected.actionDesc;
    if (index - 1 in actions && typeof expected.actionDesc === 'string' && expected.actionDesc !== expectedAction) {
      error(`${label} manifest actionDesc conflicts with the configured action`);
    }
    if (typeof expectedAction !== 'string' || !expectedAction.trim()) {
      result.unverifiedSources.push(`${label} expected action is unavailable`);
    } else if (entry.actionDesc !== expectedAction) error(`${label} actionDesc differs from the configured action`);

    const checks = object(entry.checks);
    const defects = Array.isArray(entry.defects) ? entry.defects.map(object) : [];
    if (!Array.isArray(entry.defects)) error(`${label} must include a defects array`);
    let fullyChecked = true;
    for (const name of CHECKS) {
      const check = object(checks[name]);
      const status = check.status;
      if (!['pass', 'fail', 'unverified'].includes(String(status)) || !text(check.observation)) {
        error(`${label} ${name} requires a valid status and observation`);
        fullyChecked = false;
      }
      if (status === 'fail') result.failedChecks++;
      if (status !== 'pass' && status !== 'fail') {
        result.unverifiedChecks++;
        fullyChecked = false;
      }
      const matchingDefects = defects.filter((defect) => defect.check === name);
      if (status === 'fail' && matchingDefects.length === 0) error(`${label} failed ${name} has no defect record`);
      if (status !== 'fail' && matchingDefects.length > 0) error(`${label} ${name} has defects without a failed check`);
    }
    for (const defect of defects) {
      if (!CHECKS.includes(defect.check as typeof CHECKS[number]) || !text(defect.description)) {
        error(`${label} defect requires a known check and description`);
      }
      if (defect.state === 'accepted') {
        if (!text(defect.acceptanceEvidence)) error(`${label} accepted defect lacks explicit acceptance evidence`);
        result.acceptedExceptions++;
      } else if (defect.state === 'pending-acceptance') result.pendingDefects++;
      else error(`${label} defect has an invalid state`);
    }
    if (fullyChecked && referencesCurrent && result.errors.length === errorsBeforeEntry &&
        result.unverifiedSources.length === sourcesBeforeEntry) result.checkedStickerCount++;
  }
  result.recordValid = result.errors.length === 0;
  result.reviewResolved = result.recordValid && result.unverifiedSources.length === 0 &&
    result.unverifiedChecks === 0 && result.pendingDefects === 0;
  result.allChecksPass = result.reviewResolved && result.failedChecks === 0;
  return result;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseCliArgs(argv, { values: ['out', 'review', 'config'], booleans: ['help'] });
  if (cliBoolean(args.help)) return printCliHelp(USAGE);
  if (!text(args.out)) throw new CliUsageError('Missing --out <job-dir>');
  const out = resolve(ROOT, args.out);
  const report = await validateContentReview(out,
    text(args.review) ? resolve(ROOT, args.review) : undefined,
    text(args.config) ? resolve(ROOT, args.config) : undefined);
  console.log(JSON.stringify(report, null, 2));
  if (!report.reviewResolved) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { reportCliError(error, USAGE); }
}
