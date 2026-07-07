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
  companionReferenceBase64?: string;
  companionReferenceMimeType?: string;
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
  /** Extra Gemini attempts when grid score stays below minGridAlignmentScore. Default 3. */
  extraSheetRegenAttempts?: number;
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

async function archiveGridAttempt(
  outDir: string,
  sheetFolder: string,
  attempt: number,
  attemptState: AttemptState
): Promise<void> {
  const attemptsDir = resolve(outDir, sheetFolder, 'attempts');
  await mkdir(attemptsDir, { recursive: true });
  const { rawPng, image, validation } = attemptState;
  const label = String(attempt).padStart(2, '0');
  await writeFile(resolve(attemptsDir, `attempt-${label}-raw.${extForBytes(rawPng)}`), rawPng);
  await writeFile(resolve(attemptsDir, `attempt-${label}-processed.png`), encodePng(image));
  await writeFile(
    resolve(attemptsDir, `attempt-${label}.json`),
    `${JSON.stringify(
      {
        attempt,
        ok: validation.ok,
        reason: validation.reason,
        expected: validation.expected,
        detected: validation.detected,
        columnWidthCv: validation.columnWidthCv,
        resliceCandidate: validation.resliceCandidate,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function tryAcceptViaReslice(
  validation: GridValidationResult,
  cols: number,
  rows: number,
  minScore: number
): boolean {
  if (!validation.resliceCandidate) {
    return false;
  }
  if (validation.expected.score < minScore) {
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
    companionReferenceBase64,
    companionReferenceMimeType,
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
    extraSheetRegenAttempts = 3,
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
  const hardMaxAttempts = maxSheetRetries + Math.max(0, extraSheetRegenAttempts);
  let finalAttempt: AttemptState | null = null;
  let bestAttempt: AttemptState | null = null;
  let lastValidation: GridValidationResult | undefined;

  for (let attempt = 1; attempt <= hardMaxAttempts; attempt++) {
    if (attempt > 1) {
      log(logPrefix, `grid retry ${attempt}/${hardMaxAttempts}...`);
    }

    const gridRetrySuffix =
      attempt > 1 && lastValidation
        ? buildGridRetryPromptSuffix(sheet.cols, sheet.rows, lastValidation)
        : '';

    const rawPng = await generateSheetImage({
      referenceBase64,
      referenceMimeType,
      companionReference:
        companionReferenceBase64 && companionReferenceMimeType
          ? { base64: companionReferenceBase64, mimeType: companionReferenceMimeType }
          : undefined,
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

    const attemptState: AttemptState = {
      rawPng,
      image,
      validation,
      rank: rankSheetAttempt(validation, sheet.cols, sheet.rows),
      acceptedViaReslice: false,
    };
    lastValidation = validation;

    await archiveGridAttempt(outDir, sheetFolder, attempt, attemptState);
    log(
      logPrefix,
      `saved attempt ${attempt} -> ${sheetFolder}/attempts/ (score ${validation.expected.score.toFixed(2)}, detected ${validation.detected.cols}×${validation.detected.rows})`
    );

    if (!bestAttempt || attemptState.rank > bestAttempt.rank) {
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

    if (tryAcceptViaReslice(validation, sheet.cols, sheet.rows, minGridAlignmentScore)) {
      warn(
        logPrefix,
        `${validation.reason ?? 'marginal grid'} — accepting via reslice (score ${validation.expected.score.toFixed(2)})`
      );
      attemptState.acceptedViaReslice = true;
      finalAttempt = attemptState;
      break;
    }

    const detail = validation.reason ?? 'grid misaligned';
    if (attempt < hardMaxAttempts) {
      warn(logPrefix, `${detail} — retrying...`);
    } else if (model.includes('lite')) {
      warn(
        logPrefix,
        'tip: if grid alignment fails, retry with --model gemini-3.1-flash-image (often more stable for 4×5 sheets).'
      );
    }
  }

  if (!finalAttempt || finalAttempt.validation.expected.score < minGridAlignmentScore) {
    const score = finalAttempt?.validation.expected.score ?? bestAttempt?.validation.expected.score ?? 0;
    if (bestAttempt) {
      const attemptsDir = resolve(outDir, sheetFolder, 'attempts');
      await mkdir(attemptsDir, { recursive: true });
      await writeFile(resolve(attemptsDir, 'best-raw.png'), bestAttempt.rawPng);
      await writeFile(resolve(attemptsDir, 'best-processed.png'), encodePng(bestAttempt.image));
      await writeFile(
        resolve(attemptsDir, 'summary.json'),
        `${JSON.stringify(
          {
            failed: true,
            minGridAlignmentScore,
            attempts: hardMaxAttempts,
            bestScore: bestAttempt.validation.expected.score,
            bestDetected: bestAttempt.validation.detected,
            bestReason: bestAttempt.validation.reason,
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      warn(logPrefix, `all attempts failed — review ${sheetFolder}/attempts/`);
    }
    throw new Error(
      `${sheet.label}: grid score ${score.toFixed(3)} below minimum ${minGridAlignmentScore.toFixed(2)} after ${hardMaxAttempts} attempts`
    );
  }

  const chosen = finalAttempt;

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
