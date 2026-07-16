/**
 * Run the repo-local upload pipeline (Drive → provision → ZIP → optional submit).
 *
 *   npx tsx run-line-upload.mts --env output/p4/.env.batch/Cozy_Cream_Cat_Daily_Chat.env
 *   npx tsx run-line-upload.mts --env ... --step gdrive
 *   npx tsx run-line-upload.mts --env ... --step provision|zip|submit|all
 *   npx tsx run-line-upload.mts --env ... --interactive true
 *   npx tsx run-line-upload.mts --env ... --submit false
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assertOutDirGridGate } from './manifestGridGate.mts';
import { ensureBatchEnvReady, parseEnv } from './uploadCredentials.mts';
import {
  resolvePipelineSteps,
  resolveSubmitEnabled,
  resolveUploadStepsFromEnv,
  type UploadStepName,
} from './uploadPipeline.mts';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const UPLOAD_SKILL_ROOT = resolve(PROJECT_ROOT, '.claude/skills/line-sticker-upload');
const UPLOAD_SCRIPTS = resolve(UPLOAD_SKILL_ROOT, 'scripts');

type UploadStep = UploadStepName | 'all';

const STEP_SCRIPTS: Record<UploadStepName, string> = {
  gdrive: 'upload_gdrive.py',
  provision: 'provision_line_sticker.py',
  zip: 'upload_line_zip.py',
  submit: 'submit_line_review.py',
};

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

function runPython(script: string, envPath: string, extraArgs: string[] = []): void {
  const scriptPath = resolve(UPLOAD_SCRIPTS, script);
  if (!existsSync(scriptPath)) {
    throw new Error(`Missing upload script: ${scriptPath}`);
  }
  const baseArgs = [scriptPath, '--env', envPath];
  if (script === 'upload_gdrive.py') {
    baseArgs.push('--project-root', PROJECT_ROOT);
  }
  const result = spawnSync('python', [...baseArgs, ...extraArgs], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
    },
  });
  if (result.status !== 0) {
    throw new Error(`${script} exited with code ${result.status ?? 'unknown'}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const envFile = args.env ?? '';
const step = (args.step ?? 'all') as UploadStep;
const skipGridGate = args['skip-grid-gate'] === 'true';

if (!envFile) {
  console.error(
    'Usage: run-line-upload.mts --env output/pX/.env.batch/Set_Name.env [--step gdrive|provision|zip|submit|all] [--submit true|false] [--workers N] [--interactive true]'
  );
  process.exit(1);
}

const envSrc = resolve(PROJECT_ROOT, envFile);
if (!existsSync(envSrc)) {
  console.error(`Env file not found: ${envSrc}`);
  process.exit(1);
}

if (!skipGridGate) {
  const jobOutDir = resolve(envSrc, '..', '..');
  const manifestPath = resolve(jobOutDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    console.log('▶ Grid gate: checking manifest.json...');
    await assertOutDirGridGate(jobOutDir);
  }
}
console.log(`▶ Using ${envSrc}`);
await ensureBatchEnvReady(envSrc);

const batchEnv = parseEnv(readFileSync(envSrc, 'utf8'));
const submitEnabled = resolveSubmitEnabled({
  step,
  cliSubmit: args.submit,
  envSubmit: batchEnv.LINE_UPLOAD_SUBMIT,
});
const steps =
  step === 'all'
    ? resolveUploadStepsFromEnv(
        {
          lineStickerId: batchEnv.LINE_STICKER_ID,
          gdriveFolderId: batchEnv.GDRIVE_FOLDER_ID,
        },
        submitEnabled
      )
    : resolvePipelineSteps(step, submitEnabled);

if (step === 'all' && !submitEnabled) {
  console.log('▶ Submit skipped (--submit false / LINE_UPLOAD_SUBMIT=false)');
}
if (step === 'all' && batchEnv.LINE_STICKER_ID?.trim()) {
  console.log('▶ Upload shortcut: LINE_STICKER_ID present — zip only' + (submitEnabled ? ' + submit' : ''));
} else if (step === 'all' && batchEnv.GDRIVE_FOLDER_ID?.trim()) {
  console.log('▶ Upload shortcut: GDRIVE_FOLDER_ID present — skipping gdrive');
}
/** Default: unattended pipeline (no Enter prompts, headless Playwright). */
const runInteractive = args.interactive === 'true' || args.auto === 'false';
if (!runInteractive) {
  console.log('▶ Unattended upload (headless, no Enter prompts). Pass --interactive true to review in browser.');
}

for (const name of steps) {
  console.log(`\n▶ ${name}: ${STEP_SCRIPTS[name]}`);
  const extra = name === 'gdrive' ? ['--stage'] : [];
  if (name === 'gdrive' && args.workers) {
    extra.push('--workers', args.workers);
  }
  if (!runInteractive) {
    if (name === 'provision' || name === 'submit' || name === 'zip') {
      extra.push('--headless');
    }
    if (name === 'provision') {
      extra.push('--no-pause-before-save');
    }
    if (name === 'zip') {
      extra.push('--post-upload-pause', '5');
      extra.push('--import-timeout', '600');
    }
  } else {
    if (name === 'provision') {
      extra.push('--pause-before-save');
    }
    if (name === 'zip') {
      extra.push('--post-upload-pause', '8');
    }
  }
  runPython(STEP_SCRIPTS[name], envSrc, extra);
}

console.log('\n✓ Upload pipeline step(s) complete.');
