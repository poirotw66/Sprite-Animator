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
import type { ChromaKeyColorType, ChromaKeyAlgorithm } from '../../../../types.ts';
import {
  buildGridCandidates,
  buildGridRetryPromptSuffix,
  rankSheetAttempt,
  validateSheetGrid,
  type GridValidationResult,
} from '../../../../utils/sheetGridValidation.ts';
import { buildGridSheetTemplate, type GridTemplateMode } from '../../../../utils/gridSheetTemplate.ts';
import { DEFAULT_CHROMA_KEY_ALGORITHM } from '../../../../utils/constants.ts';
import { detectWhiteDividerGrid, shouldUseWhiteDividerSlice } from '../../../../utils/sheetWhiteDividerDetection.ts';

import { generateSheetImage, type StyleAnchorImage } from './geminiSheet.mts';
import {
  decodeImage,
  encodePng,
  extForBytes,
  processSheetChromaKey,
  sliceSheet,
  type RgbaImage,
} from './nodeImage.mts';
import { overlayPhrasesOnRgbaFrames } from './programmaticTextOverlay.mts';
import { trimFrameToContent } from '../../../../utils/sheetComponentSlicer.ts';
import {
  mergeProgrammaticTextTuning,
  type ProgrammaticTextOverlayTuning,
} from '../../../../utils/lineStickerTextOverlayTypes.ts';

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
  chromaKeyAlgorithm?: ChromaKeyAlgorithm;
  includeText: boolean;
  textRendering: LineStickerTextRendering;
  fontKey?: keyof typeof FONT_PRESETS;
  textColorKey?: keyof typeof TEXT_COLOR_PRESETS;
  programmaticTextTuning?: ProgrammaticTextOverlayTuning;
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
  /** `true`/`solid` = blank chroma canvas (plan A). `guided` = visible layout ref (plan B). */
  gridTemplate?: boolean | 'guided';
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
  attemptState: AttemptState,
  sliceMeta: { sliceMode: 'template' | 'detect' | 'divider'; templateBounds?: { xBounds: number[]; yBounds: number[] } }
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
        sliceMode: sliceMeta.sliceMode,
        templateBounds: sliceMeta.templateBounds,
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

function resolveGridTemplateMode(
  gridTemplate: boolean | 'guided' | undefined
): GridTemplateMode | false {
  if (gridTemplate === 'guided') return 'guided';
  if (gridTemplate === true) return 'solid';
  return false;
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
    programmaticTextTuning = mergeProgrammaticTextTuning(),
    maxSheetRetries,
    minGridAlignmentScore,
    extraSheetRegenAttempts = 3,
    isolatedSheetRun,
    globalIndexStart,
    promptVersion = 'v3compact',
    styleAnchorFromPriorSheet = false,
    priorSheetFolder,
    logPrefix = '',
    gridTemplate = false,
    chromaKeyAlgorithm = DEFAULT_CHROMA_KEY_ALGORITHM,
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

  const templateMode = resolveGridTemplateMode(gridTemplate);
  const sheetTemplate = templateMode
    ? buildGridSheetTemplate(sheet.cols, sheet.rows, { chromaKeyColor, mode: templateMode })
    : null;
  if (sheetTemplate) {
    const sheetDirEarly = resolve(outDir, sheetFolder);
    await mkdir(sheetDirEarly, { recursive: true });
    const templateName =
      sheetTemplate.mode === 'guided' ? '_grid-template-guided.png' : '_grid-template.png';
    await writeFile(
      resolve(sheetDirEarly, templateName),
      encodePng({
        data: sheetTemplate.data,
        width: sheetTemplate.width,
        height: sheetTemplate.height,
      })
    );
    await writeFile(resolve(sheetDirEarly, '_grid-template.png'), encodePng({
      data: sheetTemplate.data,
      width: sheetTemplate.width,
      height: sheetTemplate.height,
    }));
    log(
      logPrefix,
      sheetTemplate.mode === 'guided'
        ? 'using guided grid layout reference (paint on template)'
        : 'using chroma grid template (fixed equal-split slice)'
    );
  }

  const gridTemplateImage = sheetTemplate
    ? {
        base64: Buffer.from(
          encodePng({
            data: sheetTemplate.data,
            width: sheetTemplate.width,
            height: sheetTemplate.height,
          })
        ).toString('base64'),
        mimeType: 'image/png' as const,
      }
    : undefined;

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
      gridTemplate: gridTemplateImage,
      gridTemplateMode: sheetTemplate?.mode ?? 'solid',
    });

    const image = decodeImage(rawPng);
    processSheetChromaKey(image, chromaKeyColor, {
      guided: sheetTemplate?.mode === 'guided',
      algorithm: chromaKeyAlgorithm,
    });
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

    await archiveGridAttempt(outDir, sheetFolder, attempt, attemptState, {
      sliceMode: 'divider',
      templateBounds: sheetTemplate
        ? { xBounds: sheetTemplate.xBounds, yBounds: sheetTemplate.yBounds }
        : undefined,
    });
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

  const useGuidedTemplateSlice = sheetTemplate?.mode === 'guided';
  log(
    logPrefix,
    useGuidedTemplateSlice
      ? `slicing into ${sheet.cols * sheet.rows} stickers (guided template bounds)...`
      : `slicing into ${sheet.cols * sheet.rows} stickers (white-divider mode)...`
  );

  const rawForDivide = decodeImage(rawPng);
  const dividerGridFromRaw = detectWhiteDividerGrid(
    rawForDivide.data,
    rawForDivide.width,
    rawForDivide.height,
    sheet.cols,
    sheet.rows
  );

  let frames = sliceSheet(image, sheet.cols, sheet.rows, {
    sliceMode: useGuidedTemplateSlice ? 'template' : 'divider',
    guidedContentCrop: useGuidedTemplateSlice,
    dividerGrid:
      !useGuidedTemplateSlice &&
      shouldUseWhiteDividerSlice(dividerGridFromRaw, sheet.cols, sheet.rows)
        ? dividerGridFromRaw
        : undefined,
    templateBounds: sheetTemplate
      ? { xBounds: sheetTemplate.xBounds, yBounds: sheetTemplate.yBounds }
      : undefined,
  });

  if (textRendering === 'programmatic' && includeText) {
    log(logPrefix, 'applying programmatic text overlay...');
    frames = overlayPhrasesOnRgbaFrames(frames, sheet.phrases, {
      fontKey,
      colorKey: textColorKey,
      tuning: programmaticTextTuning,
    });
  }

  // Frames keep full cell space through overlay (caption placement needs it);
  // trim to content only after text is drawn.
  frames = frames.map((frame) => trimFrameToContent(frame));

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
