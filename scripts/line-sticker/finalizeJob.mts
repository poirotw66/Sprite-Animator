/**
 * Shared finalize logic: merge active sheet folders → stickers + upload pack.
 * Used by generate.mts (end of full run) and finalize.mts (after isolated sheet regen).
 */

import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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
  resolveUploadPackDir,
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
  completionStatus?:
    | 'finalizing'
    | 'completed'
    | 'completed_with_warnings'
    | 'grid_failed'
    | 'qa_failed'
    | 'unverified'
    | 'packaging_failed';
  runId?: string;
  finalizeStage?: string;
  finalizeError?: string;
  config?: JobConfig;
  activeSheets?: string[];
  gridScores?: Record<string, number>;
  sheetChromaDetections?: Record<string, Record<string, unknown>>;
  uploadPackPath?: string;
  uploadSyncPath?: string;
  uploadEnvFile?: string;
  uploadZipFile?: string;
  uploadZipSha256?: string;
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
  requestedChromaKeyColor?: ChromaKeyColorType | 'auto';
  resolvedChromaKeyColor?: ChromaKeyColorType;
  minGridAlignmentScore?: number;
}

export interface FinalizeJobOptions {
  outDir: string;
  sheetDirs: string[];
  config: JobConfig;
  writeManifest?: boolean;
}

interface InternalFinalizeJobOptions extends FinalizeJobOptions {
  runId: string;
  onStage: (stage: string) => void;
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

function createRunId(): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function cleanupAbandonedFinalizeStaging(
  outDir: string,
  keepRunId?: string
): Promise<string[]> {
  const stagingBase = resolve(outDir, '.finalize-staging');
  let entries: Array<{ name: string; isDirectory(): boolean }> = [];
  try {
    entries = await readdir(stagingBase, { withFileTypes: true });
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === keepRunId) continue;
    await rm(resolve(stagingBase, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed;
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temp = `${path}.tmp-${process.pid}`;
  const backup = `${path}.backup-${process.pid}`;
  await writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  await rm(backup, { force: true });
  const hadTarget = await pathExists(path);
  if (hadTarget) await rename(path, backup);
  try {
    await rename(temp, path);
    await rm(backup, { force: true });
  } catch (error) {
    await rm(temp, { force: true });
    if (hadTarget && (await pathExists(backup))) await rename(backup, path);
    throw error;
  }
}

/** Replace one published artifact while retaining the previous version until rename succeeds. */
async function publishStagedPath(stagedPath: string, targetPath: string, runId: string): Promise<void> {
  if (!(await pathExists(stagedPath))) return;
  const backupPath = `${targetPath}.backup-${runId}`;
  await rm(backupPath, { recursive: true, force: true });
  const hadTarget = await pathExists(targetPath);
  if (hadTarget) await rename(targetPath, backupPath);
  try {
    await rename(stagedPath, targetPath);
    await rm(backupPath, { recursive: true, force: true });
  } catch (error) {
    if (hadTarget && (await pathExists(backupPath))) {
      await rename(backupPath, targetPath);
    }
    throw error;
  }
}

async function cleanupSiblingStaging(targetPath: string): Promise<void> {
  const parent = dirname(targetPath);
  const prefix = `${basename(targetPath)}.staging-`;
  let names: string[] = [];
  try {
    names = await readdir(parent);
  } catch {
    return;
  }
  await Promise.all(
    names
      .filter((name) => name.startsWith(prefix))
      .map((name) => rm(resolve(parent, name), { recursive: true, force: true }))
  );
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

async function finalizeStickerJobInternal(
  options: InternalFinalizeJobOptions
): Promise<FinalizeJobResult> {
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

  const requestedChromaKeyColor =
    config.requestedChromaKeyColor ??
    config.chromaKeyColor ??
    existingManifest.config?.requestedChromaKeyColor ??
    existingManifest.config?.chromaKeyColor ??
    'auto';
  const resolvedChromaKeyColor: ChromaKeyColorType =
    config.resolvedChromaKeyColor ??
    (config.chromaKeyColor === 'green' || config.chromaKeyColor === 'magenta'
      ? config.chromaKeyColor
      : undefined) ??
    existingManifest.config?.resolvedChromaKeyColor ??
    (existingManifest.config?.chromaKeyColor === 'magenta' ? 'magenta' : 'green');
  const mergedConfig: JobConfig = {
    ...existingManifest.config,
    ...config,
    requestedChromaKeyColor,
    resolvedChromaKeyColor,
    // Legacy consumers read chromaKeyColor as the resolved value.
    chromaKeyColor: resolvedChromaKeyColor,
  };
  const phrases: string[] = [...(mergedConfig.customPhrases ?? [])];
  if (phrases.length === 0 && existingManifest.stickers?.length) {
    phrases.push(...existingManifest.stickers.map((entry) => (entry.phrase as string) ?? ''));
  }

  const runId = options.runId;
  const stagingRoot = resolve(outDir, '.finalize-staging', runId);
  const stickersDir = resolve(stagingRoot, 'stickers');
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(stickersDir, { recursive: true });
  if (options.writeManifest !== false) {
    await writeJsonAtomic(manifestPath, {
      ...existingManifest,
      completionStatus: 'finalizing',
      runId,
      finalizeStage: 'preparing',
      finalizeError: undefined,
      config: mergedConfig,
      activeSheets: sheetDirs,
    });
  }
  options.onStage('loading');

  const nativeFrames: RgbaImage[] = [];
  const manifestStickers: Array<Record<string, unknown>> = [];
  const gridScores: Record<string, number> = {};
  const sheetChromaDetections: Record<string, Record<string, unknown>> = {};

  let globalIndex = 0;
  for (let sheetIndex = 0; sheetIndex < sheetDirs.length; sheetIndex++) {
    const sheetFolder = sheetDirs[sheetIndex]!;
    const layout = layouts[sheetIndex]!;
    const frameCount = layout.cols * layout.rows;
    const sheetDir = resolve(outDir, sheetFolder);
    const chromaDetection = JSON.parse(
      await readFile(resolve(sheetDir, 'chroma-detection.json'), 'utf8').catch(() => '{}')
    ) as Record<string, unknown>;
    if (Object.keys(chromaDetection).length > 0) {
      sheetChromaDetections[sheetFolder] = chromaDetection;
    }
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
    if (options.writeManifest !== false) {
      await writeJsonAtomic(manifestPath, {
        ...existingManifest,
        completionStatus: 'grid_failed',
        runId,
        config: mergedConfig,
        activeSheets: sheetDirs,
        gridScores,
        sheetChromaDetections,
        qaReport: {
          pass: false,
          gridPass: false,
          gridMinScore: minGridScore,
          gridFailures,
          summaryWarnings: formatGridGateMessage(gridFailures, minGridScore),
        },
        stickers: manifestStickers,
      });
    }
    await rm(stagingRoot, { recursive: true, force: true });
    assertGridScoresPass(gridScores, minGridScore);
  }

  const qaMode = resolveStickerQaMode(mergedConfig.qaMode, mergedConfig.qaEnabled);
  const qaEnabled = qaMode !== 'off';
  const qaChromaKeyColor = resolvedChromaKeyColor;
  let qaReport: StickerQaReport | undefined;
  if (qaEnabled && nativeFrames.length > 0) {
    options.onStage('qa');
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
    await writeFile(resolve(stagingRoot, 'qa-report.json'), JSON.stringify(qaReport, null, 2));
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

  if (qaReport && shouldBlockStickerQa(qaMode, qaReport)) {
    await publishStagedPath(
      resolve(stagingRoot, 'qa-report.json'),
      resolve(outDir, 'qa-report.json'),
      runId
    );
    if (options.writeManifest !== false) {
      await writeJsonAtomic(
        manifestPath,
        {
            ...existingManifest,
            completionStatus: 'qa_failed',
            runId,
            config: mergedConfig,
            activeSheets: sheetDirs,
            gridScores,
            sheetChromaDetections,
            qaReport: {
              overallScore: qaReport.overallScore,
              pass: false,
              summaryWarnings: qaReport.summaryWarnings,
              gridPass: true,
              gridMinScore: minGridScore,
              gridFailures: [],
            },
            stickers: manifestStickers,
          }
      );
    }
    await rm(stagingRoot, { recursive: true, force: true });
    throw new Error(
      `Sticker QA blocked packaging: ${qaReport.summaryWarnings.join('; ') || `score ${qaReport.overallScore.toFixed(3)}`}`
    );
  }

  console.log('\n▶ Building LINE upload pack...');
  options.onStage('packaging');
  const uploadPackOptions = buildUploadPackOptions(mergedConfig);
  const { pack: uploadPack, zipBytes } = await buildLineUploadZipBytes(
    nativeFrames,
    uploadPackOptions
  );
  const uploadZipSha256 = createHash('sha256').update(zipBytes).digest('hex');
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
  let uploadZipFile = 'line-upload.zip';
  if (usedUploadPack && upload) {
    const phraseSamples = phrases.length
      ? phrases
      : manifestStickers.map((entry) => String(entry.phrase ?? ''));
    const { upload: normalizedUpload, warnings: listingWarnings } = normalizeUploadListing(
      upload,
      phraseSamples
    );
    uploadZipFile = `${normalizedUpload.setName}.zip`;
    for (const warning of listingWarnings) {
      console.warn(`   ! listing: ${warning}`);
    }
    console.log(`   · shop title: ${normalizedUpload.titleZh}`);
    console.log(`   · shop desc: ${normalizedUpload.descZh}`);

    const { envFilePath } = await packUploadOutput({
      sourceDir: outDir,
      upload: { ...normalizedUpload, root: undefined },
      sheetDirs,
      zipBytes,
      submitForReview: mergedConfig.lineUploadSubmit === true,
      destDirOverride: stagingRoot,
      envBatchDirOverride: resolve(stagingRoot, '.env.batch'),
    });
    uploadPackPath = outDir;
    console.log(`   ✓ staged upload pack → ${stagingRoot}`);
    console.log(`     ${normalizedUpload.setName}.zip (${uploadPack.stickerCount + 2} PNGs)`);
    console.log(`     sprite_sheets/ (${sheetDirs.length} sheets)`);
    if (envFilePath) console.log(`     ${envFilePath}`);

    options.onStage('publishing-local');
    await publishStagedPath(resolve(stagingRoot, 'stickers'), resolve(outDir, 'stickers'), runId);
    await publishStagedPath(
      resolve(stagingRoot, 'qa-report.json'),
      resolve(outDir, 'qa-report.json'),
      runId
    );
    for (const name of [
      `${normalizedUpload.setName}.zip`,
      `${normalizedUpload.setName}.md`,
      'sprite_sheets',
      '.env.batch',
    ]) {
      await publishStagedPath(resolve(stagingRoot, name), resolve(outDir, name), runId);
    }
    uploadEnvFile = envFilePath
      ? resolve(outDir, '.env.batch', envFilePath.split(/[\\/]/).pop()!)
      : undefined;

    // Explicit external roots are populated only after the staged local pack passes QA.
    if (normalizedUpload.root?.trim()) {
      options.onStage('publishing-external');
      const externalDest = resolveUploadPackDir(normalizedUpload, outDir);
      const externalStage = `${externalDest}.staging-${runId}`;
      const externalEnvStage = resolve(
        normalizedUpload.root,
        `.env.batch-staging-${runId}`
      );
      await cleanupSiblingStaging(externalDest);
      await rm(externalStage, { recursive: true, force: true });
      await rm(externalEnvStage, { recursive: true, force: true });
      const external = await packUploadOutput({
        sourceDir: outDir,
        upload: normalizedUpload,
        sheetDirs,
        zipBytes,
        submitForReview: mergedConfig.lineUploadSubmit === true,
        destDirOverride: externalStage,
        envBatchDirOverride: externalEnvStage,
      });
      await publishStagedPath(externalStage, externalDest, runId);
      uploadPackPath = externalDest;
      if (external.envFilePath) {
        const externalEnvTarget = resolve(
          normalizedUpload.root,
          '.env.batch',
          basename(external.envFilePath)
        );
        await mkdir(dirname(externalEnvTarget), { recursive: true });
        await publishStagedPath(external.envFilePath, externalEnvTarget, runId);
        uploadEnvFile = externalEnvTarget;
      }
      await rm(externalEnvStage, { recursive: true, force: true });
    }

    if (shouldSyncToUploadRoot(upload)) {
      options.onStage('syncing-upload-root');
      console.log('\n▶ Syncing to upload root...');
      const sync = await syncPackToUploadRoot({
        sourceDir: outDir,
        upload: normalizedUpload,
        submitForReview: mergedConfig.lineUploadSubmit === true,
        runId,
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
    await writeLineUploadPack(stagingRoot, nativeFrames, uploadPackOptions);
    await publishStagedPath(resolve(stagingRoot, 'stickers'), resolve(outDir, 'stickers'), runId);
    await publishStagedPath(
      resolve(stagingRoot, 'qa-report.json'),
      resolve(outDir, 'qa-report.json'),
      runId
    );
    await publishStagedPath(
      resolve(stagingRoot, 'line-upload'),
      resolve(outDir, 'line-upload'),
      runId
    );
    await publishStagedPath(
      resolve(stagingRoot, 'line-upload.zip'),
      resolve(outDir, 'line-upload.zip'),
      runId
    );
    console.log(`   ✓ line-upload/ (${uploadPack.stickerCount + 2} PNGs) + line-upload.zip`);
  }

  if (options.writeManifest !== false) {
    options.onStage('committing-manifest');
    await writeJsonAtomic(
      manifestPath,
      {
          ...existingManifest,
          completionStatus: qaReport
            ? qaReport.pass
              ? 'completed'
              : 'completed_with_warnings'
            : 'unverified',
          runId,
          finalizeStage: 'completed',
          finalizeError: undefined,
          config: mergedConfig,
          activeSheets: sheetDirs,
          gridScores,
          sheetChromaDetections,
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
          uploadZipFile,
          uploadZipSha256,
          mainStickerIndex: uploadPack.mainStickerIndex,
          tabStickerIndex: uploadPack.tabStickerIndex,
          stickers: manifestStickers,
        }
    );
  }
  await rm(stagingRoot, { recursive: true, force: true });

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

export async function finalizeStickerJob(
  options: FinalizeJobOptions
): Promise<FinalizeJobResult> {
  const runId = createRunId();
  let stage = 'preparing';
  const removed = await cleanupAbandonedFinalizeStaging(options.outDir, runId);
  if (removed.length > 0) {
    console.warn(`▶ Removed ${removed.length} abandoned finalize staging run(s).`);
  }
  try {
    return await finalizeStickerJobInternal({
      ...options,
      runId,
      onStage: (nextStage) => {
        stage = nextStage;
      },
    });
  } catch (error) {
    if (options.writeManifest !== false) {
      const manifestPath = resolve(options.outDir, 'manifest.json');
      const current = JSON.parse(
        await readFile(manifestPath, 'utf8').catch(() => '{}')
      ) as JobManifest;
      if (current.runId === runId && current.completionStatus === 'finalizing') {
        await writeJsonAtomic(manifestPath, {
          ...current,
          completionStatus: 'packaging_failed',
          finalizeStage: stage,
          finalizeError: error instanceof Error ? error.message : String(error),
        });
      }
    }
    throw error;
  }
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
