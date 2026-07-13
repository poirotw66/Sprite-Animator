/**
 * Generate one sticker set then run full LINE upload pipeline.
 *
 * Usage: npx tsx run-generate-and-upload.mts --config examples/demo-job.config.json --out output/my-set
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { ensureBatchEnvReady, parseEnv } from './uploadCredentials.mts';
import { resolveUploadConfig } from './uploadConfig.mts';
import { assertOutDirGridGate } from './manifestGridGate.mts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../../../..');

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
  const result = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(' ')} exited with ${result.status ?? 'unknown'}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const config = args.config;
const out = args.out;
if (!config || !out) {
  console.error('Usage: run-generate-and-upload.mts --config <job.json> --out <output-dir>');
  process.exit(1);
}

const configPath = resolve(ROOT, config);
const outDir = resolve(ROOT, out);
const job = JSON.parse(await readFile(configPath, 'utf8'));
const upload = resolveUploadConfig(job);
if (!upload?.setName) {
  throw new Error('Job config must include upload.setName');
}

const envBase = upload.setName.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
const batchPath = resolve(outDir, `.env.batch/${envBase}.env`);

console.log(`\n========== ${upload.setName} ==========\n`);
console.log('▶ generate...');
run('npx', ['tsx', '.claude/skills/line-sticker-maker/scripts/generate.mts', '--config', config, '--out', out]);

await assertOutDirGridGate(outDir);
await ensureBatchEnvReady(batchPath);

const envRel = `${out.replace(/\\/g, '/')}/.env.batch/${envBase}.env`;
const submitArg = job.lineUploadSubmit === true ? 'true' : 'false';
console.log('\n▶ upload (gdrive → provision → zip → optional submit)...');
run('npx', [
  'tsx',
  '.claude/skills/line-sticker-maker/scripts/run-line-upload.mts',
  '--env',
  envRel,
  '--submit',
  submitArg,
]);

const final = parseEnv(await readFile(batchPath, 'utf8'));
console.log(`\n✓ Done: ${upload.setName}`);
console.log(`  LINE_STICKER_ID=${final.LINE_STICKER_ID}`);
if (final.LINE_CREATOR_ID && final.LINE_STICKER_ID) {
  console.log(`  PROJECT_URL=https://creator.line.me/my/${final.LINE_CREATOR_ID}/sticker/${final.LINE_STICKER_ID}`);
}
if (final.GDRIVE_SHARE_URL) console.log(`  DRIVE=${final.GDRIVE_SHARE_URL}`);
