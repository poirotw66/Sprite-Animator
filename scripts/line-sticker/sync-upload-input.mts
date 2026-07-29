/**
 * Sync a packed sticker set from line-sticker-maker `--out` to the repo-local upload root.
 *
 *   npx tsx sync-upload-input.mts --source output/my-set --config examples/demo-job.config.json
 */

import { access, copyFile, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type UploadConfig,
  validateUploadConfig,
  isUploadEnabled,
} from './uploadConfig.mts';
import { buildBatchEnvContent } from './uploadCredentials.mts';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_UPLOAD_ROOT = resolve(PROJECT_ROOT, '.line-upload');

export interface SyncUploadOptions {
  sourceDir: string;
  upload: UploadConfig;
  /** Upload root (default: <repo>/.line-upload). */
  uploadRoot?: string;
  submitForReview?: boolean;
  /** Finalize run identifier used for atomic upload-root publication. */
  runId?: string;
}

function envFileBaseName(setName: string): string {
  return setName.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function resolveUploadRoot(uploadRoot?: string): string {
  if (!uploadRoot?.trim()) return DEFAULT_UPLOAD_ROOT;
  return resolve(PROJECT_ROOT, uploadRoot);
}

export function resolveUploadInputDest(uploadRoot: string, upload: UploadConfig): string {
  const creatorId = upload.creatorId?.trim() || '706';
  return resolve(uploadRoot, 'input', creatorId, upload.setName);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function publishDirectoryAtomic(
  stagedPath: string,
  targetPath: string,
  runId: string
): Promise<void> {
  const backupPath = `${targetPath}.backup-${runId}`;
  await rm(backupPath, { recursive: true, force: true });
  const hadTarget = await pathExists(targetPath);
  if (hadTarget) await rename(targetPath, backupPath);
  try {
    await rename(stagedPath, targetPath);
    await rm(backupPath, { recursive: true, force: true });
  } catch (error) {
    if (hadTarget && (await pathExists(backupPath))) {
      await rename(backupPath, targetPath);
    }
    throw error;
  }
}

async function cleanupSiblingStaging(targetPath: string): Promise<void> {
  const parent = dirname(targetPath);
  const prefix = `${basename(targetPath)}.staging-`;
  let names: string[] = [];
  try {
    names = await readdir(parent);
  } catch {
    return;
  }
  await Promise.all(
    names
      .filter((name) => name.startsWith(prefix))
      .map((name) => rm(resolve(parent, name), { recursive: true, force: true }))
  );
}

/** Copy Set Name.zip / .md / sprite_sheets + .env.batch into the repo-local upload root. */
export async function syncPackToUploadRoot(options: SyncUploadOptions): Promise<{
  destDir: string;
  envFilePath: string;
  uploadRoot: string;
}> {
  const { sourceDir, upload, submitForReview } = options;
  validateUploadConfig(upload);

  const uploadRoot = resolveUploadRoot(options.uploadRoot ?? upload.uploadRoot);
  await mkdir(uploadRoot, { recursive: true });

  const destDir = resolveUploadInputDest(uploadRoot, upload);
  const runId = options.runId ?? `${Date.now()}-${process.pid}`;
  const stagingDir = `${destDir}.staging-${runId}`;
  await cleanupSiblingStaging(destDir);
  await rm(stagingDir, { recursive: true, force: true });
  const spriteDest = resolve(stagingDir, 'sprite_sheets');
  await mkdir(spriteDest, { recursive: true });

  const zipSrc = resolve(sourceDir, `${upload.setName}.zip`);
  const mdSrc = resolve(sourceDir, `${upload.setName}.md`);
  const spritesSrc = resolve(sourceDir, 'sprite_sheets');

  await copyFile(zipSrc, resolve(stagingDir, `${upload.setName}.zip`));
  await copyFile(mdSrc, resolve(stagingDir, `${upload.setName}.md`));
  await cp(spritesSrc, spriteDest, { recursive: true });
  await publishDirectoryAtomic(stagingDir, destDir, runId);

  const relBase = relative(PROJECT_ROOT, destDir).replace(/\\/g, '/');
  const envContent = buildBatchEnvContent(
    {
      setName: upload.setName,
      titleZh: upload.titleZh,
      descZh: upload.descZh,
      titleEn: upload.titleEn,
      descEn: upload.descEn,
      submitForReview,
    },
    relBase
  );

  const envBatchDir = resolve(sourceDir, '.env.batch');
  const envFilePath = resolve(envBatchDir, `${envFileBaseName(upload.setName)}.env`);
  await mkdir(envBatchDir, { recursive: true });
  await writeFile(envFilePath, envContent, 'utf8');

  return { destDir, envFilePath, uploadRoot };
}

export function shouldSyncToUploadRoot(upload: UploadConfig | undefined): boolean {
  if (!isUploadEnabled(upload) || !upload) return false;
  if (upload.syncToUploadRoot === false) return false;
  return true;
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

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.source ?? '';
  const configPath = args.config ?? '';
  if (!sourceDir || !configPath) {
    throw new Error('Usage: sync-upload-input.mts --source <out> --config <job.json>');
  }

  const { resolveUploadConfig } = await import('./uploadConfig.mts');
  const config = JSON.parse(await readFile(resolve(PROJECT_ROOT, configPath), 'utf8')) as {
    upload?: UploadConfig;
    lineS?: UploadConfig;
    lineUploadSubmit?: boolean;
  };
  const upload = resolveUploadConfig(config);
  if (!upload) throw new Error('config.upload is required');

  const result = await syncPackToUploadRoot({
    sourceDir: resolve(PROJECT_ROOT, sourceDir),
    upload,
    submitForReview: config.lineUploadSubmit === true,
  });

  console.log(`✓ Synced → ${result.destDir}`);
  console.log(`  batch env: ${result.envFilePath}`);
  console.log(
    `  npx tsx scripts/line-sticker/run-line-upload.mts --env ${result.envFilePath}`
  );
}

const isCli = process.argv[1]?.includes('sync-upload-input');
if (isCli) {
  main().catch((err) => {
    console.error('✗', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
