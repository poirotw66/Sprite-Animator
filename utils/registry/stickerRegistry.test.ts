import { describe, expect, it } from 'vitest';

import { parseCharacterConceptResponse } from '../../services/gemini/characterConcept';
import {
  formatSetId,
  parseRegistryJson,
  themeVoiceKey,
  upsertEntry,
  emptyRegistry,
} from './stickerRegistry';

describe('stickerRegistry', () => {
  it('formats set ids with zero-padded slot index', () => {
    expect(formatSetId('2026-07-12', 1)).toBe('SET-20260712-001');
    expect(formatSetId('2026-07-12', 21)).toBe('SET-20260712-021');
  });

  it('parses registry json', () => {
    const raw = JSON.stringify({ version: 1, entries: [] });
    expect(parseRegistryJson(raw).entries).toEqual([]);
  });

  it('builds theme+voice keys', () => {
    expect(themeVoiceKey('meme', 'nishimura')).toBe('meme::nishimura');
  });

  it('upserts without duplicating ids', () => {
    let registry = emptyRegistry();
    registry = upsertEntry(registry, {
      id: 'SET-20260712-001',
      date: '2026-07-12',
      batchType: 'B',
      characterName: '舞棍狐',
      characterConcept: '橘色狐狸',
      style: 'chibi',
      theme: 'meme',
      voice: 'nishimura',
      refImagePath: 'output/x/ref.png',
      outputDir: 'output/x',
      status: 'completed',
    });
    registry = upsertEntry(registry, {
      ...registry.entries[0]!,
      status: 'failed',
    });
    expect(registry.entries).toHaveLength(1);
    expect(registry.entries[0]!.status).toBe('failed');
  });
});

describe('parseCharacterConceptResponse', () => {
  it('parses strict JSON', () => {
    const result = parseCharacterConceptResponse(
      '{"characterName":"舞棍狐","characterConcept":"圓潤橘色狐狸，愛跳街舞"}'
    );
    expect(result).toEqual({
      characterName: '舞棍狐',
      characterConcept: '圓潤橘色狐狸，愛跳街舞',
    });
  });
});
