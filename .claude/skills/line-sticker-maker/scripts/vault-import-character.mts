/**
 * Import a character reference image into line-sticker-vault as WebP.
 *
 *   npx tsx vault-import-character.mts \
 *     --source output/temp.png \
 *     --slug bloom-calico \
 *     --name "星願花貓" \
 *     --concept "三花貓…" \
 *     --style watercolor \
 *     --set-id SET-20260712-001
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatSetId,
  loadRegistry,
  saveRegistry,
  upsertEntry,
  type StickerRegistryEntry,
} from '../../../../utils/stickerRegistry.ts';
import {
  CHARACTER_META_FORMAT,
  VAULT_CHARACTER_REF_FILENAME,
  characterRefVaultPath,
  resolveVaultRoot,
  vaultRegistryPath,
  type VaultCharacterMeta,
} from '../../../../utils/stickerVault.ts';
import { writeVaultCharacterRef } from '../../../../utils/vaultCharacterRef.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../../../..');

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function resolveSourcePath(pathArg: string): string {
  for (const base of [process.cwd(), ROOT]) {
    const full = resolve(base, pathArg);
    if (existsSync(full)) return full;
  }
  throw new Error(`Source image not found: ${pathArg}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sourceArg = args.source;
  const slugArg = args.slug;
  if (!sourceArg || typeof sourceArg !== 'string') {
    throw new Error('Missing --source <path/to/image.png|webp>');
  }
  if (!slugArg || typeof slugArg !== 'string') {
    throw new Error('Missing --slug <character-slug>');
  }

  const vaultRoot = resolveVaultRoot(
    ROOT,
    typeof args.vault === 'string' ? args.vault : undefined
  );
  if (!vaultRoot) {
    throw new Error('Vault not found. Pass --vault or clone line-sticker-vault as sibling.');
  }

  const characterName = typeof args.name === 'string' ? args.name : slugArg;
  const characterConcept =
    typeof args.concept === 'string' ? args.concept : characterName;
  const style = typeof args.style === 'string' ? args.style : 'chibi';
  const theme = typeof args.theme === 'string' ? args.theme : 'daily';
  const voice = typeof args.voice === 'string' ? args.voice : 'nishimura';
  const date = typeof args.date === 'string' ? args.date : new Date().toISOString().slice(0, 10);
  const setId =
    typeof args['set-id'] === 'string'
      ? args['set-id']
      : formatSetId(date, 1);

  const sourceAbs = resolveSourcePath(sourceArg);
  const charDir = resolve(vaultRoot, 'characters', slugArg);
  const destAbs = resolve(charDir, VAULT_CHARACTER_REF_FILENAME);
  const refVaultRel = characterRefVaultPath(slugArg);

  await mkdir(charDir, { recursive: true });
  await writeVaultCharacterRef(sourceAbs, destAbs);

  const charMeta: VaultCharacterMeta = {
    format: CHARACTER_META_FORMAT,
    version: 1,
    slug: slugArg,
    characterName,
    characterConcept,
    style,
    originSetId: setId,
    createdAt: date,
  };
  await writeFile(resolve(charDir, 'meta.json'), `${JSON.stringify(charMeta, null, 2)}\n`, 'utf8');

  const registryPath = vaultRegistryPath(vaultRoot);
  let registry = await loadRegistry(registryPath);
  const entry: StickerRegistryEntry = {
    id: setId,
    date,
    batchType: 'B',
    characterName,
    characterConcept,
    style,
    theme,
    voice,
    refImagePath: refVaultRel,
    outputDir: `sets/${setId}`,
    status: 'completed',
  };
  registry = upsertEntry(registry, entry);
  await saveRegistry(registryPath, registry);

  console.log(`✓ Wrote ${destAbs}`);
  console.log(`✓ Updated ${basename(registryPath)} → ${setId} ${characterName}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
