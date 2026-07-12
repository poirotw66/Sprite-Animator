/**
 * line-sticker-vault path helpers, slug rules, and registry merge for daily-pack.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { StickerRegistryEntry, StickerRegistryFile } from './stickerRegistryFormat';
import { STICKER_REGISTRY_VERSION } from './stickerRegistryFormat';

export const VAULT_DIR_NAME = 'line-sticker-vault';
export const VAULT_REGISTRY_REL_PATH = 'registry/sticker-registry.json';
export const VAULT_CHARACTER_REF_FILENAME = 'character-ref.webp';
export const VAULT_PHRASE_SET_FILENAME = 'phrase-set.json';

export const CHARACTER_META_FORMAT = 'line-sticker-character' as const;
export const SET_META_FORMAT = 'line-sticker-set' as const;

export interface VaultCharacterMeta {
  format: typeof CHARACTER_META_FORMAT;
  version: 1;
  slug: string;
  characterName: string;
  characterConcept: string;
  style: string;
  originSetId: string;
  createdAt: string;
}

export interface VaultSetMeta {
  format: typeof SET_META_FORMAT;
  version: 1;
  id: string;
  date: string;
  batchType: 'A' | 'B';
  characterSlug: string;
  characterName: string;
  theme: string;
  voice: string;
  style: string;
  status: 'completed';
  characterRefPath: string;
  archivedAt: string;
  sourceOutputDir: string;
}

/** Resolve vault root: --vault / STICKER_VAULT_ROOT / sibling ../line-sticker-vault */
export function resolveVaultRoot(repoRoot: string, explicitPath?: string): string | undefined {
  if (explicitPath?.trim()) {
    return resolve(explicitPath.trim());
  }
  const fromEnv = process.env.STICKER_VAULT_ROOT?.trim();
  if (fromEnv) {
    return resolve(fromEnv);
  }
  const sibling = resolve(repoRoot, '..', VAULT_DIR_NAME);
  if (existsSync(sibling)) {
    return sibling;
  }
  return undefined;
}

export function vaultRegistryPath(vaultRoot: string): string {
  return resolve(vaultRoot, VAULT_REGISTRY_REL_PATH);
}

export function isVaultRelativeAssetPath(assetPath: string): boolean {
  const normalized = assetPath.replace(/\\/g, '/');
  return normalized.startsWith('characters/') || normalized.startsWith('sets/');
}

/** Absolute path for a registry refImagePath (vault or Sprite-Animator output). */
export function resolveRegistryAssetPath(
  assetPath: string,
  repoRoot: string,
  vaultRoot?: string
): string {
  const normalized = assetPath.replace(/\\/g, '/');
  if (vaultRoot && isVaultRelativeAssetPath(normalized)) {
    return resolve(vaultRoot, normalized);
  }
  return resolve(repoRoot, normalized);
}

export function mergeRegistriesForPlanning(
  local: StickerRegistryFile,
  vault?: StickerRegistryFile
): StickerRegistryFile {
  if (!vault || vault.entries.length === 0) {
    return local;
  }
  const byId = new Map<string, StickerRegistryEntry>();
  for (const entry of vault.entries) {
    byId.set(entry.id, entry);
  }
  for (const entry of local.entries) {
    byId.set(entry.id, entry);
  }
  return { version: STICKER_REGISTRY_VERSION, entries: [...byId.values()] };
}

/** Stable slug for characters/{slug}/ — prefers descriptive folder names over set-NN. */
export function deriveCharacterSlug(
  characterName: string,
  folderName: string,
  setId: string
): string {
  const fromFolder = folderName
    .replace(/-character$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (fromFolder.length >= 3 && !/^set-\d+$/.test(fromFolder)) {
    return fromFolder.slice(0, 48);
  }

  const fromName = characterName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (/^[a-z0-9-]+$/.test(fromName) && fromName.length >= 2) {
    return fromName.slice(0, 48);
  }

  return `char-${setId.replace(/^SET-/i, '').toLowerCase()}`.slice(0, 48);
}

export function characterRefVaultPath(slug: string): string {
  return `characters/${slug}/${VAULT_CHARACTER_REF_FILENAME}`;
}

export function setVaultDir(setId: string): string {
  return `sets/${setId}`;
}

export function findCharacterSlugInRegistry(
  registry: StickerRegistryFile,
  characterName: string
): string | undefined {
  for (const entry of registry.entries) {
    if (entry.characterName !== characterName) continue;
    if (entry.batchType !== 'B') continue;
    const match = entry.refImagePath.replace(/\\/g, '/').match(/^characters\/([^/]+)\//);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

export function ensureUniqueSlug(baseSlug: string, used: Set<string>): string {
  if (!used.has(baseSlug)) {
    used.add(baseSlug);
    return baseSlug;
  }
  for (let i = 2; i < 1000; i++) {
    const candidate = `${baseSlug}-${i}`.slice(0, 48);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Could not allocate unique slug for: ${baseSlug}`);
}

export function collectUsedCharacterSlugs(registry: StickerRegistryFile): Set<string> {
  const slugs = new Set<string>();
  for (const entry of registry.entries) {
    const match = entry.refImagePath.replace(/\\/g, '/').match(/^characters\/([^/]+)\//);
    if (match?.[1]) {
      slugs.add(match[1]);
    }
  }
  return slugs;
}
