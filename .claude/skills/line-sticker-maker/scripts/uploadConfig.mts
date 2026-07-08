/**
 * Upload layout config for LINE Creators Market packaging and sync.
 */

import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBatchEnvContent } from './uploadCredentials.mts';
import { prepareShopListing } from '../../../../utils/lineCreatorsListingText.ts';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export interface UploadConfig {
  /** When false, skip upload-root packaging. Default: true when block is present. */
  enabled?: boolean;
  /**
   * Optional upload root (contains input/{creator}/setName).
   * Omit to pack upload files directly into the job `--out` folder.
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
  /** Copy pack to `.line-upload/input/...` after local finalize. */
  syncToUploadRoot?: boolean;
  /** Upload root path relative to repo root. */
  uploadRoot?: string;
}

/** Legacy job keys accepted when reading configs and manifests. */
export interface UploadJobFields {
  upload?: UploadConfig;
  lineS?: UploadConfig & { syncToLineS?: boolean };
}

export interface PackUploadOptions {
  sourceDir: string;
  upload: UploadConfig;
  sheetDirs: string[];
  zipBytes: Uint8Array;
  /** When false, batch env sets LINE_UPLOAD_SUBMIT=false (skip review submit). Default true. */
  submitForReview?: boolean;
}

export function resolveUploadConfig(job: UploadJobFields): UploadConfig | undefined {
  const raw = job.upload ?? job.lineS;
  if (!raw) return undefined;
  const legacy = raw as UploadConfig & { syncToLineS?: boolean };
  return {
    ...raw,
    syncToUploadRoot: raw.syncToUploadRoot ?? legacy.syncToLineS,
  };
}

export function isUploadEnabled(upload: UploadConfig | undefined): boolean {
  if (!upload) return false;
  return upload.enabled !== false;
}

export function resolveUploadPackDir(upload: UploadConfig, jobOutDir: string): string {
  if (!upload.root?.trim()) {
    return resolve(jobOutDir);
  }
  const creatorId = upload.creatorId?.trim() || '706';
  return resolve(upload.root, 'input', creatorId, upload.setName);
}

function resolveEnvBatchDir(upload: UploadConfig, jobOutDir: string): string {
  if (upload.root?.trim()) {
    return resolve(upload.root, '.env.batch');
  }
  return resolve(jobOutDir, '.env.batch');
}

export function validateUploadConfig(upload: UploadConfig): void {
  const missing: string[] = [];
  if (!upload.setName?.trim()) missing.push('upload.setName');
  if (!upload.titleZh?.trim()) missing.push('upload.titleZh');
  if (!upload.descZh?.trim()) missing.push('upload.descZh');
  if (!upload.titleEn?.trim()) missing.push('upload.titleEn');
  if (!upload.descEn?.trim()) missing.push('upload.descEn');
  if (missing.length > 0) {
    throw new Error(`upload config incomplete — set: ${missing.join(', ')}`);
  }
}

function envFileBaseName(setName: string): string {
  return setName.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function buildMarkdown(upload: UploadConfig): string {
  return `# Traditional Chinese (Taiwan)

## Title

${upload.titleZh}

## Description

${upload.descZh}

---

# English

## Title

${upload.titleEn}

## Description

${upload.descEn}
`;
}

function batchRelBase(upload: UploadConfig, creatorId: string): string {
  return upload.root?.trim()
    ? resolve(upload.root, 'input', creatorId, upload.setName)
        .replace(`${PROJECT_ROOT}/`, '')
        .replace(/\\/g, '/')
    : upload.setName;
}

/** Write upload layout: Set Name.zip, Set Name.md, sprite_sheets/, optional .env.batch */
export async function packUploadOutput(options: PackUploadOptions): Promise<{
  destDir: string;
  envFilePath?: string;
}> {
  const { sourceDir, upload, sheetDirs, zipBytes, submitForReview } = options;
  validateUploadConfig(upload);

  const destDir = resolveUploadPackDir(upload, sourceDir);
  const spriteDir = resolve(destDir, 'sprite_sheets');
  await mkdir(spriteDir, { recursive: true });

  await writeFile(resolve(destDir, `${upload.setName}.zip`), zipBytes);

  for (let i = 0; i < sheetDirs.length; i++) {
    const sheetDir = sheetDirs[i]!;
    const processed = resolve(sourceDir, sheetDir, '_processed-sheet.png');
    const destSprite = resolve(spriteDir, `sprite_sheet_${i + 1}_transparent.png`);
    await copyFile(processed, destSprite);
  }

  await writeFile(resolve(destDir, `${upload.setName}.md`), buildMarkdown(upload), 'utf8');

  if (upload.writeEnvBatch === false) {
    return { destDir };
  }

  const creatorId = upload.creatorId?.trim() || '706';
  const envBatchDir = resolveEnvBatchDir(upload, sourceDir);
  const envFileName = `${envFileBaseName(upload.setName)}.env`;
  const envFilePath = resolve(envBatchDir, envFileName);
  await mkdir(envBatchDir, { recursive: true });
  await writeFile(
    envFilePath,
    buildBatchEnvContent(
      {
        setName: upload.setName,
        titleZh: upload.titleZh,
        descZh: upload.descZh,
        titleEn: upload.titleEn,
        descEn: upload.descEn,
        submitForReview,
      },
      batchRelBase(upload, creatorId)
    ),
    'utf8'
  );

  return { destDir, envFilePath };
}

/** Fit shop listing copy to LINE Creators limits before packaging. */
export function normalizeUploadListing(
  upload: UploadConfig,
  phrases: string[] = []
): { upload: UploadConfig; warnings: string[] } {
  const listing = prepareShopListing({
    titleZh: upload.titleZh,
    descZh: upload.descZh,
    titleEn: upload.titleEn,
    descEn: upload.descEn,
    phrases,
  });
  return {
    upload: {
      ...upload,
      titleZh: listing.titleZh,
      descZh: listing.descZh,
      titleEn: listing.titleEn,
      descEn: listing.descEn,
    },
    warnings: listing.warnings,
  };
}
