/**
 * LINE sticker generator — headless entry point for the skill.
 *
 *   npx tsx generate.mts --config <config.json> --out <dir> [--sheet sheet-1] [--sheet-dir sheet-1-flash] [--model gemini-3.1-flash-image] [--dry-run]
 *
 * Pipeline per sheet:
 *   config -> buildLineStickerPrompt (reused) -> Gemini sheet image
 *          -> processChromaKey (reused, shared core) -> slice (native res) -> PNGs
 *
 * Reuses the app's prompt builder, preset data, set schema, and chroma core
 * unchanged; only the browser Canvas layer is replaced (see nodeImage.mts).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildLineStickerPrompt,
  expandThemePhrasesForFrames,
  getEffectiveLineStickerIncludeText,
  THEME_PRESETS,
  TEXT_PRESETS,
  STYLE_PRESETS,
  DEFAULT_CHARACTER_SLOT,
  FONT_PRESETS,
  TEXT_COLOR_PRESETS,
  type PromptSlots,
  type StyleSlot,
  type ThemeSlot,
  type LineStickerTextRendering,
  type LineStickerPromptVersion,
} from '../../../../utils/lineStickerPrompt.ts';
import type { ChromaKeyColorType } from '../../../../types.ts';

import { finalizeStickerJob } from './finalizeJob.mts';
import type { LineSConfig } from './organize-line-s-input.mts';
import { generateOneSheet, type SheetPlan } from './sheetGeneration.mts';
import { decodePng, type RgbaImage } from './nodeImage.mts';
import {
  DEFAULT_LINE_STICKER_SET_COUNT,
  resolveSetLayout,
  splitPhrasesAcrossSheets,
} from './sheetPlan.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '../../../..');

interface StickerConfig {
  referenceImage: string;
  characterDescription?: string;
  style?: string; // STYLE_PRESETS key (default: matchUploaded)
  theme?: string; // THEME_PRESETS key (default: daily)
  customPhrases?: string[]; // overrides theme phrases when non-empty
  customActionDescs?: string[];
  /** Load phrases/actionDescs from a line-sticker-phrase-set JSON export. */
  phraseSetFile?: string;
  language?: string; // TEXT_PRESETS key (default: zh-TW)
  chromaKeyColor?: ChromaKeyColorType; // default: green
  includeText?: boolean; // default: true (model draws text)
  /** 'model' = Gemini draws text; 'programmatic' = overlay after slice (more stable). */
  textRendering?: LineStickerTextRendering;
  fontKey?: keyof typeof FONT_PRESETS;
  textColorKey?: keyof typeof TEXT_COLOR_PRESETS;
  scope?: 'set' | 'single'; // default: set
  stickerCount?: number; // set mode only: 40 (LINE default) or 48 (legacy)
  cols?: number; // single mode only (default 4)
  rows?: number; // single mode only (default 6)
  model?: string; // default: gemini-3.1-flash-image
  resolution?: string; // output resolution, default: 1K (model-dependent)
  /** line-s upload repo layout (replaces legacy line-upload/ when enabled). */
  lineS?: LineSConfig;
  /** When true (default for set scope), emit LINE Creators Market upload pack + ZIP. */
  lineUpload?: boolean;
  /** 1-based sticker index used for main.png (default: 1). */
  mainStickerIndex?: number;
  /** 1-based sticker index used for tab.png (default: 1). */
  tabStickerIndex?: number;
  /** LINE upload sticker count override (8/16/24/32/40). Default: produced count or 40. */
  lineUploadStickerCount?: number;
  /** Max Gemini retries when grid validation fails (default 3). */
  maxSheetRetries?: number;
  /** Minimum grid alignment score 0–1 to accept a sheet (default 0.72). */
  minGridAlignmentScore?: number;
  /** Prompt builder version (default v3compact — shorter per-cell lines). */
  promptVersion?: LineStickerPromptVersion;
  /** When true, sheet-2+ also attaches sheet-1 _processed-sheet.png (disables parallel). Default false. */
  styleAnchorFromPriorSheet?: boolean;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function readKeyFromFile(path: string): string {
  if (!existsSync(path)) return '';
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return '';
}

/** Key source precedence: env var > .env > .env.local. */
function loadApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return (
    readKeyFromFile(resolve(ROOT_DIR, '.env')) ||
    readKeyFromFile(resolve(ROOT_DIR, '.env.local'))
  );
}

function resolveImagePath(p: string, configDir: string): string {
  for (const base of [undefined, configDir, process.cwd(), ROOT_DIR]) {
    const full = base ? resolve(base, p) : p;
    if (existsSync(full)) return full;
  }
  throw new Error(`Reference image not found: ${p}`);
}

function mimeFromPath(p: string): string {
  const ext = extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function buildSlots(config: StickerConfig, phrases: string[]): PromptSlots {
  const styleKey = config.style ?? 'matchUploaded';
  const stylePreset = STYLE_PRESETS[styleKey] ?? STYLE_PRESETS.matchUploaded;
  const style: StyleSlot = {
    styleType: stylePreset.styleType,
    drawingMethod: stylePreset.drawingMethod,
    outlinePreference: stylePreset.outlinePreference,
    lightingPreference: stylePreset.lightingPreference,
  };

  const langKey = config.language ?? 'zh-TW';
  const text = TEXT_PRESETS[langKey] ?? TEXT_PRESETS['zh-TW'];

  const themeKey = config.theme ?? 'daily';
  const themePreset = THEME_PRESETS[themeKey] ?? THEME_PRESETS.daily;
  const theme: ThemeSlot = {
    chatContext: themePreset.chatContext,
    examplePhrases: phrases,
  };

  const characterRules = config.characterDescription?.trim()
    ? `${DEFAULT_CHARACTER_SLOT.originalImageRules} Character notes: ${config.characterDescription.trim()}`
    : DEFAULT_CHARACTER_SLOT.originalImageRules;

  return {
    style,
    character: { originalImageRules: characterRules },
    theme,
    text,
  };
}

/** Build the full phrase list for the whole job (cycled / clamped per language). */
function buildPhraseList(config: StickerConfig, count: number): string[] {
  if (config.customPhrases && config.customPhrases.length > 0) {
    const list = config.customPhrases.slice(0, count);
    while (list.length < count) {
      list.push('');
    }
    return list.slice(0, count);
  }

  const themeKey = config.theme ?? 'daily';
  const themePreset = THEME_PRESETS[themeKey] ?? THEME_PRESETS.daily;
  const langKey = config.language ?? 'zh-TW';
  const language = (TEXT_PRESETS[langKey] ?? TEXT_PRESETS['zh-TW']).language;
  const source: Pick<ThemeSlot, 'examplePhrases' | 'specialStickers'> =
    config.customPhrases && config.customPhrases.length > 0
      ? { examplePhrases: config.customPhrases }
      : themePreset;
  return expandThemePhrasesForFrames(source, count, language);
}

function buildActionDescList(config: StickerConfig, count: number): string[] | undefined {
  if (!config.customActionDescs || config.customActionDescs.length === 0) {
    return undefined;
  }
  const list = config.customActionDescs.slice(0, count);
  while (list.length < count) {
    list.push('');
  }
  return list.slice(0, count);
}

interface PhraseSetFile {
  format?: string;
  mode?: string;
  gridCols?: number;
  gridRows?: number;
  phrases?: string[];
  actionDescs?: string[];
}

async function applyPhraseSetFile(config: StickerConfig, configDir: string): Promise<void> {
  if (!config.phraseSetFile) {
    return;
  }
  const phraseSetPath = resolve(configDir, config.phraseSetFile);
  const raw = JSON.parse(await readFile(phraseSetPath, 'utf8')) as PhraseSetFile;
  if (!Array.isArray(raw.phrases) || raw.phrases.length === 0) {
    throw new Error(`phraseSetFile has no phrases: ${config.phraseSetFile}`);
  }
  config.customPhrases = raw.phrases;
  if (Array.isArray(raw.actionDescs) && raw.actionDescs.length > 0) {
    config.customActionDescs = raw.actionDescs;
  }
}

function sliceActionDescsForSheet(
  actionDescs: string[] | undefined,
  offset: number,
  count: number
): string[] | undefined {
  if (!actionDescs) {
    return undefined;
  }
  return actionDescs.slice(offset, offset + count);
}

function planSheets(config: StickerConfig): SheetPlan[] {
  const scope = config.scope ?? 'set';
  const allActionDescs = buildActionDescList(
    config,
    scope === 'single'
      ? (config.cols ?? 4) * (config.rows ?? 6)
      : (config.stickerCount ?? DEFAULT_LINE_STICKER_SET_COUNT)
  );

  if (scope === 'single') {
    const cols = config.cols ?? 4;
    const rows = config.rows ?? 6;
    const phrases = buildPhraseList(config, cols * rows);
    return [{
      label: 'sheet-1',
      cols,
      rows,
      phrases,
      actionDescs: sliceActionDescsForSheet(allActionDescs, 0, cols * rows),
    }];
  }

  const stickerCount = config.stickerCount ?? DEFAULT_LINE_STICKER_SET_COUNT;
  const layouts = resolveSetLayout(stickerCount);
  const all = buildPhraseList(config, stickerCount);
  const phraseSlices = splitPhrasesAcrossSheets(all, layouts);

  let actionOffset = 0;
  return layouts.map((layout, sheetIndex) => {
    const frameCount = layout.cols * layout.rows;
    const plan: SheetPlan = {
      label: `sheet-${sheetIndex + 1}`,
      cols: layout.cols,
      rows: layout.rows,
      phrases: phraseSlices[sheetIndex] ?? [],
      actionDescs: sliceActionDescsForSheet(allActionDescs, actionOffset, frameCount),
    };
    actionOffset += frameCount;
    return plan;
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function resolvePriorSheetFolder(
  sheetLabel: string,
  sheetIndexInJob: number,
  iterationSheets: SheetPlan[],
  isolatedSheetRun: boolean
): string | undefined {
  const match = sheetLabel.match(/^sheet-(\d+)$/);
  if (!match) return undefined;
  const sheetNum = Number.parseInt(match[1]!, 10);
  if (sheetNum <= 1) return undefined;
  if (isolatedSheetRun) {
    return `sheet-${sheetNum - 1}`;
  }
  return sheetIndexInJob > 0 ? iterationSheets[sheetIndexInJob - 1]!.label : undefined;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configArg = args.config as string;
  if (!configArg) {
    throw new Error('Missing --config <config.json>');
  }
  const dryRun = Boolean(args['dry-run']);

  const configPath = resolve(process.cwd(), configArg);
  const configDir = dirname(configPath);
  const config: StickerConfig = JSON.parse(await readFile(configPath, 'utf8'));
  await applyPhraseSetFile(config, configDir);

  const outDir = resolve(process.cwd(), (args.out as string) ?? 'line-stickers-out');
  const sheetDirOverride = typeof args['sheet-dir'] === 'string' ? args['sheet-dir'] : undefined;
  const includeText = config.includeText ?? true;
  const textRendering: LineStickerTextRendering = config.textRendering ?? 'model';
  const effectiveIncludeText = getEffectiveLineStickerIncludeText(includeText, textRendering);
  const chromaKeyColor: ChromaKeyColorType = config.chromaKeyColor ?? 'green';
  const model =
    (typeof args.model === 'string' ? args.model : undefined) ??
    config.model ??
    'gemini-3.1-flash-image';
  const resolution = config.resolution ?? '1K';
  const maxSheetRetries = Math.max(1, config.maxSheetRetries ?? 3);
  const extraSheetRegenAttempts = config.extraSheetRegenAttempts ?? 3;
  const minGridAlignmentScore = config.minGridAlignmentScore ?? 0.72;
  const promptVersion = config.promptVersion ?? 'v3compact';
  const styleAnchorFromPriorSheet = config.styleAnchorFromPriorSheet === true;

  const sheets = planSheets(config);
  const sheetFilter = typeof args.sheet === 'string' ? args.sheet : undefined;
  const sheetsToGenerate = sheetFilter
    ? sheets.filter((sheet) => sheet.label === sheetFilter)
    : sheets;
  if (sheetFilter && sheetsToGenerate.length === 0) {
    throw new Error(
      `Unknown --sheet "${sheetFilter}". Expected one of: ${sheets.map((sheet) => sheet.label).join(', ')}`
    );
  }
  const isolatedSheetRun = Boolean(sheetFilter && sheetDirOverride);
  if (sheetDirOverride && !sheetFilter) {
    throw new Error('--sheet-dir requires --sheet (e.g. --sheet sheet-1 --sheet-dir sheet-1-flash)');
  }
  const iterationSheets = isolatedSheetRun ? sheetsToGenerate : sheets;
  const stickerTotal = sheets.reduce((sum, sheet) => sum + sheet.cols * sheet.rows, 0);

  console.log(
    `▶ LINE sticker job: scope=${config.scope ?? 'set'}, stickers=${stickerTotal}, sheets=${sheets.length}` +
      (sheetFilter ? `, regenerating=${sheetFilter}` : '') +
      (sheetDirOverride ? `, outputDir=${sheetDirOverride}` : '') +
      (isolatedSheetRun ? ', isolated=true' : '') +
      `, chroma=${chromaKeyColor}, text=${textRendering === 'programmatic' ? 'programmatic' : effectiveIncludeText ? 'model-drawn' : 'none'}, model=${model}, resolution=${resolution}`
  );

  if (dryRun) {
    for (const sheet of sheets) {
      const slots = buildSlots(config, sheet.phrases);
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
      console.log(`\n===== ${sheet.label} (${sheet.cols}x${sheet.rows}) prompt preview =====`);
      console.log(prompt.slice(0, 1200) + (prompt.length > 1200 ? '\n... [truncated]' : ''));
      console.log(`phrases: ${JSON.stringify(sheet.phrases)}`);
    }
    console.log('\n✓ Dry run complete (no API call, no files written).');
    return;
  }

  const apiKey = loadApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY not found (env or .env.local).');

  const imgPath = resolveImagePath(config.referenceImage, configDir);
  const referenceBase64 = (await readFile(imgPath)).toString('base64');
  const referenceMimeType = mimeFromPath(imgPath);
  console.log(`▶ reference: ${basename(imgPath)} (${referenceMimeType})`);

  await mkdir(outDir, { recursive: true });
  const stickersDir = resolve(outDir, 'stickers');
  await mkdir(stickersDir, { recursive: true });
  const manifest: Array<Record<string, unknown>> = [];
  let globalIndex = 0;
  const nativeFrames: RgbaImage[] = [];
  const usedSheetFolders: string[] = [];
  const gridScores: Record<string, number> = {};

  const fontKey = config.fontKey ?? 'round';
  const textColorKey = config.textColorKey ?? 'black';

  async function loadExistingSheet(sheet: SheetPlan, sheetFolder: string): Promise<void> {
    console.log(`\n▶ ${sheet.label}: keeping existing stickers...`);
    const sheetDir = resolve(outDir, sheetFolder);
    const frameCount = sheet.cols * sheet.rows;
    for (let i = 0; i < frameCount; i++) {
      globalIndex++;
      const name = `sticker-${pad(i + 1)}.png`;
      const stickerPath = resolve(sheetDir, name);
      if (!existsSync(stickerPath)) {
        throw new Error(`Missing ${stickerPath} (required when using --sheet partial regeneration)`);
      }
      const frame = decodePng(new Uint8Array(await readFile(stickerPath)));
      nativeFrames.push(frame);
      const globalName = `sticker-${pad(globalIndex)}.png`;
      manifest.push({
        globalIndex,
        sheet: sheet.label,
        index: i + 1,
        file: `${sheet.label}/${name}`,
        uploadFile: `stickers/${globalName}`,
        phrase: sheet.phrases[i] ?? '',
        width: frame.width,
        height: frame.height,
      });
    }
  }

  async function runGenerateOneSheet(
    sheet: SheetPlan,
    sheetFolder: string,
    indexStart: number,
    sheetIndexInJob: number,
    priorSheetFolder?: string
  ): Promise<{ folder: string; entries: Array<Record<string, unknown>>; frames: RgbaImage[]; score: number }> {
    console.log(`\n▶ ${sheetFolder}:`);
    const slots = buildSlots(config, sheet.phrases);
    const result = await generateOneSheet({
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
      fontKey,
      textColorKey,
      maxSheetRetries,
      minGridAlignmentScore,
      extraSheetRegenAttempts,
      isolatedSheetRun,
      globalIndexStart: indexStart,
      promptVersion,
      styleAnchorFromPriorSheet,
      priorSheetFolder,
      logPrefix: '   · ',
    });
    gridScores[sheetFolder] = result.gridScore;
    return {
      folder: sheetFolder,
      entries: result.manifestEntries,
      frames: result.frames,
      score: result.gridScore,
    };
  }

  const sheetsNeedingGeneration = iterationSheets.filter((sheet) =>
    sheetsToGenerate.some((candidate) => candidate.label === sheet.label)
  );
  const canParallelize =
    !isolatedSheetRun &&
    !styleAnchorFromPriorSheet &&
    sheetsNeedingGeneration.length > 1 &&
    iterationSheets.length > 1;

  if (canParallelize) {
    console.log(`\n▶ parallel sheet generation (${sheetsNeedingGeneration.length} sheets)...`);

    const indexByLabel = new Map<string, number>();
    let nextStart = 0;
    for (const sheet of iterationSheets) {
      indexByLabel.set(sheet.label, nextStart);
      nextStart += sheet.cols * sheet.rows;
    }

    const parallelResults = await Promise.all(
      sheetsNeedingGeneration.map((sheet) => {
        const sheetIdx = iterationSheets.findIndex((s) => s.label === sheet.label);
        return runGenerateOneSheet(
          sheet,
          sheet.label,
          indexByLabel.get(sheet.label) ?? 0,
          sheetIdx,
          undefined
        );
      })
    );
    const resultByLabel = new Map(parallelResults.map((r) => [r.folder, r]));

    for (const sheet of iterationSheets) {
      const shouldGenerate = sheetsToGenerate.some((c) => c.label === sheet.label);
      if (!shouldGenerate) {
        await loadExistingSheet(sheet, sheet.label);
        continue;
      }
      const result = resultByLabel.get(sheet.label);
      if (!result) {
        throw new Error(`Missing generation result for ${sheet.label}`);
      }
      for (const entry of result.entries) {
        nativeFrames.push(result.frames[entry.index - 1]!);
        manifest.push(entry);
        globalIndex = entry.globalIndex as number;
      }
    }
  } else {
    for (let si = 0; si < iterationSheets.length; si++) {
      const sheet = iterationSheets[si]!;
      const shouldGenerate = sheetsToGenerate.some((candidate) => candidate.label === sheet.label);
      const sheetFolder = isolatedSheetRun ? sheetDirOverride! : sheet.label;
      const priorSheetFolder = styleAnchorFromPriorSheet
        ? resolvePriorSheetFolder(sheet.label, si, iterationSheets, isolatedSheetRun)
        : undefined;

      if (!shouldGenerate) {
        await loadExistingSheet(sheet, sheetFolder);
        continue;
      }

      const result = await runGenerateOneSheet(
        sheet,
        sheetFolder,
        globalIndex,
        si,
        priorSheetFolder
      );
      for (const entry of result.entries) {
        nativeFrames.push(result.frames[entry.index - 1]!);
        manifest.push(entry);
        globalIndex = entry.globalIndex as number;
      }
    }
  }

  usedSheetFolders.length = 0;
  for (const sheet of iterationSheets) {
    const folder =
      isolatedSheetRun && sheetsToGenerate.some((c) => c.label === sheet.label)
        ? sheetDirOverride!
        : sheet.label;
    usedSheetFolders.push(folder);
  }

  const jobConfig = { ...config, model, textRendering, promptVersion };
  const manifestPath = isolatedSheetRun
    ? resolve(outDir, sheetDirOverride!, 'manifest.json')
    : resolve(outDir, 'manifest.json');

  if (isolatedSheetRun) {
    const isolatedManifest = {
      config: jobConfig,
      sheet: sheetDirOverride,
      gridScores,
      stickers: manifest,
    };
    await writeFile(manifestPath, JSON.stringify(isolatedManifest, null, 2));
    console.log(`\n✓ Sheet regen done. ${manifest.length} stickers in ${sheetDirOverride}`);
    console.log(`  manifest: ${manifestPath}`);
    console.log('\n▶ Next: merge sheets and repack to line-s:');
    console.log(
      `  npx tsx .claude/skills/line-sticker-maker/scripts/finalize.mts --out "${outDir}" --config "${configArg}"` +
        (sheetDirOverride ? ` --sheets <sheet-1>,${sheetDirOverride}` : '')
    );
    return;
  }

  const shouldFinalize =
    config.lineUpload !== false &&
    (config.scope ?? 'set') === 'set' &&
    usedSheetFolders.length > 0;

  if (shouldFinalize) {
    const finalizeResult = await finalizeStickerJob({
      outDir,
      sheetDirs: usedSheetFolders,
      config: jobConfig,
    });
    console.log(`\n✓ All done. ${finalizeResult.stickerCount} stickers in ${outDir}`);
    console.log(`  activeSheets: ${finalizeResult.activeSheets.join(', ')}`);
    console.log(`  manifest: ${resolve(outDir, 'manifest.json')}`);
    if (finalizeResult.lineSDest) {
      console.log(`  line-s upload: ${finalizeResult.lineSDest}`);
    } else {
      console.log(`  upload: ${resolve(outDir, 'line-upload.zip')}`);
    }
    return;
  }

  const manifestPathFallback = resolve(outDir, 'manifest.json');
  await writeFile(
    manifestPathFallback,
    JSON.stringify(
      { config: jobConfig, activeSheets: usedSheetFolders, gridScores, stickers: manifest },
      null,
      2
    )
  );

  console.log(`\n✓ All done. ${manifest.length} stickers in ${outDir}`);
  console.log(`  stickers: ${stickersDir}`);
  console.log(`  manifest: ${manifestPathFallback}`);
}

main().catch((err) => {
  console.error('✗ Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
