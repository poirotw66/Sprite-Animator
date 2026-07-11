/**
 * Re-slice a processed sheet and re-apply programmatic text overlay (no Gemini).
 *
 *   npx tsx reoverlay-sheet.mts <sheet-dir> [cols] [rows] [--phrases path.json] [--offset N]
 *   npx tsx reoverlay-sheet.mts <sheet-dir> 4 5 --font-size 14
 *
 * Tuning: reads ../job.config.json programmaticTextTuning; --font-size overrides fontSizePercent.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  mergeProgrammaticComposeConfig,
  mergeProgrammaticTextTuning,
  type ProgrammaticComposeConfig,
  type ProgrammaticTextOverlayTuning,
} from '../../../../utils/lineStickerTextOverlayTypes.ts';
import { FONT_PRESETS, TEXT_COLOR_PRESETS } from '../../../../utils/lineStickerPrompt.ts';
import {
  decodeImage,
  encodePng,
  sliceSheet,
} from './nodeImage.mts';
import { buildEqualGridBounds } from '../../../../utils/gridSheetTemplate.ts';
import { composePhraseOnRgbaFrame, overlayPhraseOnRgbaFrame } from './programmaticTextOverlay.mts';
import { shouldUseComposeLayout } from '../../../../utils/lineStickerCompose.ts';
import { trimFrameToContent } from '../../../../utils/sheetComponentSlicer.ts';
import { loadSheetPhrases } from '../../../../utils/lineStickerSheetPhrases.ts';

const argv = process.argv.slice(2);
const sheetDir = resolve(argv[0] ?? '');
const cols = Number(argv[1] ?? 4);
const rows = Number(argv[2] ?? 5);
let phrasesPath = '';
let phraseOffset = 0;
let phraseOffsetExplicit = false;
let fontSizePercent: number | undefined;
let jobConfigPath = '';

for (let i = 3; i < argv.length; i++) {
  if (argv[i] === '--phrases' && argv[i + 1]) {
    phrasesPath = argv[++i]!;
  } else if (argv[i] === '--offset' && argv[i + 1]) {
    phraseOffset = Number.parseInt(argv[++i]!, 10);
    phraseOffsetExplicit = true;
  } else if (argv[i] === '--font-size' && argv[i + 1]) {
    fontSizePercent = Number.parseFloat(argv[++i]!);
  } else if (argv[i] === '--job-config' && argv[i + 1]) {
    jobConfigPath = argv[++i]!;
  }
}

if (!sheetDir) {
  console.error(
    'Usage: reoverlay-sheet.mts <sheet-dir> [cols] [rows] [--phrases phrases.json] [--offset N] [--font-size N] [--job-config path]'
  );
  process.exit(1);
}

const processedPath = resolve(sheetDir, '_processed-sheet.png');
if (!existsSync(processedPath)) {
  throw new Error(`Missing ${processedPath}`);
}

async function loadOverlayConfig(): Promise<{
  tuning: ProgrammaticTextOverlayTuning;
  compose: ProgrammaticComposeConfig;
  fontKey: keyof typeof FONT_PRESETS;
  textColorKey: keyof typeof TEXT_COLOR_PRESETS;
}> {
  const configPath = jobConfigPath
    ? resolve(jobConfigPath)
    : resolve(sheetDir, '..', 'job.config.json');
  let partial: Partial<ProgrammaticTextOverlayTuning> | undefined;
  let composePartial: Partial<ProgrammaticComposeConfig> | undefined;
  let fontKey: keyof typeof FONT_PRESETS = 'round';
  let textColorKey: keyof typeof TEXT_COLOR_PRESETS = 'black';
  if (existsSync(configPath)) {
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      programmaticTextTuning?: Partial<ProgrammaticTextOverlayTuning>;
      programmaticCompose?: Partial<ProgrammaticComposeConfig>;
      fontKey?: keyof typeof FONT_PRESETS;
      textColorKey?: keyof typeof TEXT_COLOR_PRESETS;
    };
    partial = config.programmaticTextTuning;
    composePartial = config.programmaticCompose;
    if (config.fontKey) {
      fontKey = config.fontKey;
    }
    if (config.textColorKey) {
      textColorKey = config.textColorKey;
    }
    if (fontSizePercent != null) {
      partial = { ...partial, fontSizePercent };
    }
    return {
      tuning: mergeProgrammaticTextTuning(partial),
      compose: mergeProgrammaticComposeConfig(composePartial),
      fontKey,
      textColorKey,
    };
  }
  return {
    tuning: mergeProgrammaticTextTuning(
      fontSizePercent != null ? { fontSizePercent } : undefined
    ),
    compose: mergeProgrammaticComposeConfig(),
    fontKey,
    textColorKey,
  };
}

let phrases: string[] = await loadSheetPhrases({
  sheetDir,
  cols,
  rows,
  phraseOffset: phraseOffsetExplicit ? phraseOffset : undefined,
  explicitPhrasesPath: phrasesPath || undefined,
  jobConfigPath: jobConfigPath || undefined,
});

const { tuning, compose, fontKey, textColorKey } = await loadOverlayConfig();
console.log(
  `Programmatic tuning: fontSizePercent=${tuning.fontSizePercent}` +
    ` | font=${fontKey} | color=${textColorKey}` +
    (compose.enabled ? ` | compose=${compose.layout ?? 'top_caption_bottom_subject'}` : '')
);

const image = decodeImage(new Uint8Array(await readFile(processedPath)));
const useGuided = existsSync(resolve(sheetDir, '_grid-template-guided.png'));
const templateBounds = buildEqualGridBounds(image.width, cols, rows);

let frames = sliceSheet(image, cols, rows, {
  sliceMode: useGuided ? 'template' : 'divider',
  guidedContentCrop: useGuided,
  templateBounds: useGuided ? templateBounds : undefined,
});

frames = frames.map((frame, i) => {
  const phrase = phrases[i] ?? '';
  const frameIndex = phraseOffset + i;
  const overlaid = compose.enabled
    ? composePhraseOnRgbaFrame(frame, phrase, {
        frameIndex,
        tuning,
        compose,
        fontKey,
        colorKey: textColorKey,
      })
    : overlayPhraseOnRgbaFrame(frame, phrase, {
        frameIndex,
        tuning,
        fontKey,
        colorKey: textColorKey,
      });
  if (!compose.enabled) {
    return trimFrameToContent(overlaid);
  }
  if (compose.trimAfterCompose) {
    if (shouldUseComposeLayout(compose, phrase)) {
      return overlaid;
    }
    return trimFrameToContent(overlaid);
  }
  if (shouldUseComposeLayout(compose, phrase)) {
    return overlaid;
  }
  return trimFrameToContent(overlaid);
});

for (let i = 0; i < frames.length; i++) {
  const name = `sticker-${String(i + 1).padStart(2, '0')}.png`;
  await writeFile(resolve(sheetDir, name), encodePng(frames[i]!));
  console.log(`  ✓ ${name}`);
}

console.log(`Re-overlaid ${frames.length} stickers in ${sheetDir}`);
