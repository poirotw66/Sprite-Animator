/**
 * Prompt builder for character model-sheet reference images.
 * Layout is always described in text — never via an attached layout PNG.
 */

import {
  STYLE_PRESETS,
  STYLE_PRESET_ORDER,
  type LineStickerStyleOption,
} from './lineStickerPresets';

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

/** Text-only panel arrangement for model sheets (no layout image attachment). */
export const CHARACTER_REF_SHEET_LAYOUT_TEXT = `### [Sheet layout — text only]
Arrange panels on a square 1:1 canvas:
1. **Full-body turnaround** (top row): front view, side view, back view — same character, standing, consistent proportions.
2. **Expression headshots** (4): distinct readable expressions (e.g. joyful laugh, worried/confused, content/peaceful, sleepy/comfortable) — bust or head only.
3. **Detail row**:
   - Close-up front face (smiling or signature expression)
   - Full-body lying-down or relaxed pose
   - One **outfit or accessory detail inset** in a circle (e.g. tie pattern, shoes, emblem — match the character)
   - Optional small personality vignette (cozy prop or scene) if space allows`;

export function buildCharacterRefPrompt(params: {
  concept: string;
  styleKey: string;
  customStyle?: string;
  characterName?: string;
  hasIdentityReference?: boolean;
  purpose?: 'line-sticker' | 'comic';
}): string {
  const {
    concept,
    styleKey,
    customStyle,
    characterName,
    hasIdentityReference = false,
    purpose = 'line-sticker',
  } = params;
  const styleBlock = resolveStyleBlock(styleKey, customStyle);
  const title = characterName?.trim() ? `${characterName.trim()} model sheet` : 'Character model sheet';
  const productLabel = purpose === 'comic' ? 'a one-page comic' : 'LINE sticker production';
  const conceptText = concept.trim();

  const identityBlock = hasIdentityReference
    ? `### [Identity reference — appearance lock]
The attached image is the user's character. Match **species, face, colors, outfit, and proportions** from that image exactly.
- Do **NOT** substitute a different species or generic mascot (e.g. otter, cat) unless the upload is that species.
- Apply the Art style below while preserving identity.`
    : `### [Character concept — invent from text]
Invent the character **only** from the Concept below.
- Do **NOT** default to otter, cat, or any stock mascot from training bias.`;

  const conceptSection = conceptText
    ? `### [Character concept]\n${conceptText}`
    : hasIdentityReference
      ? `### [Character concept]
(Derive appearance entirely from the attached identity image.)`
      : `### [Character concept]
(Missing — describe the character in --concept.)`;

  return `Generate ONE character reference model sheet image (${title}) for ${productLabel}.

${identityBlock}

${conceptSection}

${CHARACTER_REF_SHEET_LAYOUT_TEXT}

### [Art style]
${styleBlock}

### [Background & presentation]
- Clean warm off-white or cream paper-like background (like a design spec sheet).
- Soft hand-drawn illustration feel; cohesive palette across all panels.
- Optional short Traditional Chinese labels for panels are OK; keep text minimal and legible.
- No watermark, no UI chrome, no photorealism.

### [Rules]
- One character only (unless concept explicitly says duo).
- **Every panel shows the same character only** — no extra animals, mascots, or unrelated characters.
- Consistent design across every panel — same face, skin/fur tone, outfit, proportions.
- Suitable as **reference image** for later sprite-sheet generation.
- Square 1:1 composition; all panels fit inside one image.

Output exactly **one** finished model-sheet image.`;
}

/** @deprecated alias — comic web flow uses the same text-only layout. */
export function buildComicCharacterRefPrompt(params: {
  concept: string;
  styleKey: string;
  customStyle?: string;
  hasIdentityReference: boolean;
}): string {
  return buildCharacterRefPrompt({
    concept: params.concept,
    styleKey: params.styleKey,
    customStyle: params.customStyle,
    hasIdentityReference: params.hasIdentityReference,
    purpose: 'comic',
  });
}
