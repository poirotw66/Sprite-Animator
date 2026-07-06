/**
 * Package Sprite-Animator LINE output into line-s upload input layout.
 *
 *   npx tsx organize-line-s-input.mts \
 *     --source example/output/p4 \
 *     --dest "C:/Users/sora0/Desktop/line-s/input/706/Cozy Cream Cat Daily Chat" \
 *     --name "Cozy Cream Cat Daily Chat" \
 *     --title-zh "..." --title-en "..."
 */

import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Default skill output root (example/output). Used in docs and config examples. */
export const DEFAULT_SKILL_OUTPUT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'example',
  'output'
);

export interface LineSConfig {
  /** When false, skip line-s packaging (legacy line-upload only). Default: true when lineS block is present. */
  enabled?: boolean;
  /**
   * External line-s repo root (contains input/ and .env.batch/).
   * Omit to pack upload files directly into the job `--out` folder (under example/output/pX/).
   */
  root?: string;
  /** Creator folder under input/ when using external root (default: 706). */
  creatorId?: string;
  /** English folder / ZIP base name, e.g. "Cozy Cream Cat Daily Chat". */
  setName: string;
  titleZh: string;
  descZh: string;
  titleEn: string;
  descEn: string;
  /** Write .env.batch snippet (default: true). */
  writeEnvBatch?: boolean;
  /** Copy pack to line-s submodule after local finalize (default: true when ./line-s exists). */
  syncToLineS?: boolean;
  /** line-s submodule path relative to repo root (default: line-s). */
  uploadRoot?: string;
}

export interface PackLineSOptions {
  sourceDir: string;
  lineS: LineSConfig;
  sheetDirs: string[];
  /** Pre-built upload ZIP bytes (42 PNGs). */
  zipBytes: Uint8Array;
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

export function isLineSEnabled(lineS: LineSConfig | undefined): boolean {
  if (!lineS) return false;
  return lineS.enabled !== false;
}

/**
 * Upload pack destination:
 * - no lineS.root → job `--out` dir (e.g. example/output/p4/)
 * - lineS.root set → external line-s repo (root/input/706/setName/)
 */
export function resolveLineSDestDir(lineS: LineSConfig, jobOutDir: string): string {
  if (!lineS.root?.trim()) {
    return resolve(jobOutDir);
  }
  const creatorId = lineS.creatorId?.trim() || '706';
  return resolve(lineS.root, 'input', creatorId, lineS.setName);
}

function resolveEnvBatchDir(lineS: LineSConfig, jobOutDir: string): string {
  if (lineS.root?.trim()) {
    return resolve(lineS.root, '.env.batch');
  }
  return resolve(jobOutDir, '.env.batch');
}

export function validateLineSConfig(lineS: LineSConfig): void {
  const missing: string[] = [];
  if (!lineS.setName?.trim()) missing.push('lineS.setName');
  if (!lineS.titleZh?.trim()) missing.push('lineS.titleZh');
  if (!lineS.descZh?.trim()) missing.push('lineS.descZh');
  if (!lineS.titleEn?.trim()) missing.push('lineS.titleEn');
  if (!lineS.descEn?.trim()) missing.push('lineS.descEn');
  if (missing.length > 0) {
    throw new Error(`lineS config incomplete — set: ${missing.join(', ')}`);
  }
}

function envFileBaseName(setName: string): string {
  return setName.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function buildMarkdown(lineS: LineSConfig): string {
  return `# Traditional Chinese (Taiwan)

## Title

${lineS.titleZh}

## Description

${lineS.descZh}

---

# English

## Title

${lineS.titleEn}

## Description

${lineS.descEn}
`;
}

function buildEnvBatch(lineS: LineSConfig, creatorId: string): string {
  const relBase = `input/${creatorId}/${lineS.setName}`;
  return `# LINE Creators Market — ${lineS.setName}
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
}

/** Write line-s folder layout: Set Name.zip, Set Name.md, sprite_sheets/, optional .env.batch */
export async function packLineSOutput(options: PackLineSOptions): Promise<{
  destDir: string;
  envFilePath?: string;
}> {
  const { sourceDir, lineS, sheetDirs, zipBytes } = options;
  validateLineSConfig(lineS);

  const destDir = resolveLineSDestDir(lineS, sourceDir);
  const spriteDir = resolve(destDir, 'sprite_sheets');
  await mkdir(spriteDir, { recursive: true });

  await writeFile(resolve(destDir, `${lineS.setName}.zip`), zipBytes);

  for (let i = 0; i < sheetDirs.length; i++) {
    const sheetDir = sheetDirs[i]!;
    const processed = resolve(sourceDir, sheetDir, '_processed-sheet.png');
    const destSprite = resolve(spriteDir, `sprite_sheet_${i + 1}_transparent.png`);
    await copyFile(processed, destSprite);
  }

  await writeFile(resolve(destDir, `${lineS.setName}.md`), buildMarkdown(lineS), 'utf8');

  if (lineS.writeEnvBatch === false) {
    return { destDir };
  }

  const creatorId = lineS.creatorId?.trim() || '706';
  const envBatchDir = resolveEnvBatchDir(lineS, sourceDir);
  const envFileName = `${envFileBaseName(lineS.setName)}.env`;
  const envFilePath = resolve(envBatchDir, envFileName);
  await mkdir(envBatchDir, { recursive: true });
  await writeFile(envFilePath, buildEnvBatch(lineS, creatorId), 'utf8');

  return { destDir, envFilePath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.source ?? '';
  const destDirArg = args.dest ?? '';
  const setName = args.name ?? '';
  if (!sourceDir || !destDirArg || !setName) {
    throw new Error(
      'Usage: organize-line-s-input.mts --source <out> --dest <line-s/input/706/Set Name> --name "Set Name" ' +
        '--title-zh "..." --desc-zh "..." --title-en "..." --desc-en "..." [--sheets sheet-1,sheet-2]'
    );
  }

  const titleZh = args['title-zh'] ?? '';
  const descZh = args['desc-zh'] ?? '';
  const titleEn = args['title-en'] ?? '';
  const descEn = args['desc-en'] ?? '';
  if (!titleZh || !descZh || !titleEn || !descEn) {
    throw new Error('organize-line-s-input requires --title-zh, --desc-zh, --title-en, --desc-en');
  }

  const sheetDirs = (args.sheets ?? 'sheet-1,sheet-2').split(',').map((s) => s.trim()).filter(Boolean);
  const lineSRoot = resolve(destDirArg, '..', '..', '..');
  const lineS: LineSConfig = {
    root: lineSRoot,
    creatorId: '706',
    setName,
    titleZh,
    descZh,
    titleEn,
    descEn,
  };

  const { readFile } = await import('node:fs/promises');
  const zipPath = resolve(sourceDir, 'line-upload.zip');
  let zipBytes: Uint8Array;
  try {
    zipBytes = new Uint8Array(await readFile(zipPath));
  } catch {
    throw new Error(
      `Missing ${zipPath}. Run finalize.mts or generate.mts first, or pass a job with lineS enabled.`
    );
  }

  const { destDir, envFilePath } = await packLineSOutput({
    sourceDir: resolve(sourceDir),
    lineS,
    sheetDirs,
    zipBytes,
  });

  console.log(`✓ Packed → ${destDir}`);
  console.log(`  ${setName}.md`);
  console.log(`  ${setName}.zip`);
  console.log(`  sprite_sheets/ (${sheetDirs.length} sheets)`);
  if (envFilePath) console.log(`  ${envFilePath}`);
}

const isCli = process.argv[1]?.includes('organize-line-s-input');
if (isCli) {
  main().catch((err) => {
    console.error('✗', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
