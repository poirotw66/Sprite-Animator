/**
 * Thin TS wrapper that spawns the additive Python V2 sheet converter.
 * Does not replace nodeImage chroma/slice — opt-in only.
 *
 *   npx tsx convert-sheet-v2.mts --sheet path/to/4x5.png --out output/my-set
 *   npx tsx convert-sheet-v2.mts --sheet path/to/keyed.png --out output/my-set --already-keyed
 *   npx tsx convert-sheet-v2.mts --input input/ --output output/ --zip
 *   npx tsx convert-sheet-v2.mts --self-check
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '../..');
const CONVERT_PY = resolve(SCRIPT_DIR, 'python/sheet_converter_v2/convert.py');

function assertUvAvailable(): void {
  const probe = spawnSync('uv', ['--version'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    throw new Error('uv not found — install uv, then run `uv sync --locked --dev`');
  }
}

if (!existsSync(CONVERT_PY)) {
  console.error(`Missing V2 converter: ${CONVERT_PY}`);
  process.exit(1);
}

assertUvAvailable();
const result = spawnSync(
  'uv',
  ['run', '--locked', 'python', CONVERT_PY, ...process.argv.slice(2)],
  {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: process.env,
  }
);

process.exit(result.status ?? 1);
