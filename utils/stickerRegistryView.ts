/**
 * Pure helpers for the sticker registry viewer UI.
 */

import type { StickerBatchType, StickerRegistryEntry, StickerRegistryFile, StickerRegistryStatus } from './stickerRegistryFormat';

export interface RegistrySummary {
  total: number;
  bCount: number;
  aCount: number;
  completed: number;
  planned: number;
  failed: number;
  characterCount: number;
  dates: string[];
}

export interface RegistryFilter {
  batchType: StickerBatchType | 'all';
  status: StickerRegistryStatus | 'all';
  date: string | 'all';
  query: string;
}

export function summarizeRegistry(registry: StickerRegistryFile): RegistrySummary {
  const characters = new Set<string>();
  let bCount = 0;
  let aCount = 0;
  let completed = 0;
  let planned = 0;
  let failed = 0;
  const dateSet = new Set<string>();

  for (const entry of registry.entries) {
    if (entry.batchType === 'B') bCount++;
    else aCount++;
    if (entry.status === 'completed') completed++;
    else if (entry.status === 'planned') planned++;
    else if (entry.status === 'failed') failed++;
    if (entry.characterName.trim()) characters.add(entry.characterName);
    if (entry.date) dateSet.add(entry.date);
  }

  const dates = [...dateSet].sort((a, b) => b.localeCompare(a));
  return {
    total: registry.entries.length,
    bCount,
    aCount,
    completed,
    planned,
    failed,
    characterCount: characters.size,
    dates,
  };
}

export function filterRegistryEntries(
  entries: StickerRegistryEntry[],
  filter: RegistryFilter
): StickerRegistryEntry[] {
  const q = filter.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filter.batchType !== 'all' && entry.batchType !== filter.batchType) return false;
    if (filter.status !== 'all' && entry.status !== filter.status) return false;
    if (filter.date !== 'all' && entry.date !== filter.date) return false;
    if (!q) return true;
    const haystack = [
      entry.id,
      entry.characterName,
      entry.characterConcept,
      entry.theme,
      entry.voice,
      entry.style,
      entry.outputDir,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Build a dev-server URL for files under output/ (local vite middleware). */
export function toOutputAssetUrl(relPath: string): string {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\//, '');
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (normalized.startsWith('output/')) {
    return `${base}/${normalized}`;
  }
  return `${base}/output/${normalized}`;
}

export function stickerPreviewPath(outputDir: string): string {
  const dir = outputDir.replace(/\\/g, '/').replace(/\/$/, '');
  return `${dir}/stickers/sticker-01.png`;
}

export function phraseSetPath(outputDir: string): string {
  const dir = outputDir.replace(/\\/g, '/').replace(/\/$/, '');
  return `${dir}/phrase-set.json`;
}

export interface CharacterProfile {
  characterName: string;
  characterConcept: string;
  style: string;
  refImagePath: string;
  originEntryId: string;
  batchType: 'B';
  setCount: number;
  themeVoicePairs: string[];
}

/** One card per character (canonical B entry per characterName). */
export function listCharacterProfiles(entries: StickerRegistryEntry[]): CharacterProfile[] {
  const byName = new Map<string, StickerRegistryEntry>();
  const usage = new Map<string, { count: number; pairs: Set<string> }>();

  for (const entry of entries) {
    const name = entry.characterName.trim() || entry.id;
    if (!usage.has(name)) {
      usage.set(name, { count: 0, pairs: new Set() });
    }
    const bucket = usage.get(name)!;
    bucket.count++;
    bucket.pairs.add(`${entry.theme}/${entry.voice}`);

    if (entry.batchType !== 'B') continue;
    const existing = byName.get(name);
    if (!existing || entry.status === 'completed') {
      byName.set(name, entry);
    }
  }

  const profiles: CharacterProfile[] = [];
  for (const [name, entry] of byName) {
    const bucket = usage.get(name)!;
    profiles.push({
      characterName: name,
      characterConcept: entry.characterConcept,
      style: entry.style,
      refImagePath: entry.refImagePath,
      originEntryId: entry.id,
      batchType: 'B',
      setCount: bucket.count,
      themeVoicePairs: [...bucket.pairs].sort(),
    });
  }

  return profiles.sort((a, b) => a.characterName.localeCompare(b.characterName, 'zh-Hant'));
}

export function filterCharacterProfiles(
  profiles: CharacterProfile[],
  query: string
): CharacterProfile[] {
  const q = query.trim().toLowerCase();
  if (!q) return profiles;
  return profiles.filter((p) => {
    const haystack = [p.characterName, p.characterConcept, p.style, p.refImagePath]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
