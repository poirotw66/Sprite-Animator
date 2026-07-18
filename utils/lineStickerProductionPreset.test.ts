import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LINE_STICKER_PRODUCTION_PRESET,
  productionStickerResolutionForModel,
} from './lineStickerProductionPreset';

describe('LINE sticker production preset', () => {
  it('uses deterministic production defaults', () => {
    expect(LINE_STICKER_PRODUCTION_PRESET).toMatchObject({
      model: 'gemini-3.1-flash-image',
      resolution: '2K',
      chromaKeyColor: 'auto',
      chromaKeyAlgorithm: 'core',
      textRendering: 'programmatic',
      programmaticCompose: { enabled: true },
      maxSheetRetries: 3,
      extraSheetRegenAttempts: 0,
      minGridAlignmentScore: 0.8,
      styleAnchorFromPriorSheet: true,
      gridTemplate: 'guided',
    });
  });

  it('falls back when a model does not support 2K', () => {
    expect(productionStickerResolutionForModel('gemini-3.1-flash-image')).toBe('2K');
    expect(productionStickerResolutionForModel('gemini-3.1-flash-lite-image')).toBe('1K');
  });

  it.each([
    '.claude/skills/line-sticker-maker/config.example.json',
    '.claude/skills/line-sticker-maker/examples/demo-job.config.json',
  ])('keeps %s aligned with the preset', (relativePath) => {
    const examplePath = resolve(process.cwd(), relativePath);
    const example = JSON.parse(readFileSync(examplePath, 'utf8'));
    expect(example).toMatchObject({
      model: LINE_STICKER_PRODUCTION_PRESET.model,
      resolution: LINE_STICKER_PRODUCTION_PRESET.resolution,
      chromaKeyColor: LINE_STICKER_PRODUCTION_PRESET.chromaKeyColor,
      chromaKeyAlgorithm: LINE_STICKER_PRODUCTION_PRESET.chromaKeyAlgorithm,
      includeText: LINE_STICKER_PRODUCTION_PRESET.includeText,
      textRendering: LINE_STICKER_PRODUCTION_PRESET.textRendering,
      fontKey: LINE_STICKER_PRODUCTION_PRESET.fontKey,
      textColorKey: LINE_STICKER_PRODUCTION_PRESET.textColorKey,
      programmaticCompose: LINE_STICKER_PRODUCTION_PRESET.programmaticCompose,
      maxSheetRetries: LINE_STICKER_PRODUCTION_PRESET.maxSheetRetries,
      extraSheetRegenAttempts: LINE_STICKER_PRODUCTION_PRESET.extraSheetRegenAttempts,
      minGridAlignmentScore: LINE_STICKER_PRODUCTION_PRESET.minGridAlignmentScore,
      promptVersion: LINE_STICKER_PRODUCTION_PRESET.promptVersion,
      styleAnchorFromPriorSheet: LINE_STICKER_PRODUCTION_PRESET.styleAnchorFromPriorSheet,
      gridTemplate: LINE_STICKER_PRODUCTION_PRESET.gridTemplate,
      qaEnabled: LINE_STICKER_PRODUCTION_PRESET.qaEnabled,
      qaMode: LINE_STICKER_PRODUCTION_PRESET.qaMode,
      lineUploadSubmit: LINE_STICKER_PRODUCTION_PRESET.lineUploadSubmit,
    });
    expect(existsSync(resolve(dirname(examplePath), example.phraseSetFile))).toBe(true);
  });
});
