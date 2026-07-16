/**
 * Plan daily sticker pack slots (B new characters + A theme rotation).
 */

import {
  DAILY_PACK_STYLE_KEYS,
  DAILY_PACK_THEME_KEYS,
  DAILY_PACK_VOICE_KEYS,
  splitBatchCounts,
  type DailyPackStyleKey,
  type DailyPackThemeKey,
  type DailyPackVoiceKey,
} from './dailyPackPresets';
import {
  formatSetId,
  listVerifiedCharacters,
  recentConcepts,
  themeVoiceKey,
  usedThemeVoicePairs,
  type StickerRegistryFile,
  type StickerBatchType,
} from './registry/stickerRegistry';

export interface DailyPackSlot {
  slotIndex: number;
  id: string;
  date: string;
  batchType: StickerBatchType;
  theme: DailyPackThemeKey;
  voice: DailyPackVoiceKey;
  style: DailyPackStyleKey;
  characterName?: string;
  characterConcept?: string;
  refImagePath?: string;
  outputDir: string;
  downgradedFromA?: boolean;
}

export interface DailyPackPlan {
  date: string;
  count: number;
  ratio: string;
  bSlots: number;
  aSlots: number;
  slots: DailyPackSlot[];
  warnings: string[];
}

export interface PlanDailyPackParams {
  date: string;
  count?: number;
  ratio?: string;
  registry: StickerRegistryFile;
  repoRoot: string;
  outputBaseRel?: string;
  vaultRoot?: string;
  rng?: () => number;
  fileExists?: (path: string) => boolean;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function pickUnusedPair(
  themes: DailyPackThemeKey[],
  voices: DailyPackVoiceKey[],
  used: Set<string>,
  rng: () => number
): { theme: DailyPackThemeKey; voice: DailyPackVoiceKey } | undefined {
  const pairs: Array<{ theme: DailyPackThemeKey; voice: DailyPackVoiceKey }> = [];
  for (const theme of themes) {
    for (const voice of voices) {
      const key = themeVoiceKey(theme, voice);
      if (!used.has(key)) {
        pairs.push({ theme, voice });
      }
    }
  }
  if (pairs.length === 0) return undefined;
  return pairs[Math.floor(rng() * pairs.length)]!;
}

function pickStyle(styles: DailyPackStyleKey[], index: number): DailyPackStyleKey {
  return styles[index % styles.length]!;
}

export function planDailyPack(params: PlanDailyPackParams): DailyPackPlan {
  const count = params.count ?? 30;
  const ratio = params.ratio ?? '2:1';
  const rng = params.rng ?? Math.random;
  const outputBase = params.outputBaseRel ?? `output/${params.date}`;
  const warnings: string[] = [];

  const { bSlots, aSlots } = splitBatchCounts(count, ratio);
  const themes = shuffle([...DAILY_PACK_THEME_KEYS], rng);
  const voices = shuffle([...DAILY_PACK_VOICE_KEYS], rng);
  const styles = shuffle([...DAILY_PACK_STYLE_KEYS], rng);

  const batchUsedPairs = new Set<string>();
  const verified = listVerifiedCharacters(
    params.registry,
    params.repoRoot,
    params.fileExists,
    params.vaultRoot
  );
  const excludeConcepts = recentConcepts(params.registry, 50);

  const slots: DailyPackSlot[] = [];

  for (let slotIndex = 1; slotIndex <= count; slotIndex++) {
    const batchType: StickerBatchType = slotIndex <= bSlots ? 'B' : 'A';

    const pair = pickUnusedPair(themes, voices, batchUsedPairs, rng);
    if (!pair) {
      warnings.push(`Slot ${slotIndex}: no unused theme+voice pair left in batch`);
      break;
    }
    batchUsedPairs.add(themeVoiceKey(pair.theme, pair.voice));

    const outputDir = `${outputBase}/set-${String(slotIndex).padStart(2, '0')}`;
    const style = pickStyle(styles, slotIndex - 1);

    if (batchType === 'B') {
      slots.push({
        slotIndex,
        id: formatSetId(params.date, slotIndex),
        date: params.date,
        batchType: 'B',
        theme: pair.theme,
        voice: pair.voice,
        style,
        outputDir,
      });
      continue;
    }

    const character = verified[Math.floor(rng() * verified.length)];
    if (!character) {
      warnings.push(`Slot ${slotIndex}: no verified B characters — downgrading A to B`);
      slots.push({
        slotIndex,
        id: formatSetId(params.date, slotIndex),
        date: params.date,
        batchType: 'B',
        theme: pair.theme,
        voice: pair.voice,
        style,
        outputDir,
        downgradedFromA: true,
      });
      continue;
    }

    const usedForCharacter = usedThemeVoicePairs(params.registry, character.characterName);
    for (const key of batchUsedPairs) {
      usedForCharacter.add(key);
    }

    const aPair = pickUnusedPair(themes, voices, usedForCharacter, rng);
    if (!aPair) {
      warnings.push(
        `Slot ${slotIndex}: character "${character.characterName}" has no unused theme+voice — downgrading to B`
      );
      slots.push({
        slotIndex,
        id: formatSetId(params.date, slotIndex),
        date: params.date,
        batchType: 'B',
        theme: pair.theme,
        voice: pair.voice,
        style,
        outputDir,
        downgradedFromA: true,
      });
      continue;
    }

    batchUsedPairs.add(themeVoiceKey(aPair.theme, aPair.voice));
    slots.push({
      slotIndex,
      id: formatSetId(params.date, slotIndex),
      date: params.date,
      batchType: 'A',
      theme: aPair.theme,
      voice: aPair.voice,
      style: character.style as DailyPackStyleKey,
      characterName: character.characterName,
      characterConcept: character.characterConcept,
      refImagePath: character.refImagePath,
      outputDir,
    });
  }

  void excludeConcepts;

  return {
    date: params.date,
    count,
    ratio,
    bSlots,
    aSlots,
    slots,
    warnings,
  };
}
