import { describe, expect, it } from 'vitest';

import { emptyRegistry, upsertEntry, type StickerRegistryEntry } from './stickerRegistry';
import {
  deriveCharacterSlug,
  mergeRegistriesForPlanning,
  resolveRegistryAssetPath,
  isVaultRelativeAssetPath,
} from './stickerVault';

describe('stickerVault', () => {
  it('detects vault-relative asset paths', () => {
    expect(isVaultRelativeAssetPath('characters/fox/character-ref.webp')).toBe(true);
    expect(isVaultRelativeAssetPath('output/set-01/character-ref.png')).toBe(false);
  });

  it('resolves vault character refs against vault root', () => {
    const abs = resolveRegistryAssetPath(
      'characters/fox/character-ref.webp',
      '/repo',
      '/vault'
    );
    expect(abs.replace(/\\/g, '/')).toMatch(/\/vault\/characters\/fox\/character-ref\.webp$/);
  });

  it('resolves output refs against repo root', () => {
    const abs = resolveRegistryAssetPath('output/set-01/character-ref.png', '/repo', '/vault');
    expect(abs.replace(/\\/g, '/')).toMatch(/\/repo\/output\/set-01\/character-ref\.png$/);
  });

  it('derives slug from descriptive folder names', () => {
    expect(deriveCharacterSlug('狐耳舞棍', 'street-graffiti-fox-character', 'SET-20260712-001')).toBe(
      'street-graffiti-fox'
    );
  });

  it('falls back to set id slug for generic set-NN folders', () => {
    expect(deriveCharacterSlug('舞棍狐', 'set-03', 'SET-20260712-003')).toBe('char-20260712-003');
  });

  it('merges vault and local registries with local winning on id conflict', () => {
    const vaultEntry: StickerRegistryEntry = {
      id: 'SET-20260701-001',
      date: '2026-07-01',
      batchType: 'B',
      characterName: 'VaultFox',
      characterConcept: 'from vault',
      style: 'chibi',
      theme: 'meme',
      voice: 'nishimura',
      refImagePath: 'characters/vault-fox/character-ref.webp',
      outputDir: 'sets/SET-20260701-001',
      status: 'completed',
    };
    const localEntry: StickerRegistryEntry = {
      ...vaultEntry,
      characterName: 'LocalFox',
      refImagePath: 'output/old/set-01/character-ref.png',
      outputDir: 'output/old/set-01',
    };

    const merged = mergeRegistriesForPlanning(
      upsertEntry(emptyRegistry(), localEntry),
      upsertEntry(emptyRegistry(), vaultEntry)
    );
    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0]!.characterName).toBe('LocalFox');
  });
});
