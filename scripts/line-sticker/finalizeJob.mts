/**
 * Shared finalize logic: merge active sheet folders → stickers + upload pack.
 * Used by generate.mts (end of full run) and finalize.mts (after isolated sheet regen).
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, prepareLineStickerFrame, type RgbaImage } from './nodeImage.mts';
import {
  auditStickerFrames,
  resolveStickerQaMode,
  shouldBlockStickerQa,
  type StickerQaMode,
  type StickerQaReport,
} from '../../utils/stickerFrameQa.ts';
import type { ChromaKeyColorType } from '../../types.ts';
import {
  buildLineUploadZipBytes,
  writeLineUploadPack,
  type LineUploadPackOptions,
  type LineUploadPackResult,
} from './lineUploadPack.mts';
import {
  isUploadEnabled,
  normalizeUploadListing,
  packUploadOutput,
  resolveUploadConfig,
  type UploadConfig,
} from './uploadConfig.mts';
import { shouldSyncToUploadRoot, syncPackToUploadRoot } from './sync-upload-input.mts';
import { resolveSetLayout, DEFAULT_LINE_STICKER_SET_COUNT } from './sheetPlan.ts';
import { validateSheetGrid, buildGridCandidates } from '../../utils/sheetGridValidation.ts';
import {
  assertGridScoresPass,
  DEFAULT_MIN_GRID_ALIGNMENT_SCORE,
  findGridScoreFailures,
  formatGridGateMessage,
} from '../../utils/gridScoreGate.ts';

const FINALIZE_PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export interface JobManifest {
  completionStatus?: 'completed' | 'qa_failed';
  config?: JobConfig;
  activeSheets?: string[];
  gridScores?: Record<string, number>;
  uploadPackPath?: string;
  uploadSyncPath?: string;
  uploadEnvFile?: string;
  /** @deprecated legacy manifest fields */
  lineSDest?: string;
  lineSSyncDest?: string;
  lineSEnvFile?: string;
  stickers?: Array<Record<string, unknown>>;
}

export interface JobConfig {
  stickerCount?: number;
  mainStickerIndex?: number;
  tabStickerIndex?: number;
  lineUploadStickerCount?: number;
  customPhrases?: string[];
  upload?: UploadConfig;
  lineS?: UploadConfig & { syncToLineS?: boolean };
  lineUpload?: boolean;
  /** When true, upload pipeline also submits for review after ZIP import. Default false. */
  lineUploadSubmit?: boolean;
  scope?: string;
  includeText?: boolean;
  textRendering?: 'model' | 'programmatic';
  qaEnabled?: boolean;
  qaMode?: StickerQaMode;
  chromaKeyColor?: ChromaKeyColorType | 'auto';
  minGridAlignmentScore?: number;
}

export interface FinalizeJobOptions {
  outDir: string;
  sheetDirs: string[];
  config: JobConfig;
  writeManifest?: boolean;
}

export interface FinalizeJobResult {
  stickerCount: number;
  activeSheets: string[];
  gridScores: Record<string, number>;
  qaReport?: StickerQaReport;
  uploadPackPath?: string;
  uploadSyncPath?: string;
  uploadEnvFile?: string;
  uploadPack: LineUploadPackResult;
  usedUploadPack: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toZeroBased(oneBased: number | undefined, fallback: number): number {
  return Math.max(0, (oneBased ?? fallback) - 1);
}

function buildUploadPackOptions(config: JobConfig): LineUploadPackOptions {
  const options: LineUploadPackOptions = {
    stickerCount: config.lineUploadStickerCount,
  };
  if (config.mainStickerIndex != null) {
    options.mainStickerIndex = toZeroBased(config.mainStickerIndex, 1);
  }
  if (config.tabStickerIndex != null) {
    options.tabStickerIndex = toZeroBased(config.tabStickerIndex, 1);
  }
  return options;
}

async function loadSheetFrames(sheetDir: string, count: number): Promise<RgbaImage[]> {
  const frames: RgbaImage[] = [];
  for (let i = 1; i <= count; i++) {
    const stickerPath = resolve(sheetDir, `sticker-${pad(i)}.png`);
    await access(stickerPath);
    frames.push(decodePng(new Uint8Array(await readFile(stickerPath))));
  }
  return frames;
}

async function scoreSheetGrid(
  sourceDir: string,
  sheetDir: string,
  cols: number,
  rows: number
): Promise<number> {
  const processedPath = resolve(sourceDir, sheetDir, '_processed-sheet.png');
  try {
    const image = decodePng(new Uint8Array(await readFile(processedPath)));
    const result = validateSheetGrid(image.data, image.width, image.height, cols, rows, {
      minScore: 0,
      ...buildGridCandidates(cols, rows),
    });
    return result.expected.score;
  } catch {
    return -1;
  }
}

export function resolveActiveSheets(
  sheetCount: number,
  explicit?: string[],
  manifest?: JobManifest
): string[] {
  if (explicit && explicit.length > 0) return explicit;
  if (manifest?.activeSheets && manifest.activeSheets.length === sheetCount) {
    return manifest.activeSheets;
  }
  return Array.from({ length: sheetCount }, (_, i) => `sheet-${i + 1}`);
}

export async function finalizeStickerJob(options: FinalizeJobOptions): Promise<FinalizeJobResult> {
  const { outDir, sheetDirs, config } = options;
  const stickerCount = config.stickerCount ?? DEFAULT_LINE_STICKER_SET_COUNT;
  const layouts = resolveSetLayout(stickerCount);

  if (sheetDirs.length !== layouts.length) {
    throw new Error(
      `Expected ${layouts.length} sheet folders for ${stickerCount} stickers, got ${sheetDirs.length}: ${sheetDirs.join(', ')}`
    );
  }

  const manifestPath = resolve(outDir, 'manifest.json');
  const existingManifest = JSON.parse(
    await readFile(manifestPath, 'utf8').catch(() => '{}')
  ) as JobManifest;

  const mergedConfig: JobConfig = { ...existingManifest.config, ...config };
  const phrases: string[] = [...(mergedConfig.customPhrases ?? [])];
  if (phrases.length === 0 && existingManifest.stickers?.length) {
    phrases.push(...existingManifest.stickers.map((entry) => (entry.phrase as string) ?? ''));
  }

  const nativeFrames: RgbaImage[] = [];
  const manifestStickers: Array<Record<string, unknown>> = [];
  const gridScores: Record<string, number> = {};
  const stickersDir = resolve(outDir, 'stickers');
  await mkdir(stickersDir, { recursive: true });

  let globalIndex = 0;
  for (let sheetIndex = 0; sheetIndex < sheetDirs.length; sheetIndex++) {
    const sheetFolder = sheetDirs[sheetIndex]!;
    const layout = layouts[sheetIndex]!;
    const frameCount = layout.cols * layout.rows;
    const sheetDir = resolve(outDir, sheetFolder);
    console.log(`▶ ${sheetFolder}: loading ${frameCount} stickers...`);

    gridScores[sheetFolder] = await scoreSheetGrid(outDir, sheetFolder, layout.cols, layout.rows);
    if (gridScores[sheetFolder]! >= 0) {
      console.log(`   · grid score ${gridScores[sheetFolder]!.toFixed(3)}`);
    }

    const frames = await loadSheetFrames(sheetDir, frameCount);
    for (let i = 0; i < frames.length; i++) {
      globalIndex++;
      const frame = frames[i]!;
      nativeFrames.push(frame);
      const localName = `sticker-${pad(i + 1)}.png`;
      const globalName = `sticker-${pad(globalIndex)}.png`;
      await writeFile(resolve(stickersDir, globalName), encodePng(frame));
      manifestStickers.push({
        globalIndex,
        sheet: sheetFolder,
        index: i + 1,
        file: `${sheetFolder}/${localName}`,
        uploadFile: `stickers/${globalName}`,
        phrase: phrases[globalIndex - 1] ?? '',
        width: frame.width,
        height: frame.height,
      });
    }
  }

  const minGridScore = mergedConfig.minGridAlignmentScore ?? DEFAULT_MIN_GRID_ALIGNMENT_SCORE;
  const gridFailures = findGridScoreFailures(gridScores, minGridScore);
  if (gridFailures.length > 0) {
    console.warn('\n▶ Grid gate: failing sheet(s) detected');
    for (const message of formatGridGateMessage(gridFailures, minGridScore)) {
      console.warn(`   ✗ ${message}`);
    }
    assertGridScoresPass(gridScores, minGridScore);
  }

  const qaMode = resolveStickerQaMode(mergedConfig.qaMode, mergedConfig.qaEnabled);
  const qaEnabled = qaMode !== 'off';
  const qaChromaKeyColor: ChromaKeyColorType =
    mergedConfig.chromaKeyColor === 'magenta' ? 'magenta' : 'green';
  let qaReport: StickerQaReport | undefined;
  if (qaEnabled && nativeFrames.length > 0) {
    console.log('\n▶ Running sticker QA...');
    const checkModelText =
      mergedConfig.textRendering !== 'programmatic' && mergedConfig.includeText !== false;
    qaReport = auditStickerFrames(
      nativeFrames.map((frame, i) => {
        const entry = manifestStickers[i]!;
        const uploadFrame = prepareLineStickerFrame(frame);
        return {
          globalIndex: (entry.globalIndex as number) ?? i + 1,
          sheet: entry.sheet as string | undefined,
          index: entry.index as number | undefined,
          phrase: (entry.phrase as string) ?? '',
          frame,
          pngBytes: encodePng(uploadFrame).byteLength,
        };
      }),
      { checkModelText, chromaKeyColor: qaChromaKeyColor }
    );
    await writeFile(resolve(outDir, 'qa-report.json'), JSON.stringify(qaReport, null, 2));
    console.log(
      `   · QA score ${qaReport.overallScore.toFixed(3)} (${qaReport.pass ? 'pass' : 'warnings'}) → qa-report.json`
    );
    for (const warning of qaReport.summaryWarnings) {
      console.warn(`   QA ⚠ ${warning}`);
    }
    if (gridFailures.length > 0) {
      qaReport.pass = false;
      qaReport.summaryWarnings.push(
        ...formatGridGateMessage(gridFailures, minGridScore)
      );
    }
  }

  if (shouldBlockStickerQa(qaMode, qaReport)) {
    if (options.writeManifest !== false) {
      await writeFile(
        manifestPath,
        JSON.stringify(
          {
            ...existingManifest,
            completionStatus: 'qa_failed',
            config: mergedConfig,
            activeSheets: sheetDirs,
            gridScores,
            qaReport: {
              overallScore: qaReport.overallScore,
              pass: false,
              summaryWarnings: qaReport.summaryWarnings,
              gridPass: true,
              gridMinScore: minGridScore,
              gridFailures: [],
            },
            stickers: manifestStickers,
          },
          null,
          2
        )
      );
    }
    throw new Error(
      `Sticker QA blocked packaging: ${qaReport.summaryWarnings.join('; ') || `score ${qaReport.overallScore.toFixed(3)}`}`
    );
  }

  console.log('\n▶ Building LINE upload pack...');
  const uploadPackOptions = buildUploadPackOptions(mergedConfig);
  const { pack: uploadPack, zipBytes } = await buildLineUploadZipBytes(
    nativeFrames,
    uploadPackOptions
  );
  console.log(
    `   · shop images: main=sticker-${String(uploadPack.mainStickerIndex).padStart(2, '0')}, tab=sticker-${String(uploadPack.tabStickerIndex).padStart(2, '0')}`
  );
  uploadPack.warnings.forEach((warning) => console.warn(`   ! ${warning}`));

  const upload = resolveUploadConfig(mergedConfig);
  const usedUploadPack =
    isUploadEnabled(upload) &&
    mergedConfig.lineUpload !== false &&
    (mergedConfig.scope ?? 'set') === 'set';

  let uploadPackPath: string | undefined;
  let uploadSyncPath: string | undefined;
  let uploadEnvFile: string | undefined;
  if (usedUploadPack && upload) {
    const phraseSamples = phrases.length
      ? phrases
      : manifestStickers.map((entry) => String(entry.phrase ?? ''));
    const { upload: normalizedUpload, warnings: listingWarnings } = normalizeUploadListing(
      upload,
      phraseSamples
    );
    for (const warning of listingWarnings) {
      console.warn(`   ! listing: ${warning}`);
    }
    console.log(`   · shop title: ${normalizedUpload.titleZh}`);
    console.log(`   · shop desc: ${normalizedUpload.descZh}`);

    const { destDir, envFilePath } = await packUploadOutput({
      sourceDir: outDir,
      upload: normalizedUpload,
      sheetDirs,
      zipBytes,
      submitForReview: mergedConfig.lineUploadSubmit === true,
    });
    uploadPackPath = destDir;
    console.log(`   ✓ upload pack → ${destDir}`);
    console.log(`     ${normalizedUpload.setName}.zip (${uploadPack.stickerCount + 2} PNGs)`);
    console.log(`     sprite_sheets/ (${sheetDirs.length} sheets)`);
    if (envFilePath) console.log(`     ${envFilePath}`);

    if (shouldSyncToUploadRoot(upload)) {
      console.log('\n▶ Syncing to upload root...');
      const sync = await syncPackToUploadRoot({
        sourceDir: outDir,
        upload: normalizedUpload,
        submitForReview: mergedConfig.lineUploadSubmit === true,
      });
      uploadSyncPath = sync.destDir;
      uploadEnvFile = sync.envFilePath;
      console.log(`   ✓ upload root → ${sync.destDir}`);
      console.log(`   ✓ ${sync.envFilePath}`);
      const envRel = relative(FINALIZE_PROJECT_ROOT, sync.envFilePath).replace(/\\/g, '/');
      const submitHint =
        mergedConfig.lineUploadSubmit === true ? ' --submit true' : ' --submit false';
      console.log(
        `   · upload: npx tsx scripts/line-sticker/run-line-upload.mts --env ${envRel}${submitHint}`
      );
    }
  } else {
    await writeLineUploadPack(outDir, nativeFrames, uploadPackOptions);
    console.log(`   ✓ line-upload/ (${uploadPack.stickerCount + 2} PNGs) + line-upload.zip`);
  }

  if (options.writeManifest !== false) {
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          ...existingManifest,
          completionStatus: qaReport && !qaReport.pass ? 'qa_failed' : 'completed',
          config: mergedConfig,
          activeSheets: sheetDirs,
          gridScores,
          qaReport: qaReport
            ? {
                overallScore: qaReport.overallScore,
                pass: qaReport.pass,
                summaryWarnings: qaReport.summaryWarnings,
                gridPass: gridFailures.length === 0,
                gridMinScore: minGridScore,
                gridFailures,
              }
            : undefined,
          uploadPackPath,
          uploadSyncPath,
          uploadEnvFile,
          mainStickerIndex: uploadPack.mainStickerIndex,
          tabStickerIndex: uploadPack.tabStickerIndex,
          stickers: manifestStickers,
        },
        null,
        2
      )
    );
  }

  return {
    stickerCount: nativeFrames.length,
    activeSheets: sheetDirs,
    gridScores,
    qaReport,
    uploadPackPath,
    uploadSyncPath,
    uploadEnvFile,
    uploadPack,
    usedUploadPack,
  };
}

export async function finalizeFromJob(options: {
  outDir: string;
  configPath?: string;
  sheetDirs?: string[];
}): Promise<FinalizeJobResult> {
  const outDir = resolve(options.outDir);
  const manifestPath = resolve(outDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{}')) as JobManifest;

  let config: JobConfig = manifest.config ?? {};
  if (options.configPath) {
    const jobConfig = JSON.parse(await readFile(resolve(options.configPath), 'utf8')) as JobConfig;
    config = { ...config, ...jobConfig };
  }

  const stickerCount = config.stickerCount ?? DEFAULT_LINE_STICKER_SET_COUNT;
  const layouts = resolveSetLayout(stickerCount);
  const sheetDirs = resolveActiveSheets(layouts.length, options.sheetDirs, manifest);

  return finalizeStickerJob({ outDir, sheetDirs, config });
}
