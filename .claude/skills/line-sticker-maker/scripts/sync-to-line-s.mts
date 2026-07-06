/**
 * Sync a packed sticker set from line-sticker-maker `--out` to the line-s submodule.
 *
 *   npx tsx sync-to-line-s.mts --source example/output/p4 --config example/p4-job.config.json
 */

import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type LineSConfig,
  validateLineSConfig,
  isLineSEnabled,
} from './organize-line-s-input.mts';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ROOT = resolve(SKILL_ROOT, '../../..');
export const DEFAULT_UPLOAD_ROOT = resolve(PROJECT_ROOT, 'line-s');

export interface SyncToLineSOptions {
  sourceDir: string;
  lineS: LineSConfig;
  /** line-s submodule root (default: <repo>/line-s). */
  uploadRoot?: string;
}

function envFileBaseName(setName: string): string {
  return setName.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function resolveUploadRoot(uploadRoot?: string): string {
  if (!uploadRoot?.trim()) return DEFAULT_UPLOAD_ROOT;
  return resolve(PROJECT_ROOT, uploadRoot);
}

export function resolveLineSInputDest(uploadRoot: string, lineS: LineSConfig): string {
  const creatorId = lineS.creatorId?.trim() || '706';
  return resolve(uploadRoot, 'input', creatorId, lineS.setName);
}

/** Copy Set Name.zip / .md / sprite_sheets + .env.batch into line-s submodule. */
export async function syncPackToLineS(options: SyncToLineSOptions): Promise<{
  destDir: string;
  envFilePath: string;
  uploadRoot: string;
}> {
  const { sourceDir, lineS } = options;
  validateLineSConfig(lineS);

  const uploadRoot = resolveUploadRoot(options.uploadRoot ?? lineS.uploadRoot);
  if (!existsSync(uploadRoot)) {
    throw new Error(
      `line-s upload root not found: ${uploadRoot}\n` +
        'Run: git submodule update --init line-s'
    );
  }

  const destDir = resolveLineSInputDest(uploadRoot, lineS);
  const spriteDest = resolve(destDir, 'sprite_sheets');
  await mkdir(spriteDest, { recursive: true });

  const zipSrc = resolve(sourceDir, `${lineS.setName}.zip`);
  const mdSrc = resolve(sourceDir, `${lineS.setName}.md`);
  const spritesSrc = resolve(sourceDir, 'sprite_sheets');

  await copyFile(zipSrc, resolve(destDir, `${lineS.setName}.zip`));
  await copyFile(mdSrc, resolve(destDir, `${lineS.setName}.md`));
  await cp(spritesSrc, spriteDest, { recursive: true });

  const creatorId = lineS.creatorId?.trim() || '706';
  const relBase = `input/${creatorId}/${lineS.setName}`;
  const envContent = `# LINE Creators Market — ${lineS.setName}
LINE_EMAIL=
LINE_PASSWORD=
LINE_CREATOR_ID=
LINE_STICKER_ID=

GOOGLE_EMAIL=
GOOGLE_PASSWORD=
GDRIVE_PARENT_FOLDER=LINE-sticker
GDRIVE_SET_FOLDER=${lineS.setName}
GDRIVE_STICKER_SUBFOLDER=sticker-pack
GDRIVE_FOLDER_ID=
GDRIVE_SHARE_URL=

STICKER_TITLE_ZH=${lineS.titleZh}
STICKER_DESC_ZH=${lineS.descZh}
STICKER_TITLE_EN=${lineS.titleEn}
STICKER_DESC_EN=${lineS.descEn}

COPYRIGHT=Copyright (c) Blo0m
USE_AI=true
SALE_START=auto
STICKER_COUNT=40
SALE_REGION=all
JOIN_CAMPAIGNS=false

SOURCE_ZIP=${relBase}/${lineS.setName}.zip
UPLOAD_ZIP=${relBase}/${lineS.setName}.zip
SPRITE_SHEETS_DIR=${relBase}/sprite_sheets
`;

  // Keep .env.batch under job --out (not inside line-s submodule) to avoid dirty submodule status.
  const envBatchDir = resolve(sourceDir, '.env.batch');
  const envFilePath = resolve(envBatchDir, `${envFileBaseName(lineS.setName)}.env`);
  await mkdir(envBatchDir, { recursive: true });
  await writeFile(envFilePath, envContent, 'utf8');

  return { destDir, envFilePath, uploadRoot };
}

export function shouldSyncToLineS(lineS: LineSConfig | undefined): boolean {
  if (!isLineSEnabled(lineS) || !lineS) return false;
  if (lineS.syncToLineS === false) return false;
  if (lineS.syncToLineS === true) return true;
  return existsSync(DEFAULT_UPLOAD_ROOT);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.source ?? '';
  const configPath = args.config ?? '';
  if (!sourceDir || !configPath) {
    throw new Error('Usage: sync-to-line-s.mts --source <out> --config <job.json>');
  }

  const config = JSON.parse(await readFile(resolve(configPath), 'utf8')) as { lineS?: LineSConfig };
  if (!config.lineS) throw new Error('config.lineS is required');

  const result = await syncPackToLineS({
    sourceDir: resolve(sourceDir),
    lineS: config.lineS,
    uploadRoot: args['upload-root'],
  });

  console.log(`✓ Synced → ${result.destDir}`);
  console.log(`  ${result.envFilePath}`);
  console.log('\n▶ Upload (from repo root):');
  console.log(`  npx tsx .claude/skills/line-sticker-maker/scripts/run-line-upload.mts --env ${result.envFilePath}`);
}

const isCli = process.argv[1]?.includes('sync-to-line-s');
if (isCli) {
  main().catch((err) => {
    console.error('✗', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
