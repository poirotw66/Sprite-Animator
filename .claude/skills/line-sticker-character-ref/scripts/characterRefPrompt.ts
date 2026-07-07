/**
 * Prompt builder for character model-sheet reference images.
 */

import {
  STYLE_PRESETS,
  STYLE_PRESET_ORDER,
  type LineStickerStyleOption,
} from '../../../../utils/lineStickerPresets.ts';

export function listStyleKeys(): string[] {
  return STYLE_PRESET_ORDER.filter((key) => key !== 'matchUploaded');
}

export function resolveStyleBlock(styleKey: string, customStyle?: string): string {
  if (customStyle?.trim()) {
    return customStyle.trim();
  }
  const preset = STYLE_PRESETS[styleKey as LineStickerStyleOption];
  if (!preset) {
    throw new Error(
      `Unknown style "${styleKey}". Choose: ${listStyleKeys().join(', ')}, or pass --style-context "..."`
    );
  }
  return `${preset.styleType}\n${preset.drawingMethod}`;
}

export function buildCharacterRefPrompt(params: {
  concept: string;
  styleKey: string;
  customStyle?: string;
  characterName?: string;
}): string {
  const { concept, styleKey, customStyle, characterName } = params;
  const styleBlock = resolveStyleBlock(styleKey, customStyle);
  const title = characterName?.trim() ? `${characterName.trim()} model sheet` : 'Character model sheet';

  return `Generate ONE character reference model sheet image (${title}) for LINE sticker production.

### [Layout reference — structure only]
The attached layout image is a **panel arrangement reference** (turnaround + expressions + detail insets).
- Copy ONLY the **sheet layout** (panel types and rough composition).
- Do **NOT** copy the species, colors, or exact design from the layout reference.
- Invent a **new original character** from the Concept below.

### [Character concept]
${concept.trim()}

### [Art style]
${styleBlock}

### [Required panels — one sheet]
1. **Full-body turnaround** (top row): front view, side view, back view — same character, standing, consistent proportions.
2. **Expression headshots** (4): e.g. joyful laugh, worried/confused, content/peaceful, sleepy/comfortable — bust or head only.
3. **Detail row**:
   - Close-up front face (smiling or signature expression)
   - Full-body lying-down / relaxed pose
   - One **feature detail inset** (paw pads, tail, accessory, or species-specific detail in a circle)
   - Optional small vignette showing personality (cozy scene, duo pose, or prop) if space allows

### [Background & presentation]
- Clean warm off-white or cream paper-like background (like a design spec sheet).
- Soft hand-drawn illustration feel; cohesive palette across all panels.
- Optional short Traditional Chinese labels for panels are OK; keep text minimal and legible.
- No watermark, no UI chrome, no photorealism.

### [Rules]
- One original character only (unless concept explicitly says duo).
- Consistent design across every panel — same face, fur/skin tone, outfit, proportions.
- Suitable as **reference image** for later LINE sticker sprite-sheet generation.
- Square 1:1 composition; all panels fit inside one image.

Output exactly **one** finished model-sheet image.`;
}
