/**
 * Resume vault LINE uploads with optional parallel workers (isolated Playwright sessions).
 *
 *   npx tsx vault-upload-continue.mts --from 4 --to 13 --parallel 3
 */

import { copyFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { parseEnv } from './uploadCredentials.mts';

const ROOT = resolve(import.meta.dirname, '../../../..');
const RUN_UPLOAD = resolve(import.meta.dirname, 'run-line-upload.mts');
const UPLOAD_SCRIPTS = resolve(ROOT, '.claude/skills/line-sticker-upload/scripts');
const MASTER_PLAYWRIGHT = resolve(UPLOAD_SCRIPTS, 'playwright_line_state.json');

type UploadStep = 'all' | 'provision' | 'zip' | 'submit';

interface UploadJob {
  id: string;
  envRel: string;
  steps: UploadStep[];
}

function parseArgs(argv: string[]): { from: number; to: number; parallel: number } {
  let from = 1;
  let to = 30;
  let parallel = 1;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--from' && argv[i + 1]) from = Number(argv[++i]);
    if (token === '--to' && argv[i + 1]) to = Number(argv[++i]);
    if (token === '--parallel' && argv[i + 1]) parallel = Math.max(1, Number(argv[++i]));
  }
  return { from, to, parallel };
}

function workerPlaywrightState(workerId: number): string {
  return resolve(UPLOAD_SCRIPTS, `playwright_line_state.w${workerId}.json`);
}

function ensureWorkerPlaywrightState(workerId: number): void {
  const target = workerPlaywrightState(workerId);
  if (existsSync(MASTER_PLAYWRIGHT)) {
    copyFileSync(MASTER_PLAYWRIGHT, target);
  }
}

function runUpload(envRel: string, step: UploadStep, workerId: number): Promise<number> {
  ensureWorkerPlaywrightState(workerId);
  return new Promise((resolveExit) => {
    const child = spawn(
      'npx',
      ['tsx', RUN_UPLOAD, '--env', envRel, '--step', step],
      {
        cwd: ROOT,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          LINE_PLAYWRIGHT_STATE: workerPlaywrightState(workerId),
        },
      }
    );
    child.on('close', (code) => resolveExit(code ?? 1));
    child.on('error', () => resolveExit(1));
  });
}

async function runJob(job: UploadJob, workerId: number): Promise<boolean> {
  console.log(`\n[worker ${workerId}] ▶ ${job.id} (${job.steps.join(' → ')})`);
  for (const step of job.steps) {
    const code = await runUpload(job.envRel, step, workerId);
    if (code !== 0) {
      console.error(`[worker ${workerId}] ✗ ${job.id} failed at ${step}`);
      return false;
    }
  }
  console.log(`[worker ${workerId}] ✓ ${job.id} complete`);
  return true;
}

function buildJobs(from: number, to: number): UploadJob[] {
  const jobs: UploadJob[] = [];
  for (let n = from; n <= to; n++) {
    const id = `SET-20260712-${String(n).padStart(3, '0')}`;
    const dir = resolve(ROOT, 'output/vault-production', id);
    const envDir = resolve(dir, '.env.batch');
    if (!existsSync(envDir)) {
      console.warn(`skip ${id}: no .env.batch`);
      continue;
    }
    const envFile = readdirSync(envDir).find((name) => name.endsWith('.env'));
    if (!envFile) {
      console.warn(`skip ${id}: no env file`);
      continue;
    }
    const envRel = `output/vault-production/${id}/.env.batch/${envFile}`;
    const env = parseEnv(readFileSync(resolve(envDir, envFile), 'utf8'));
    const steps: UploadStep[] = env.LINE_STICKER_ID?.trim()
      ? ['zip', 'submit']
      : env.GDRIVE_FOLDER_ID?.trim()
        ? ['provision', 'zip', 'submit']
        : ['all'];
    jobs.push({ id, envRel, steps });
  }
  return jobs;
}

async function runPool(jobs: UploadJob[], parallel: number): Promise<void> {
  let next = 0;
  let ok = 0;
  let failed = 0;

  async function worker(workerId: number): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= jobs.length) return;
      const success = await runJob(jobs[index]!, workerId);
      if (success) ok += 1;
      else failed += 1;
    }
  }

  const workers = Array.from({ length: Math.min(parallel, jobs.length) }, (_, i) =>
    worker(i + 1)
  );
  await Promise.all(workers);
  console.log(`\nBatch done: ${ok} ok, ${failed} failed, ${jobs.length} total`);
  if (failed > 0) process.exit(1);
}

const { from, to, parallel } = parseArgs(process.argv.slice(2));
const jobs = buildJobs(from, to);
if (jobs.length === 0) {
  console.log('No upload jobs in range.');
  process.exit(0);
}
console.log(`Upload ${jobs.length} set(s), parallel=${parallel}`);
await runPool(jobs, parallel);
