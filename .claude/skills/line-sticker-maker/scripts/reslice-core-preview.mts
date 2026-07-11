/**
 * Preview a chroma algorithm on an existing sheet without overwriting originals.
 *
 *   npx tsx reslice-core-preview.mts <sheet-dir> [cols] [rows] [algorithm]
 *
 * algorithm: core | legacy | forge (default from job config or legacy)
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decodeImage,
  encodePng,
  processSheetChromaKey,
  sliceSheet,
} from './nodeImage.mts';
import { buildEqualGridBounds } from '../../../../utils/gridSheetTemplate.ts';
import { composePhrasesOnRgbaFrames } from './programmaticTextOverlay.mts';
import { trimFrameToContent } from '../../../../utils/sheetComponentSlicer.ts';
import { loadSheetPhrases } from '../../../../utils/lineStickerSheetPhrases.ts';
import {
  mergeProgrammaticComposeConfig,
  mergeProgrammaticTextTuning,
} from '../../../../utils/lineStickerTextOverlayTypes.ts';
import { FONT_PRESETS, TEXT_COLOR_PRESETS } from '../../../../utils/lineStickerPrompt.ts';
import { shouldUseComposeLayout } from '../../../../utils/lineStickerCompose.ts';
import type { ChromaKeyAlgorithm } from '../../../../types.ts';

const argv = process.argv.slice(2);
const sheetDir = resolve(argv[0] ?? '');
const cols = Number(argv[1] ?? 4);
const rows = Number(argv[2] ?? 5);
let algorithmArg = '';
let jobConfigPath = '';

for (let i = 3; i < argv.length; i++) {
  if (argv[i] === '--job-config' && argv[i + 1]) {
    jobConfigPath = resolve(argv[++i]!);
  } else if (!algorithmArg && /^(core|legacy|forge)$/i.test(argv[i]!)) {
    algorithmArg = argv[i]!.toLowerCase();
  }
}

const chromaKeyColor = 'green' as const;

if (!sheetDir) {
  console.error(
    'Usage: reslice-core-preview.mts <sheet-dir> [cols] [rows] [core|legacy|forge] [--job-config path]'
  );
  process.exit(1);
}

async function findRawSheet(): Promise<string> {
  const entries = await readdir(sheetDir);
  const raw = entries.find((name) => name.startsWith('_raw-sheet.'));
  if (!raw) throw new Error(`No _raw-sheet.* in ${sheetDir}`);
  return resolve(sheetDir, raw);
}

const resolvedJobConfig =
  jobConfigPath || resolve(sheetDir, '..', 'job.config.json');
const config = existsSync(resolvedJobConfig)
  ? (JSON.parse(await readFile(resolvedJobConfig, 'utf8')) as {
      chromaKeyAlgorithm?: ChromaKeyAlgorithm;
      programmaticTextTuning?: object;
      programmaticCompose?: object;
      fontKey?: keyof typeof FONT_PRESETS;
      textColorKey?: keyof typeof TEXT_COLOR_PRESETS;
    })
  : {};

const algorithm: ChromaKeyAlgorithm =
  algorithmArg === 'forge' || algorithmArg === 'core' || algorithmArg === 'legacy'
    ? (algorithmArg as ChromaKeyAlgorithm)
    : config.chromaKeyAlgorithm === 'forge' ||
        config.chromaKeyAlgorithm === 'core' ||
        config.chromaKeyAlgorithm === 'legacy'
      ? config.chromaKeyAlgorithm
      : 'legacy';

const outDir = resolve(sheetDir, `_preview-${algorithm}`);
const useGuided = existsSync(resolve(sheetDir, '_grid-template-guided.png'));
const templateBounds = buildEqualGridBounds(1024, cols, rows);

const tuning = mergeProgrammaticTextTuning(config.programmaticTextTuning);
const compose = mergeProgrammaticComposeConfig(config.programmaticCompose);
const fontKey = config.fontKey ?? 'round';
const textColorKey = config.textColorKey ?? 'black';

const phrases = await loadSheetPhrases({
  sheetDir,
  cols,
  rows,
  jobConfigPath: resolvedJobConfig,
});
const rawBytes = new Uint8Array(await readFile(await findRawSheet()));
const image = decodeImage(rawBytes);

processSheetChromaKey(image, chromaKeyColor, { guided: useGuided, algorithm });

await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, `_processed-sheet-${algorithm}.png`), encodePng(image));

console.log(`Preview (${algorithm}) → ${outDir} (guided=${useGuided})`);
console.log(
  `Overlay: font=${fontKey} color=${textColorKey} compose=${compose.enabled ? compose.layout : 'off'}`
);

let frames = sliceSheet(image, cols, rows, {
  sliceMode: useGuided ? 'template' : 'divider',
  guidedContentCrop: useGuided,
  templateBounds: useGuided ? templateBounds : undefined,
});

if (compose.enabled) {
  frames = composePhrasesOnRgbaFrames(frames, phrases, {
    fontKey,
    colorKey: textColorKey,
    tuning,
    compose,
  });
}

frames = frames.map((frame, i) => {
  const phrase = phrases[i] ?? '';
  if (!compose.enabled) return trimFrameToContent(frame);
  if (compose.trimAfterCompose) {
    return shouldUseComposeLayout(compose, phrase) ? frame : trimFrameToContent(frame);
  }
  return shouldUseComposeLayout(compose, phrase) ? frame : trimFrameToContent(frame);
});

for (let i = 0; i < frames.length; i++) {
  const name = `sticker-${String(i + 1).padStart(2, '0')}.png`;
  await writeFile(resolve(outDir, name), encodePng(frames[i]!));
  console.log(`  ✓ ${name} (${frames[i]!.width}×${frames[i]!.height})`);
}

console.log(`Done. Original stickers in ${sheetDir} are unchanged.`);
