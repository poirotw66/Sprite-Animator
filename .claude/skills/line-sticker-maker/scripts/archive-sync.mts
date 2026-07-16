/**
 * Archive completed output/ sticker sets into line-sticker-vault.
 *
 *   npx tsx archive-sync.mts --dry-run
 *   npx tsx archive-sync.mts --sync
 *   npx tsx archive-sync.mts --sync --vault ../line-sticker-vault
 */

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePhraseSetJson } from '../../../../utils/lineStickerPhraseSetFormat.ts';
import {
  DEFAULT_REGISTRY_REL_PATH,
  collectCompletedOutputDirs,
  formatSetId,
  inferCharacterNameFromPhraseSetName,
  loadRegistry,
  resolveRefImageInDir,
  saveRegistry,
  type StickerRegistryEntry,
  upsertEntry,
} from '../../../../utils/stickerRegistry.ts';
import {
  CHARACTER_META_FORMAT,
  SET_META_FORMAT,
  VAULT_CHARACTER_REF_FILENAME,
  VAULT_PHRASE_SET_FILENAME,
  characterRefVaultPath,
  collectUsedCharacterSlugs,
  deriveCharacterSlug,
  ensureUniqueSlug,
  findCharacterSlugInRegistry,
  resolveVaultRoot,
  setVaultDir,
  vaultRegistryPath,
  type VaultCharacterMeta,
  type VaultSetMeta,
} from '../../../../utils/stickerVault.ts';
import { writeVaultCharacterRef } from '../../../../utils/registry/vaultCharacterRef.ts';

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

function inferDateFromPath(outputDir: string): string {
  const parts = outputDir.split(/[/\\]/);
  for (const part of parts) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
      return part;
    }
  }
  return '1970-01-01';
}

function inferSlotIndexFromPath(outputDir: string): number | undefined {
  const folder = basename(outputDir);
  const match = folder.match(/^set-(\d+)$/i);
  if (!match?.[1]) return undefined;
  return Number.parseInt(match[1], 10);
}

function relPosix(from: string, to: string): string {
  return relative(from, to).replace(/\\/g, '/');
}

function findLocalEntry(
  entries: StickerRegistryEntry[],
  sourceOutputRel: string
): StickerRegistryEntry | undefined {
  const normalized = sourceOutputRel.replace(/\\/g, '/');
  return entries.find((entry) => entry.outputDir.replace(/\\/g, '/') === normalized);
}

async function readSetMetaSourceDir(vaultRoot: string, setId: string): Promise<string | undefined> {
  const metaPath = resolve(vaultRoot, setVaultDir(setId), 'meta.json');
  if (!existsSync(metaPath)) return undefined;
  try {
    const raw = await readFile(metaPath, 'utf8');
    const meta = JSON.parse(raw) as Partial<VaultSetMeta>;
    return meta.sourceOutputDir?.replace(/\\/g, '/');
  } catch {
    return undefined;
  }
}

async function isSourceAlreadyArchived(
  vaultRoot: string,
  vaultEntries: StickerRegistryEntry[],
  setId: string,
  sourceOutputRel: string
): Promise<boolean> {
  const normalized = sourceOutputRel.replace(/\\/g, '/');
  if (vaultEntries.some((entry) => entry.id === setId)) {
    return true;
  }
  for (const entry of vaultEntries) {
    const source = await readSetMetaSourceDir(vaultRoot, entry.id);
    if (source === normalized) {
      return true;
    }
  }
  return false;
}

interface ArchiveDraft {
  setId: string;
  date: string;
  batchType: 'A' | 'B';
  characterName: string;
  characterConcept: string;
  style: string;
  theme: string;
  voice: string;
  characterSlug: string;
  sourceOutputRel: string;
  refAbs: string;
  phraseSetAbs: string;
}

async function buildArchiveDraft(
  outputDirAbs: string,
  slotIndex: number,
  localEntries: StickerRegistryEntry[],
  vaultEntries: StickerRegistryEntry[],
  usedSlugs: Set<string>
): Promise<ArchiveDraft | undefined> {
  const phraseSetAbs = resolve(outputDirAbs, VAULT_PHRASE_SET_FILENAME);
  if (!existsSync(phraseSetAbs)) {
    return undefined;
  }

  const refAbs = resolveRefImageInDir(outputDirAbs);
  if (!refAbs) {
    return undefined;
  }

  const raw = await readFile(phraseSetAbs, 'utf8');
  const phraseSet = parsePhraseSetJson(raw);
  if (!phraseSet) {
    return undefined;
  }

  const sourceOutputRel = relPosix(ROOT, outputDirAbs);
  const localEntry = findLocalEntry(localEntries, sourceOutputRel);
  const folderName = basename(outputDirAbs);
  const characterName = localEntry?.characterName
    ?? inferCharacterNameFromPhraseSetName(phraseSet.name, folderName);
  const characterConcept = localEntry?.characterConcept
    ?? phraseSet.name?.trim()
    ?? folderName;
  const date = localEntry?.date ?? inferDateFromPath(sourceOutputRel);
  const inferredSlot = inferSlotIndexFromPath(outputDirAbs) ?? slotIndex;
  const setId = localEntry?.id ?? formatSetId(date, inferredSlot);
  const batchType = localEntry?.batchType ?? 'B';
  const style = localEntry?.style ?? 'chibi';
  const theme = localEntry?.theme ?? 'daily';
  const voice = localEntry?.voice ?? 'nishimura';

  const existingSlug = findCharacterSlugInRegistry(
    { version: 1, entries: vaultEntries },
    characterName
  );
  let characterSlug: string;
  if (existingSlug) {
    characterSlug = existingSlug;
    usedSlugs.add(existingSlug);
  } else {
    characterSlug = ensureUniqueSlug(
      deriveCharacterSlug(characterName, folderName, setId),
      usedSlugs
    );
  }

  return {
    setId,
    date,
    batchType,
    characterName,
    characterConcept,
    style,
    theme,
    voice,
    characterSlug,
    sourceOutputRel,
    refAbs,
    phraseSetAbs,
  };
}

async function writeArchive(
  vaultRoot: string,
  draft: ArchiveDraft,
  dryRun: boolean
): Promise<StickerRegistryEntry> {
  const setRel = setVaultDir(draft.setId);
  const refVaultRel = characterRefVaultPath(draft.characterSlug);
  const setDirAbs = resolve(vaultRoot, setRel);
  const phraseDest = resolve(setDirAbs, VAULT_PHRASE_SET_FILENAME);
  const metaDest = resolve(setDirAbs, 'meta.json');
  const charDirAbs = resolve(vaultRoot, 'characters', draft.characterSlug);
  const charRefDest = resolve(charDirAbs, VAULT_CHARACTER_REF_FILENAME);
  const charMetaDest = resolve(charDirAbs, 'meta.json');

  const archivedAt = new Date().toISOString();
  const setMeta: VaultSetMeta = {
    format: SET_META_FORMAT,
    version: 1,
    id: draft.setId,
    date: draft.date,
    batchType: draft.batchType,
    characterSlug: draft.characterSlug,
    characterName: draft.characterName,
    theme: draft.theme,
    voice: draft.voice,
    style: draft.style,
    status: 'completed',
    characterRefPath: refVaultRel,
    archivedAt,
    sourceOutputDir: draft.sourceOutputRel,
  };

  const charMeta: VaultCharacterMeta = {
    format: CHARACTER_META_FORMAT,
    version: 1,
    slug: draft.characterSlug,
    characterName: draft.characterName,
    characterConcept: draft.characterConcept,
    style: draft.style,
    originSetId: draft.setId,
    createdAt: draft.date,
  };

  if (!dryRun) {
    await mkdir(setDirAbs, { recursive: true });
    await copyFile(draft.phraseSetAbs, phraseDest);
    await writeFile(metaDest, `${JSON.stringify(setMeta, null, 2)}\n`, 'utf8');

    if (!existsSync(charRefDest)) {
      await mkdir(charDirAbs, { recursive: true });
      await writeVaultCharacterRef(draft.refAbs, charRefDest);
      await writeFile(charMetaDest, `${JSON.stringify(charMeta, null, 2)}\n`, 'utf8');
    }
  }

  return {
    id: draft.setId,
    date: draft.date,
    batchType: draft.batchType,
    characterName: draft.characterName,
    characterConcept: draft.characterConcept,
    style: draft.style,
    theme: draft.theme,
    voice: draft.voice,
    refImagePath: refVaultRel,
    outputDir: setRel,
    status: 'completed',
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args['dry-run']);
  const sync = Boolean(args.sync);
  if (!dryRun && !sync) {
    throw new Error('Pass --dry-run to preview or --sync to write into vault');
  }

  const vaultRoot = resolveVaultRoot(
    ROOT,
    typeof args.vault === 'string' ? args.vault : undefined
  );
  if (!vaultRoot) {
    throw new Error(
      'Vault not found. Pass --vault <path> or set STICKER_VAULT_ROOT, or clone line-sticker-vault as a sibling folder.'
    );
  }

  const outputRoot = resolve(ROOT, typeof args.output === 'string' ? args.output : 'output');
  const localRegistryPath = resolve(
    ROOT,
    typeof args.registry === 'string' ? args.registry : DEFAULT_REGISTRY_REL_PATH
  );
  const registryPath = vaultRegistryPath(vaultRoot);

  const dirs = await collectCompletedOutputDirs(outputRoot);
  const withMtime = await Promise.all(
    dirs.map(async (dir) => ({
      dir,
      mtime: (await stat(dir)).mtimeMs,
    }))
  );
  withMtime.sort((a, b) => a.mtime - b.mtime);

  const localRegistry = await loadRegistry(localRegistryPath);
  let vaultRegistry = await loadRegistry(registryPath);
  const usedSlugs = collectUsedCharacterSlugs(vaultRegistry);

  let archived = 0;
  let skipped = 0;

  for (let i = 0; i < withMtime.length; i++) {
    const { dir } = withMtime[i]!;
    const sourceOutputRel = relPosix(ROOT, dir);

    const draft = await buildArchiveDraft(
      dir,
      i + 1,
      localRegistry.entries,
      vaultRegistry.entries,
      usedSlugs
    );
    if (!draft) {
      continue;
    }

    if (await isSourceAlreadyArchived(vaultRoot, vaultRegistry.entries, draft.setId, sourceOutputRel)) {
      skipped++;
      console.log(`  ↷ skip ${draft.setId} ← ${sourceOutputRel}`);
      continue;
    }

    const entry = await writeArchive(vaultRoot, draft, dryRun);
    vaultRegistry = upsertEntry(vaultRegistry, entry);
    archived++;
    console.log(
      `  + ${draft.setId} ${draft.batchType} ${draft.characterName} → characters/${draft.characterSlug}`
    );
  }

  console.log(`\nArchive: scanned ${dirs.length} sets, archived ${archived}, skipped ${skipped}`);

  if (sync && !dryRun) {
    await saveRegistry(registryPath, vaultRegistry);
    console.log(`Wrote ${relative(ROOT, registryPath)}`);
  } else if (dryRun) {
    console.log('(dry-run — vault files not written)');
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
