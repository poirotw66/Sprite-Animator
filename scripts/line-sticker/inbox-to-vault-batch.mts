/**
 * Batch: inbox reference images → character model sheet → vault WebP.
 *
 *   npx tsx inbox-to-vault-batch.mts
 *   npx tsx inbox-to-vault-batch.mts --from 3 --resume
 *   npx tsx inbox-to-vault-batch.mts --dry-run
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { formatSetId, loadRegistry } from '../../utils/registry/stickerRegistry.ts';
import {
  collectUsedCharacterSlugs,
  resolveVaultRoot,
  vaultRegistryPath,
} from '../../utils/registry/stickerVault.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../..');
const INBOX_DIR = resolve(ROOT, 'inbox');
const MANIFEST_PATH = resolve(INBOX_DIR, 'vault-batch.json');
const CHAR_REF_SCRIPT = resolve(
  ROOT,
  '.claude/skills/line-sticker-character-ref/scripts/generate-character-ref.mts'
);
const VAULT_IMPORT_SCRIPT = resolve(SCRIPT_DIR, 'vault-import-character.mts');
const BATCH_OUT_DIR = resolve(ROOT, 'output/inbox-batch');

interface BatchItem {
  file: string;
  slug: string;
  name: string;
  concept: string;
  style: string;
}

interface BatchManifest {
  version: number;
  date: string;
  items: BatchItem[];
}

function parseArgs(argv: string[]): Record<string, string | boolean | number> {
  const args: Record<string, string | boolean | number> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = /^\d+$/.test(next) ? Number(next) : next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function runTsx(script: string, scriptArgs: string[]): void {
  const result = spawnSync(process.execPath, ['--import', 'tsx', script, ...scriptArgs], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: tsx ${basename(script)} ${scriptArgs.join(' ')}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args['dry-run']);
  const resume = Boolean(args.resume);
  const fromIndex = typeof args.from === 'number' ? args.from : 1;

  const raw = await readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw) as BatchManifest;

  const vaultRoot = resolveVaultRoot(
    ROOT,
    typeof args.vault === 'string' ? args.vault : undefined
  );
  if (!vaultRoot) {
    throw new Error('Vault not found. Clone line-sticker-vault as sibling or pass --vault.');
  }

  const registry = await loadRegistry(vaultRegistryPath(vaultRoot));
  const usedSlugs = collectUsedCharacterSlugs(registry);
  let setSeq = registry.entries.length + 1;

  console.log(`Batch: ${manifest.items.length} items from ${MANIFEST_PATH}`);
  console.log(`Vault: ${vaultRoot}`);
  if (dryRun) console.log('(dry-run — no API calls, no vault writes)\n');

  for (let i = 0; i < manifest.items.length; i++) {
    const index = i + 1;
    if (index < fromIndex) continue;

    const item = manifest.items[i]!;
    const sourcePath = resolve(INBOX_DIR, item.file);
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing inbox file: ${item.file}`);
    }

    if (resume && usedSlugs.has(item.slug)) {
      console.log(`[${index}/${manifest.items.length}] skip ${item.slug} (already in vault)`);
      continue;
    }

    const setId = formatSetId(manifest.date, setSeq);
    setSeq += 1;
    const outPng = resolve(BATCH_OUT_DIR, item.slug, 'character-ref.png');

    console.log(
      `\n[${index}/${manifest.items.length}] ${item.name} (${item.slug}) ← ${item.file}`
    );

    if (dryRun) {
      console.log(`  generate → ${outPng}`);
      console.log(`  vault    → characters/${item.slug}/character-ref.webp (${setId})`);
      continue;
    }

    await mkdir(dirname(outPng), { recursive: true });

    runTsx(CHAR_REF_SCRIPT, [
      '--concept',
      item.concept,
      '--style',
      'matchUploaded',
      '--identity-ref',
      sourcePath,
      '--name',
      item.name,
      '--out',
      outPng,
    ]);

    runTsx(VAULT_IMPORT_SCRIPT, [
      '--source',
      outPng,
      '--slug',
      item.slug,
      '--name',
      item.name,
      '--concept',
      item.concept,
      '--style',
      item.style,
      '--theme',
      'daily',
      '--voice',
      'nishimura',
      '--set-id',
      setId,
      '--date',
      manifest.date,
    ]);

    usedSlugs.add(item.slug);
    console.log(`✓ Done ${item.slug} → ${setId}`);
  }

  console.log('\nBatch complete.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
