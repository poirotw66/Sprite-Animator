/**
 * Sticker production registry — tracks completed sets for daily-pack A/B rotation.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export type StickerBatchType = 'A' | 'B';
export type StickerRegistryStatus = 'planned' | 'completed' | 'failed';

export interface StickerRegistryEntry {
  id: string;
  date: string;
  batchType: StickerBatchType;
  characterName: string;
  characterConcept: string;
  style: string;
  theme: string;
  voice: string;
  refImagePath: string;
  outputDir: string;
  status: StickerRegistryStatus;
}

export interface StickerRegistryFile {
  version: 1;
  entries: StickerRegistryEntry[];
}

export const STICKER_REGISTRY_VERSION = 1 as const;
export const DEFAULT_REGISTRY_REL_PATH = 'output/sticker-registry.json';

export function themeVoiceKey(theme: string, voice: string): string {
  return `${theme}::${voice}`;
}

export function formatSetId(date: string, slotIndex: number): string {
  const compact = date.replace(/-/g, '');
  return `SET-${compact}-${String(slotIndex).padStart(3, '0')}`;
}

export function emptyRegistry(): StickerRegistryFile {
  return { version: STICKER_REGISTRY_VERSION, entries: [] };
}

export function parseRegistryJson(raw: string): StickerRegistryFile {
  const parsed = JSON.parse(raw) as Partial<StickerRegistryFile>;
  if (!parsed || parsed.version !== STICKER_REGISTRY_VERSION || !Array.isArray(parsed.entries)) {
    throw new Error('Invalid sticker-registry.json format');
  }
  return { version: STICKER_REGISTRY_VERSION, entries: parsed.entries };
}

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

export function findEntryById(registry: StickerRegistryFile, id: string): StickerRegistryEntry | undefined {
  return registry.entries.find((entry) => entry.id === id);
}

export function appendEntry(registry: StickerRegistryFile, entry: StickerRegistryEntry): StickerRegistryFile {
  if (findEntryById(registry, entry.id)) {
    throw new Error(`Registry entry already exists: ${entry.id}`);
  }
  return { ...registry, entries: [...registry.entries, entry] };
}

export function upsertEntry(registry: StickerRegistryFile, entry: StickerRegistryEntry): StickerRegistryFile {
  const index = registry.entries.findIndex((e) => e.id === entry.id);
  if (index < 0) {
    return appendEntry(registry, entry);
  }
  const entries = [...registry.entries];
  entries[index] = entry;
  return { ...registry, entries };
}

export function updateEntryStatus(
  registry: StickerRegistryFile,
  id: string,
  status: StickerRegistryStatus
): StickerRegistryFile {
  const entry = findEntryById(registry, id);
  if (!entry) {
    throw new Error(`Registry entry not found: ${id}`);
  }
  return upsertEntry(registry, { ...entry, status });
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
  fileExists: (path: string) => boolean = existsSync
): VerifiedCharacter[] {
  const seen = new Set<string>();
  const result: VerifiedCharacter[] = [];

  for (const entry of registry.entries) {
    if (entry.status !== 'completed') continue;
    if (entry.batchType !== 'B') continue;
    if (seen.has(entry.characterName)) continue;

    const absRef = resolve(repoRoot, entry.refImagePath);
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

export function usedThemeVoicePairs(
  registry: StickerRegistryFile,
  characterName: string
): Set<string> {
  const pairs = new Set<string>();
  for (const entry of registry.entries) {
    if (entry.characterName !== characterName) continue;
    if (entry.status === 'failed') continue;
    pairs.add(themeVoiceKey(entry.theme, entry.voice));
  }
  return pairs;
}

export function recentConcepts(registry: StickerRegistryFile, limit = 50): string[] {
  const concepts: string[] = [];
  for (let i = registry.entries.length - 1; i >= 0 && concepts.length < limit; i--) {
    const concept = registry.entries[i]!.characterConcept.trim();
    if (concept && !concepts.includes(concept)) {
      concepts.push(concept);
    }
  }
  return concepts;
}

export function inferCharacterNameFromPhraseSetName(name: string | undefined, folderName: string): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const beforeDot = trimmed.split('·')[0]?.trim();
    if (beforeDot && beforeDot.length <= 8) {
      return beforeDot;
    }
    return trimmed.slice(0, 8);
  }
  return folderName.replace(/[-_]/g, '').slice(0, 8) || '角色';
}

export function resolveRefImageInDir(outputDir: string): string | undefined {
  const candidates = [
    'character-ref.png',
    'reference-image.png',
    'reference-image.jpg',
    'reference-image.webp',
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
