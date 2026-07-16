/**
 * Browser-safe daily batch plan types and JSON parsing.
 */

import type { StickerBatchType } from './registry/stickerRegistryFormat';

export interface DailyPackPlanSlot {
  slotIndex: number;
  id: string;
  date: string;
  batchType: StickerBatchType;
  theme: string;
  voice: string;
  style: string;
  characterName?: string;
  characterConcept?: string;
  refImagePath?: string;
  outputDir: string;
  downgradedFromA?: boolean;
}

export interface DailyPackPlanFile {
  date: string;
  count: number;
  ratio: string;
  bSlots: number;
  aSlots: number;
  slots: DailyPackPlanSlot[];
  warnings: string[];
}

export function parseBatchPlanJson(raw: string): DailyPackPlanFile {
  const parsed = JSON.parse(raw) as Partial<DailyPackPlanFile>;
  if (!parsed || !Array.isArray(parsed.slots)) {
    throw new Error('Invalid batch-plan.json format');
  }
  return {
    date: parsed.date ?? '',
    count: parsed.count ?? parsed.slots.length,
    ratio: parsed.ratio ?? '2:1',
    bSlots: parsed.bSlots ?? 0,
    aSlots: parsed.aSlots ?? 0,
    slots: parsed.slots,
    warnings: parsed.warnings ?? [],
  };
}
