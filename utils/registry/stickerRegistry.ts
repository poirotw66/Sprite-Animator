/**
 * Sticker production registry — tracks completed sets for daily-pack A/B rotation.
 * Browser-safe types/parsers live in stickerRegistryFormat.ts.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export type {
  StickerBatchType,
  StickerRegistryEntry,
  StickerRegistryFile,
  StickerRegistryStatus,
} from './stickerRegistryFormat';
export {
  STICKER_REGISTRY_VERSION,
  DEFAULT_REGISTRY_REL_PATH,
  themeVoiceKey,
  formatSetId,
  emptyRegistry,
  parseRegistryJson,
  findEntryById,
  appendEntry,
  upsertEntry,
  updateEntryStatus,
  usedThemeVoicePairs,
  recentConcepts,
  inferCharacterNameFromPhraseSetName,
} from './stickerRegistryFormat';

import type { StickerRegistryFile } from './stickerRegistryFormat';
import { emptyRegistry, parseRegistryJson } from './stickerRegistryFormat';
import { resolveRegistryAssetPath } from './stickerVault';

export async function loadRegistry(registryPath: string): Promise<StickerRegistryFile> {
  if (!existsSync(registryPath)) {
    return emptyRegistry();
  }
  const raw = await readFile(registryPath, 'utf8');
  return parseRegistryJson(raw);
}

export async function saveRegistry(registryPath: string, registry: StickerRegistryFile): Promise<void> {
  await mkdir(dirname(registryPath), { recursive: true });
  const tempPath = `${registryPath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  await rename(tempPath, registryPath);
}

export interface VerifiedCharacter {
  characterName: string;
  characterConcept: string;
  refImagePath: string;
  style: string;
  originEntryId: string;
}

export function listVerifiedCharacters(
  registry: StickerRegistryFile,
  repoRoot: string,
  fileExists: (path: string) => boolean = existsSync,
  vaultRoot?: string
): VerifiedCharacter[] {
  const seen = new Set<string>();
  const result: VerifiedCharacter[] = [];

  for (const entry of registry.entries) {
    if (entry.status !== 'completed') continue;
    if (entry.batchType !== 'B') continue;
    if (seen.has(entry.characterName)) continue;

    const absRef = resolveRegistryAssetPath(entry.refImagePath, repoRoot, vaultRoot);
    if (!fileExists(absRef)) continue;

    seen.add(entry.characterName);
    result.push({
      characterName: entry.characterName,
      characterConcept: entry.characterConcept,
      refImagePath: entry.refImagePath,
      style: entry.style,
      originEntryId: entry.id,
    });
  }
  return result;
}

export function resolveRefImageInDir(outputDir: string): string | undefined {
  const candidates = [
    'character-ref.webp',
    'character-ref.png',
    'reference-image.webp',
    'reference-image.png',
    'reference-image.jpg',
  ];
  for (const name of candidates) {
    const full = join(outputDir, name);
    if (existsSync(full)) return full;
  }
  return undefined;
}

export function isCompletedStickerSet(outputDir: string): boolean {
  const manifest = join(outputDir, 'manifest.json');
  const sticker = join(outputDir, 'stickers', 'sticker-01.png');
  return existsSync(manifest) && existsSync(sticker);
}

/** Walk output/ and return absolute paths of completed sticker set directories. */
export async function collectCompletedOutputDirs(outputRoot: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    if (isCompletedStickerSet(dir)) {
      results.push(dir);
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'stickers' || entry.name === '.env.batch') continue;
      await walk(join(dir, entry.name));
    }
  }

  if (!existsSync(outputRoot)) {
    return results;
  }
  await walk(outputRoot);
  return results;
}
