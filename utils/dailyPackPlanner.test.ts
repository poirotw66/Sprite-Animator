import { describe, expect, it } from 'vitest';

import { splitBatchCounts } from './dailyPackPresets';
import { planDailyPack } from './dailyPackPlanner';
import { emptyRegistry, type StickerRegistryEntry, upsertEntry } from './registry/stickerRegistry';

describe('dailyPackPresets.splitBatchCounts', () => {
  it('splits 30 sets with 2:1 ratio into 20 B and 10 A', () => {
    expect(splitBatchCounts(30, '2:1')).toEqual({ bSlots: 20, aSlots: 10 });
  });
});

describe('planDailyPack', () => {
  const repoRoot = '/repo';
  const date = '2026-07-12';
  const fileExists = () => true;

  function seedRegistry(): ReturnType<typeof emptyRegistry> {
    let registry = emptyRegistry();
    const entry: StickerRegistryEntry = {
      id: 'SET-20260701-001',
      date: '2026-07-01',
      batchType: 'B',
      characterName: '舞棍狐',
      characterConcept: '圓潤橘色狐狸，街頭塗鴉風',
      style: 'chibi',
      theme: 'meme',
      voice: 'nishimura',
      refImagePath: 'output/old/set-01/character-ref.png',
      outputDir: 'output/old/set-01',
      status: 'completed',
    };
    registry = upsertEntry(registry, entry);
    return registry;
  }

  it('creates 20 B and 10 A slots for count 30', () => {
    const plan = planDailyPack({
      date,
      count: 30,
      ratio: '2:1',
      registry: seedRegistry(),
      repoRoot,
      rng: () => 0,
      fileExists,
    });

    const bCount = plan.slots.filter((s) => s.batchType === 'B').length;
    const aCount = plan.slots.filter((s) => s.batchType === 'A').length;
    expect(bCount).toBe(20);
    expect(aCount).toBe(10);
    expect(plan.slots).toHaveLength(30);
  });

  it('avoids duplicate theme+voice pairs within the same batch', () => {
    const plan = planDailyPack({
      date,
      count: 30,
      ratio: '2:1',
      registry: seedRegistry(),
      repoRoot,
      rng: () => 0.3,
      fileExists,
    });

    const keys = plan.slots.map((s) => `${s.theme}::${s.voice}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('downgrades A slots to B when no verified characters exist', () => {
    const plan = planDailyPack({
      date,
      count: 3,
      ratio: '1:2',
      registry: emptyRegistry(),
      repoRoot,
      rng: () => 0.5,
    });

    expect(plan.slots.every((s) => s.batchType === 'B')).toBe(true);
    expect(plan.warnings.some((w) => w.includes('downgrading'))).toBe(true);
  });

  it('plans A slots from vault character refs', () => {
    const vaultEntry: StickerRegistryEntry = {
      id: 'SET-20260701-001',
      date: '2026-07-01',
      batchType: 'B',
      characterName: 'VaultFox',
      characterConcept: '圓潤狐狸',
      style: 'chibi',
      theme: 'meme',
      voice: 'nishimura',
      refImagePath: 'characters/vault-fox/character-ref.webp',
      outputDir: 'sets/SET-20260701-001',
      status: 'completed',
    };

    const plan = planDailyPack({
      date,
      count: 3,
      ratio: '1:2',
      registry: upsertEntry(emptyRegistry(), vaultEntry),
      repoRoot,
      vaultRoot: '/vault',
      rng: () => 0,
      fileExists: (path) => path.replace(/\\/g, '/').endsWith('characters/vault-fox/character-ref.webp'),
    });

    const aSlots = plan.slots.filter((s) => s.batchType === 'A');
    expect(aSlots.length).toBeGreaterThan(0);
    expect(aSlots[0]!.refImagePath).toBe('characters/vault-fox/character-ref.webp');
  });
});
