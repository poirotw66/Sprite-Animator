/**
 * Keep `npm run build` usable in a clean checkout: only invoke uv/fonttools
 * when the intentionally local TTF font vault is actually present.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_SOURCES = [
  'LiyuShoushu.ttf',
  'FashionBitmap16_0.092.ttf',
  '073 TEGUSE - Kanaka Font_240705.ttf',
  'NaikaiFont-Regular-Lite.ttf',
];
const localFontsPresent = FONT_SOURCES.some((file) =>
  existsSync(resolve(PROJECT_ROOT, 'fonts', file))
);

if (!localFontsPresent) {
  console.info('[fonts] Local TTF font vault not found; skipping browser WOFF2 generation.');
  process.exit(0);
}

const uvCommand = process.platform === 'win32' ? 'uv.exe' : 'uv';
const result = spawnSync(
  uvCommand,
  [
    'run',
    '--locked',
    'python',
    '-B',
    resolve(PROJECT_ROOT, 'scripts', 'build-browser-fonts.py'),
    ...process.argv.slice(2),
  ],
  { cwd: PROJECT_ROOT, stdio: 'inherit' }
);

if (result.error) {
  throw new Error(
    `Unable to run ${uvCommand} for browser font generation: ${result.error.message}. ` +
      'Run `uv sync --locked --dev` and retry.'
  );
}

process.exitCode = result.status ?? 1;
