/**
 * Generate + upload multiple sticker jobs from a batch manifest.
 *
 *   npx tsx run-batch-jobs.mts --manifest output/example/p3-p10-batch.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../../../..');

interface BatchJob {
  out: string;
  referenceImage: string;
  setName: string;
  titleZh: string;
  descZh: string;
  titleEn: string;
  descEn: string;
  characterDescription: string;
}

interface BatchManifest {
  phraseSetFile: string;
  lineUploadSubmit?: boolean;
  jobs: BatchJob[];
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function run(cmd: string, cmdArgs: string[]): void {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(' ')} exited with ${result.status ?? 'unknown'}`);
  }
}

function slugSetName(name: string): string {
  return name.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function buildJobConfig(manifest: BatchManifest, job: BatchJob): Record<string, unknown> {
  return {
    referenceImage: job.referenceImage,
    phraseSetFile: manifest.phraseSetFile,
    characterDescription: job.characterDescription,
    style: 'matchUploaded',
    language: 'en',
    chromaKeyColor: 'green',
    includeText: true,
    textRendering: 'model',
    scope: 'set',
    stickerCount: 40,
    model: 'gemini-3.1-flash-image',
    resolution: '1K',
    lineUpload: true,
    lineUploadSubmit: manifest.lineUploadSubmit !== false,
    mainStickerIndex: 1,
    tabStickerIndex: 1,
    maxSheetRetries: 3,
    extraSheetRegenAttempts: 3,
    promptVersion: 'v3compact',
    gridTemplate: 'guided',
    lineS: {
      syncToLineS: true,
      creatorId: '706',
      setName: job.setName,
      titleZh: job.titleZh,
      descZh: job.descZh,
      titleEn: job.titleEn,
      descEn: job.descEn,
    },
  };
}

const args = parseArgs(process.argv.slice(2));
const manifestPath = args.manifest;
if (!manifestPath) {
  console.error('Usage: run-batch-jobs.mts --manifest <batch.json> [--auto true]');
  process.exit(1);
}

const manifestAbs = resolve(ROOT, manifestPath);
const manifestDir = dirname(manifestAbs);
const manifest = JSON.parse(await readFile(manifestAbs, 'utf8')) as BatchManifest;
const runAuto = args.auto !== 'false';
const submitArg = manifest.lineUploadSubmit === false ? 'false' : 'true';

for (const job of manifest.jobs) {
  const outDir = resolve(manifestDir, job.out);
  const configPath = resolve(manifestDir, `${job.out}-job.config.json`);
  const config = buildJobConfig(manifest, job);
  await mkdir(outDir, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  const configRel = relative(ROOT, configPath).replace(/\\/g, '/');
  const outRel = relative(ROOT, outDir).replace(/\\/g, '/');

  console.log(`\n========== ${job.setName} (${job.referenceImage} → ${job.out}) ==========\n`);
  run('npx', ['tsx', '.claude/skills/line-sticker-maker/scripts/generate.mts', '--config', configRel, '--out', outRel]);

  const envRel = `${outRel}/.env.batch/${slugSetName(job.setName)}.env`;
  const uploadArgs = [
    'tsx',
    '.claude/skills/line-sticker-maker/scripts/run-line-upload.mts',
    '--env',
    envRel,
    '--submit',
    submitArg,
  ];
  if (runAuto) uploadArgs.push('--auto', 'true');
  run('npx', uploadArgs);
}

console.log(`\n✓ Batch complete (${manifest.jobs.length} jobs).`);
