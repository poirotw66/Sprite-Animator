/**
 * Patch vault production folders with character-specific LINE shop listing names.
 *
 *   npx tsx fix-vault-upload-envs.mts --from 1 --to 13
 */

import { existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseRegistryJson } from '../../../../utils/stickerRegistryFormat.ts';
import { suggestVaultShopListing } from '../../../../utils/lineStickerSetNaming.ts';
import { resolveVaultRoot, vaultRegistryPath } from '../../../../utils/stickerVault.ts';
import { parsePhraseSetJson } from '../../../../utils/lineStickerPhraseSetFormat.ts';
import { buildUploadMarkdown, type UploadConfig } from './uploadConfig.mts';
import { buildBatchEnvContent, parseEnv } from './uploadCredentials.mts';

const ROOT = resolve(import.meta.dirname, '../../../..');

function parseArgs(argv: string[]): { from: number; to: number } {
  let from = 1;
  let to = 30;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--from' && argv[i + 1]) from = Number(argv[++i]);
    if (token === '--to' && argv[i + 1]) to = Number(argv[++i]);
  }
  return { from, to };
}

function slotFromId(id: string): number {
  const match = /-(\d{3})$/.exec(id);
  return match ? Number(match[1]) : 0;
}

const vaultRoot = resolveVaultRoot(ROOT);
if (!vaultRoot) {
  throw new Error('Vault not found');
}
const registry = parseRegistryJson(readFileSync(vaultRegistryPath(vaultRoot), 'utf8'));
const { from, to } = parseArgs(process.argv.slice(2));

for (const entry of registry.entries) {
  const slot = slotFromId(entry.id);
  if (slot < from || slot > to) continue;

  const dir = resolve(ROOT, 'output/vault-production', entry.id);
  if (!existsSync(resolve(dir, 'manifest.json'))) {
    console.warn(`skip ${entry.id}: no manifest`);
    continue;
  }

  const phraseSetPath = resolve(dir, 'phrase-set.json');
  const phrases = existsSync(phraseSetPath)
    ? (parsePhraseSetJson(readFileSync(phraseSetPath, 'utf8'))?.phrases ?? [])
    : [];

  const listing = suggestVaultShopListing({
    characterName: entry.characterName,
    refImagePath: entry.refImagePath,
    theme: entry.theme,
    voice: entry.voice,
    phrases,
  });

  const upload: UploadConfig = {
    setName: listing.titleEn,
    titleZh: listing.titleZh,
    descZh: listing.descZh,
    titleEn: listing.titleEn,
    descEn: listing.descEn,
    syncToUploadRoot: true,
  };

  const manifestPath = resolve(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    config: Record<string, unknown>;
  };
  manifest.config = { ...manifest.config, upload };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const jobConfigPath = resolve(dir, 'job.config.json');
  if (existsSync(jobConfigPath)) {
    const job = JSON.parse(readFileSync(jobConfigPath, 'utf8')) as { upload?: UploadConfig };
    job.upload = upload;
    writeFileSync(jobConfigPath, JSON.stringify(job, null, 2), 'utf8');
  }

  const oldMd = readdirSync(dir).find((name) => name.endsWith('.md'));
  const newMd = `${upload.setName}.md`;
  writeFileSync(resolve(dir, newMd), buildUploadMarkdown(upload), 'utf8');
  if (oldMd && oldMd !== newMd) {
    try {
      unlinkSync(resolve(dir, oldMd));
    } catch {
      /* ignore */
    }
  }

  const oldZip = readdirSync(dir).find((name) => name.endsWith('.zip'));
  const newZip = `${upload.setName}.zip`;
  if (oldZip && oldZip !== newZip && existsSync(resolve(dir, oldZip))) {
    renameSync(resolve(dir, oldZip), resolve(dir, newZip));
  }

  const rel = `output/vault-production/${entry.id}`;
  const envDir = resolve(dir, '.env.batch');
  const envFile = readdirSync(envDir).find((name) => name.endsWith('.env'));
  if (!envFile) throw new Error(`Missing .env.batch in ${dir}`);
  const envPath = resolve(envDir, envFile);
  const existing = parseEnv(readFileSync(envPath, 'utf8'));

  let content = buildBatchEnvContent(
    {
      setName: upload.setName,
      titleZh: upload.titleZh,
      descZh: upload.descZh,
      titleEn: upload.titleEn,
      descEn: upload.descEn,
      submitForReview: false,
    },
    rel
  );
  content = content
    .replace(/^GDRIVE_SET_FOLDER=.*$/m, `GDRIVE_SET_FOLDER=${entry.id}`)
    .replace(/^SOURCE_ZIP=.*$/m, `SOURCE_ZIP=${rel}/${upload.setName}.zip`)
    .replace(/^UPLOAD_ZIP=.*$/m, `UPLOAD_ZIP=${rel}/${upload.setName}.zip`)
    .replace(/^SPRITE_SHEETS_DIR=.*$/m, `SPRITE_SHEETS_DIR=${rel}/sprite_sheets`);

  for (const key of ['LINE_STICKER_ID', 'GDRIVE_FOLDER_ID', 'GDRIVE_SHARE_URL'] as const) {
    if (existing[key]) {
      content = content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${existing[key]}`);
    }
  }

  const newEnvName = `${upload.setName.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}.env`;
  writeFileSync(resolve(envDir, newEnvName), content, 'utf8');
  if (envFile !== newEnvName) {
    try {
      unlinkSync(envPath);
    } catch {
      /* ignore */
    }
  }

  console.log(`${entry.id} | ${listing.titleZh} | ${listing.titleEn}`);
}
