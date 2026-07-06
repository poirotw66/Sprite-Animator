/**
 * Shared finalize logic: merge active sheet folders → stickers + upload pack.
 * Used by generate.mts (end of full run) and finalize.mts (after isolated sheet regen).
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, type RgbaImage } from './nodeImage.mts';
import {
  buildLineUploadZipBytes,
  writeLineUploadPack,
  type LineUploadPackResult,
} from './lineUploadPack.mts';
import {
  isLineSEnabled,
  packLineSOutput,
  type LineSConfig,
} from './organize-line-s-input.mts';
import { shouldSyncToLineS, syncPackToLineS } from './sync-to-line-s.mts';
import { resolveSetLayout, DEFAULT_LINE_STICKER_SET_COUNT } from './sheetPlan.ts';
import { validateSheetGrid, buildGridCandidates } from '../../../../utils/sheetGridValidation.ts';

const FINALIZE_PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);

export interface JobManifest {
  config?: JobConfig;
  activeSheets?: string[];
  gridScores?: Record<string, number>;
  lineSDest?: string;
  stickers?: Array<Record<string, unknown>>;
}

export interface JobConfig {
  stickerCount?: number;
  mainStickerIndex?: number;
  tabStickerIndex?: number;
  lineUploadStickerCount?: number;
  customPhrases?: string[];
  lineS?: LineSConfig;
  lineUpload?: boolean;
  scope?: string;
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
  lineSDest?: string;
  lineSSyncDest?: string;
  lineSEnvFile?: string;
  uploadPack: LineUploadPackResult;
  usedLineS: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toZeroBased(oneBased: number | undefined, fallback: number): number {
  return Math.max(0, (oneBased ?? fallback) - 1);
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

  console.log('\n▶ Building LINE upload pack...');
  const { pack: uploadPack, zipBytes } = await buildLineUploadZipBytes(nativeFrames, {
    mainStickerIndex: toZeroBased(mergedConfig.mainStickerIndex, 1),
    tabStickerIndex: toZeroBased(mergedConfig.tabStickerIndex, 1),
    stickerCount: mergedConfig.lineUploadStickerCount,
  });
  uploadPack.warnings.forEach((warning) => console.warn(`   ! ${warning}`));

  const usedLineS =
    isLineSEnabled(mergedConfig.lineS) &&
    mergedConfig.lineUpload !== false &&
    (mergedConfig.scope ?? 'set') === 'set';

  let lineSDest: string | undefined;
  let lineSSyncDest: string | undefined;
  let lineSEnvFile: string | undefined;
  if (usedLineS && mergedConfig.lineS) {
    const { destDir, envFilePath } = await packLineSOutput({
      sourceDir: outDir,
      lineS: mergedConfig.lineS,
      sheetDirs,
      zipBytes,
    });
    lineSDest = destDir;
    console.log(`   ✓ line-s pack → ${destDir}`);
    console.log(`     ${mergedConfig.lineS.setName}.zip (${uploadPack.stickerCount + 2} PNGs)`);
    console.log(`     sprite_sheets/ (${sheetDirs.length} sheets)`);
    if (envFilePath) console.log(`     ${envFilePath}`);

    if (shouldSyncToLineS(mergedConfig.lineS)) {
      console.log('\n▶ Syncing to line-s submodule...');
      const sync = await syncPackToLineS({
        sourceDir: outDir,
        lineS: mergedConfig.lineS,
      });
      lineSSyncDest = sync.destDir;
      lineSEnvFile = sync.envFilePath;
      console.log(`   ✓ line-s/input → ${sync.destDir}`);
      console.log(`   ✓ ${sync.envFilePath}`);
      const envRel = relative(FINALIZE_PROJECT_ROOT, sync.envFilePath).replace(/\\/g, '/');
      console.log(
        `   · upload: npx tsx .claude/skills/line-sticker-maker/scripts/run-line-upload.mts --env ${envRel}`
      );
    }
  } else {
    await writeLineUploadPack(outDir, nativeFrames, {
      mainStickerIndex: toZeroBased(mergedConfig.mainStickerIndex, 1),
      tabStickerIndex: toZeroBased(mergedConfig.tabStickerIndex, 1),
      stickerCount: mergedConfig.lineUploadStickerCount,
    });
    console.log(`   ✓ line-upload/ (${uploadPack.stickerCount + 2} PNGs) + line-upload.zip`);
  }

  if (options.writeManifest !== false) {
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          ...existingManifest,
          config: mergedConfig,
          activeSheets: sheetDirs,
          gridScores,
          lineSDest,
          lineSSyncDest,
          lineSEnvFile,
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
    lineSDest,
    lineSSyncDest,
    lineSEnvFile,
    uploadPack,
    usedLineS,
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
