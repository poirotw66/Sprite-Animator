import { describe, expect, it } from 'vitest';
import { parseRegistryJson } from './stickerRegistryFormat';
import { filterRegistryEntries, listCharacterProfiles, summarizeRegistry, toVaultAssetUrl, vaultRegistryFetchUrl } from './stickerRegistryView';

describe('stickerRegistryView', () => {
  it('builds vault asset URLs', () => {
    expect(toVaultAssetUrl('characters/fox/character-ref.webp', '/')).toBe(
      '/vault/characters/fox/character-ref.webp'
    );
    expect(vaultRegistryFetchUrl('/app/')).toBe('/app/vault/registry/sticker-registry.json');
  });

  it('summarizes registry counts', () => {
    const registry = parseRegistryJson(
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'SET-1',
            date: '2026-07-12',
            batchType: 'B',
            characterName: '狐',
            characterConcept: '橘狐',
            style: 'chibi',
            theme: 'meme',
            voice: 'nishimura',
            refImagePath: 'output/a/ref.png',
            outputDir: 'output/a',
            status: 'completed',
          },
          {
            id: 'SET-2',
            date: '2026-07-12',
            batchType: 'A',
            characterName: '狐',
            characterConcept: '橘狐',
            style: 'chibi',
            theme: 'daily',
            voice: 'penguin',
            refImagePath: 'output/a/ref.png',
            outputDir: 'output/b',
            status: 'planned',
          },
        ],
      })
    );
    const summary = summarizeRegistry(registry);
    expect(summary.total).toBe(2);
    expect(summary.bCount).toBe(1);
    expect(summary.aCount).toBe(1);
    expect(summary.completed).toBe(1);
    expect(summary.planned).toBe(1);
    expect(summary.characterCount).toBe(1);
  });

  it('filters by batch type and query', () => {
    const registry = parseRegistryJson(
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'SET-1',
            date: '2026-07-12',
            batchType: 'B',
            characterName: '舞棍狐',
            characterConcept: '街舞狐',
            style: 'chibi',
            theme: 'meme',
            voice: 'nishimura',
            refImagePath: 'output/x/ref.png',
            outputDir: 'output/x',
            status: 'completed',
          },
        ],
      })
    );
    const filtered = filterRegistryEntries(registry.entries, {
      batchType: 'B',
      status: 'all',
      date: 'all',
      query: '舞棍',
    });
    expect(filtered).toHaveLength(1);
  });

  it('dedupes character profiles from B entries', () => {
    const registry = parseRegistryJson(
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'SET-1',
            date: '2026-07-12',
            batchType: 'B',
            characterName: '舞棍狐',
            characterConcept: '街舞狐',
            style: 'chibi',
            theme: 'meme',
            voice: 'nishimura',
            refImagePath: 'output/x/ref.png',
            outputDir: 'output/x',
            status: 'completed',
          },
          {
            id: 'SET-2',
            date: '2026-07-13',
            batchType: 'A',
            characterName: '舞棍狐',
            characterConcept: '街舞狐',
            style: 'chibi',
            theme: 'daily',
            voice: 'penguin',
            refImagePath: 'output/x/ref.png',
            outputDir: 'output/y',
            status: 'completed',
          },
        ],
      })
    );
    const profiles = listCharacterProfiles(registry.entries);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].setCount).toBe(2);
    expect(profiles[0].themeVoicePairs).toEqual(['daily/penguin', 'meme/nishimura']);
  });
});
