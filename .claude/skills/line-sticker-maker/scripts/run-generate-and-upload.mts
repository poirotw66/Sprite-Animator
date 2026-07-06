/**

 * Generate one sticker set then run full LINE upload pipeline.

 * Usage: npx tsx run-generate-and-upload.mts --config example/p8-job.config.json --out example/output/p8

 */



import { readFile } from 'node:fs/promises';

import { resolve, dirname } from 'node:path';

import { fileURLToPath } from 'node:url';

import { spawnSync } from 'node:child_process';



import { mergeCredentialsIntoBatch, parseEnv } from './uploadCredentials.mts';
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

const job = JSON.parse(await readFile(configPath, 'utf8')) as { lineS: { setName: string } };

const envBase = job.lineS.setName.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

const batchPath = resolve(outDir, `.env.batch/${envBase}.env`);



console.log(`\n========== ${job.lineS.setName} ==========\n`);

console.log('▶ generate...');

run('npx', ['tsx', '.claude/skills/line-sticker-maker/scripts/generate.mts', '--config', config, '--out', out]);

await assertOutDirGridGate(outDir);



await mergeCredentialsIntoBatch(batchPath, job.lineS.setName);



const envRel = `${out.replace(/\\/g, '/')}/.env.batch/${envBase}.env`;

console.log('\n▶ upload (gdrive → provision → zip → submit)...');

run('npx', ['tsx', '.claude/skills/line-sticker-maker/scripts/run-line-upload.mts', '--env', envRel]);



const final = parseEnv(await readFile(batchPath, 'utf8'));

console.log(`\n✓ Done: ${job.lineS.setName}`);

console.log(`  LINE_STICKER_ID=${final.LINE_STICKER_ID}`);

console.log(`  PROJECT_URL=https://creator.line.me/my/${final.LINE_CREATOR_ID}/sticker/${final.LINE_STICKER_ID}`);

if (final.GDRIVE_SHARE_URL) console.log(`  DRIVE=${final.GDRIVE_SHARE_URL}`);

