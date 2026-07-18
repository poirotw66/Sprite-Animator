import {
  DEFAULT_SKILL_STICKER_MODEL,
  MODEL_RESOLUTIONS,
  type ImageResolution,
} from './constants';

/** Canonical defaults for the headless LINE sticker production workflow. */
export const LINE_STICKER_PRODUCTION_PRESET = {
  model: DEFAULT_SKILL_STICKER_MODEL,
  resolution: '2K' as ImageResolution,
  chromaKeyColor: 'green' as const,
  chromaKeyAlgorithm: 'core' as const,
  includeText: true,
  textRendering: 'programmatic' as const,
  fontKey: 'round' as const,
  textColorKey: 'black' as const,
  programmaticCompose: { enabled: true } as const,
  maxSheetRetries: 3,
  extraSheetRegenAttempts: 0,
  minGridAlignmentScore: 0.8,
  promptVersion: 'v3compact' as const,
  styleAnchorFromPriorSheet: true,
  gridTemplate: 'guided' as const,
  qaEnabled: true,
  lineUploadSubmit: false,
} as const;

/** Prefer the production resolution when supported, otherwise use the model's first valid size. */
export function productionStickerResolutionForModel(model: string): ImageResolution {
  const allowed = MODEL_RESOLUTIONS[model] ?? ['1K'];
  return allowed.includes(LINE_STICKER_PRODUCTION_PRESET.resolution)
    ? LINE_STICKER_PRODUCTION_PRESET.resolution
    : (allowed[0] as ImageResolution);
}
