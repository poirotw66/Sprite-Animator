/**
 * Single-sheet generation with grid validation, best-attempt retention,
 * reslice-before-regenerate recovery, and optional programmatic text overlay.
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

import {
  buildLineStickerPrompt,
  getEffectiveLineStickerIncludeText,
  FONT_PRESETS,
  TEXT_COLOR_PRESETS,
  type LineStickerTextRendering,
  type LineStickerPromptVersion,
  type PromptSlots,
} from '../../../../utils/lineStickerPrompt.ts';
import type { ChromaKeyColorType } from '../../../../types.ts';
import {
  buildGridCandidates,
  buildGridRetryPromptSuffix,
  rankSheetAttempt,
  validateSheetGrid,
  type GridValidationResult,
} from '../../../../utils/sheetGridValidation.ts';

import { generateSheetImage, type StyleAnchorImage } from './geminiSheet.mts';
import {
  decodeImage,
  encodePng,
  extForBytes,
  removeChromaKey,
  sliceSheet,
  type RgbaImage,
} from './nodeImage.mts';
import { overlayPhrasesOnRgbaFrames } from './programmaticTextOverlay.mts';

export interface SheetPlan {
  label: string;
  cols: number;
  rows: number;
  phrases: string[];
  actionDescs?: string[];
}

export interface SheetManifestEntry {
  globalIndex: number;
  sheet: string;
  index: number;
  file: string;
  uploadFile: string;
  phrase: string;
  width: number;
  height: number;
}

export interface GenerateOneSheetParams {
  sheet: SheetPlan;
  sheetFolder: string;
  outDir: string;
  stickersDir: string;
  slots: PromptSlots;
  referenceBase64: string;
  referenceMimeType: string;
  apiKey: string;
  model: string;
  resolution: string;
  chromaKeyColor: ChromaKeyColorType;
  includeText: boolean;
  textRendering: LineStickerTextRendering;
  fontKey?: keyof typeof FONT_PRESETS;
  textColorKey?: keyof typeof TEXT_COLOR_PRESETS;
  maxSheetRetries: number;
  minGridAlignmentScore: number;
  isolatedSheetRun: boolean;
  globalIndexStart: number;
  promptVersion?: LineStickerPromptVersion;
  styleAnchorFromPriorSheet?: boolean;
  priorSheetFolder?: string;
  logPrefix?: string;
}

export interface GenerateOneSheetResult {
  sheetFolder: string;
  sheetLabel: string;
  frames: RgbaImage[];
  manifestEntries: SheetManifestEntry[];
  gridScore: number;
  gridValidation: GridValidationResult;
  acceptedViaReslice: boolean;
}

interface AttemptState {
  rawPng: Uint8Array;
  image: RgbaImage;
  validation: GridValidationResult;
  rank: number;
  acceptedViaReslice: boolean;
}

function log(prefix: string, msg: string): void {
  console.log(`${prefix}${msg}`);
}

function warn(prefix: string, msg: string): void {
  console.warn(`${prefix}${msg}`);
}

function tryAcceptViaReslice(
  validation: GridValidationResult,
  cols: number,
  rows: number
): boolean {
  if (!validation.resliceCandidate) {
    return false;
  }
  const layoutMatches = validation.detected.cols === cols && validation.detected.rows === rows;
  return layoutMatches;
}

async function loadPriorSheetStyleAnchor(
  outDir: string,
  priorSheetFolder: string
): Promise<StyleAnchorImage | undefined> {
  const processedPath = resolve(outDir, priorSheetFolder, '_processed-sheet.png');
  if (!existsSync(processedPath)) {
    return undefined;
  }
  const bytes = await readFile(processedPath);
  return { base64: bytes.toString('base64'), mimeType: 'image/png' };
}

export async function generateOneSheet(params: GenerateOneSheetParams): Promise<GenerateOneSheetResult> {
  const {
    sheet,
    sheetFolder,
    outDir,
    stickersDir,
    slots,
    referenceBase64,
    referenceMimeType,
    apiKey,
    model,
    resolution,
    chromaKeyColor,
    includeText,
    textRendering,
    fontKey = 'round',
    textColorKey = 'black',
    maxSheetRetries,
    minGridAlignmentScore,
    isolatedSheetRun,
    globalIndexStart,
    promptVersion = 'v3compact',
    styleAnchorFromPriorSheet = false,
    priorSheetFolder,
    logPrefix = '',
  } = params;

  const effectiveIncludeText = getEffectiveLineStickerIncludeText(includeText, textRendering);
  const reserveForProgrammaticOverlay = includeText && textRendering === 'programmatic';
  const prompt = buildLineStickerPrompt(
    slots,
    sheet.cols,
    sheet.rows,
    chromaKeyColor,
    effectiveIncludeText,
    sheet.actionDescs,
    promptVersion,
    reserveForProgrammaticOverlay
  );

  let styleAnchor: StyleAnchorImage | undefined;
  if (styleAnchorFromPriorSheet && priorSheetFolder) {
    styleAnchor = await loadPriorSheetStyleAnchor(outDir, priorSheetFolder);
    if (styleAnchor) {
      log(logPrefix, `using style anchor from ${priorSheetFolder}/_processed-sheet.png`);
    }
  }

  log(logPrefix, `generating ${sheet.cols}x${sheet.rows} sheet...`);

  const gridCandidates = buildGridCandidates(sheet.cols, sheet.rows);
  let bestAttempt: AttemptState | null = null;
  let finalAttempt: AttemptState | null = null;

  for (let attempt = 1; attempt <= maxSheetRetries; attempt++) {
    if (attempt > 1) {
      log(logPrefix, `grid retry ${attempt}/${maxSheetRetries}...`);
    }

    const gridRetrySuffix =
      attempt > 1 && bestAttempt
        ? buildGridRetryPromptSuffix(sheet.cols, sheet.rows, bestAttempt.validation)
        : '';

    const rawPng = await generateSheetImage({
      referenceBase64,
      referenceMimeType,
      styleAnchor,
      prompt,
      cols: sheet.cols,
      rows: sheet.rows,
      apiKey,
      model,
      chromaKeyColor,
      includeText: effectiveIncludeText,
      outputResolution: resolution,
      gridRetrySuffix,
      onStatus: (m) => log(logPrefix, m),
    });

    const image = decodeImage(rawPng);
    removeChromaKey(image, chromaKeyColor);
    const validation = validateSheetGrid(
      image.data,
      image.width,
      image.height,
      sheet.cols,
      sheet.rows,
      { minScore: minGridAlignmentScore, ...gridCandidates }
    );

    const rank = rankSheetAttempt(validation, sheet.cols, sheet.rows);
    const attemptState: AttemptState = {
      rawPng,
      image,
      validation,
      rank,
      acceptedViaReslice: false,
    };

    if (!bestAttempt || rank > bestAttempt.rank) {
      bestAttempt = attemptState;
    }

    if (validation.ok) {
      if (attempt > 1) {
        log(
          logPrefix,
          `✓ grid aligned on attempt ${attempt} (score ${validation.expected.score.toFixed(2)})`
        );
      }
      finalAttempt = attemptState;
      break;
    }

    if (tryAcceptViaReslice(validation, sheet.cols, sheet.rows)) {
      warn(
        logPrefix,
        `${validation.reason ?? 'marginal grid'} — accepting via reslice-before-regenerate (score ${validation.expected.score.toFixed(2)})`
      );
      attemptState.acceptedViaReslice = true;
      finalAttempt = attemptState;
      break;
    }

    const detail = validation.reason ?? 'grid misaligned';
    if (attempt < maxSheetRetries) {
      warn(logPrefix, `${detail} — retrying...`);
    } else {
      warn(logPrefix, `${detail} — using best attempt after ${maxSheetRetries} tries.`);
      if (model.includes('lite')) {
        warn(
          logPrefix,
          'tip: gemini-3.1-flash-image is usually more stable for 4×5 sheets than flash-lite.'
        );
      }
    }
  }

  const chosen = finalAttempt ?? bestAttempt;
  if (!chosen) {
    throw new Error(`Failed to generate ${sheet.label}`);
  }

  if (!finalAttempt && bestAttempt) {
    warn(
      logPrefix,
      `using best attempt (rank ${bestAttempt.rank.toFixed(3)}, score ${bestAttempt.validation.expected.score.toFixed(2)})`
    );
  }

  const { rawPng, image, validation, acceptedViaReslice } = chosen;
  const sheetDir = resolve(outDir, sheetFolder);
  await mkdir(sheetDir, { recursive: true });
  await writeFile(resolve(sheetDir, `_raw-sheet.${extForBytes(rawPng)}`), rawPng);
  await writeFile(resolve(sheetDir, '_processed-sheet.png'), encodePng(image));

  if (!validation.ok && !acceptedViaReslice) {
    warn(
      logPrefix,
      `Final grid: expected ${sheet.cols}×${sheet.rows} (${validation.expected.score.toFixed(2)}), ` +
        `detected ${validation.detected.cols}×${validation.detected.rows} (${validation.detected.score.toFixed(2)})`
    );
  }

  log(
    logPrefix,
    `slicing into ${sheet.cols * sheet.rows} stickers (native ${Math.round(image.width / sheet.cols)}x${Math.round(image.height / sheet.rows)} px)...`
  );

  let frames = sliceSheet(image, sheet.cols, sheet.rows);

  if (textRendering === 'programmatic' && includeText) {
    log(logPrefix, 'applying programmatic text overlay...');
    frames = overlayPhrasesOnRgbaFrames(frames, sheet.phrases, {
      fontKey,
      colorKey: textColorKey,
    });
  }

  const manifestEntries: SheetManifestEntry[] = [];
  for (let i = 0; i < frames.length; i++) {
    const globalIndex = globalIndexStart + i + 1;
    const name = `sticker-${String(i + 1).padStart(2, '0')}.png`;
    const globalName = `sticker-${String(globalIndex).padStart(2, '0')}.png`;
    const png = encodePng(frames[i]!);
    await writeFile(resolve(sheetDir, name), png);
    if (!isolatedSheetRun) {
      await writeFile(resolve(stickersDir, globalName), png);
    }
    manifestEntries.push({
      globalIndex,
      sheet: sheetFolder,
      index: i + 1,
      file: `${sheetFolder}/${name}`,
      uploadFile: isolatedSheetRun ? `${sheetFolder}/${name}` : `stickers/${globalName}`,
      phrase: sheet.phrases[i] ?? '',
      width: frames[i]!.width,
      height: frames[i]!.height,
    });
  }

  log(logPrefix, `✓ ${sheetFolder} done -> ${sheetDir}`);

  return {
    sheetFolder,
    sheetLabel: sheet.label,
    frames,
    manifestEntries,
    gridScore: validation.expected.score,
    gridValidation: validation,
    acceptedViaReslice,
  };
}
