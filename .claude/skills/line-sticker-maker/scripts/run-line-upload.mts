/**
 * Run the line-s upload pipeline (Drive → provision → ZIP → submit).
 *
 *   npx tsx run-line-upload.mts --env line-s/.env.batch/Cozy_Cream_Cat_Daily_Chat.env
 *   npx tsx run-line-upload.mts --env ... --step gdrive
 *   npx tsx run-line-upload.mts --env ... --step provision|zip|submit
 */

import { copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ROOT = resolve(SKILL_ROOT, '../../..');
const LINE_S_ROOT = resolve(PROJECT_ROOT, 'line-s');
const UPLOAD_SCRIPTS = resolve(
  LINE_S_ROOT,
  '.cursor/skills/line-sticker-upload/scripts'
);

type UploadStep = 'gdrive' | 'provision' | 'zip' | 'submit' | 'all';

const STEP_SCRIPTS: Record<Exclude<UploadStep, 'all'>, string> = {
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

function runPython(script: string, extraArgs: string[] = []): void {
  const scriptPath = resolve(UPLOAD_SCRIPTS, script);
  if (!existsSync(scriptPath)) {
    throw new Error(`Missing upload script: ${scriptPath}\nRun: git submodule update --init line-s`);
  }
  const result = spawnSync('python', [scriptPath, ...extraArgs], {
    cwd: LINE_S_ROOT,
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

if (!envFile) {
  console.error(
    'Usage: run-line-upload.mts --env line-s/.env.batch/Set_Name.env [--step gdrive|provision|zip|submit|all]'
  );
  process.exit(1);
}

if (!existsSync(LINE_S_ROOT)) {
  console.error('line-s submodule missing. Run: git submodule update --init line-s');
  process.exit(1);
}

const envSrc = resolve(PROJECT_ROOT, envFile);
const envDest = resolve(LINE_S_ROOT, '.env');
if (!existsSync(envSrc)) {
  console.error(`Env file not found: ${envSrc}`);
  process.exit(1);
}

await copyFile(envSrc, envDest);
console.log(`▶ Using ${envSrc} → line-s/.env`);

const steps: Exclude<UploadStep, 'all'>[] =
  step === 'all' ? ['gdrive', 'provision', 'zip', 'submit'] : [step];

for (const name of steps) {
  console.log(`\n▶ ${name}: ${STEP_SCRIPTS[name]}`);
  const extra = name === 'gdrive' ? ['--stage'] : [];
  if (name === 'provision' || name === 'submit') {
    extra.push('--headless');
  }
  runPython(STEP_SCRIPTS[name], extra);
}

console.log('\n✓ Upload pipeline step(s) complete.');
