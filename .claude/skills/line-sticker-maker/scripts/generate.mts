/**
 * LINE sticker generator — headless entry point for the skill.
 *
 *   npx tsx generate.mts --config <config.json> --out <dir> [--dry-run]
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
  THEME_PRESETS,
  TEXT_PRESETS,
  STYLE_PRESETS,
  DEFAULT_CHARACTER_SLOT,
  type PromptSlots,
  type StyleSlot,
  type ThemeSlot,
} from '../../../../utils/lineStickerPrompt.ts';
import type { ChromaKeyColorType } from '../../../../types.ts';

import { generateSheetImage } from './geminiSheet.mts';
import { decodeImage, encodePng, extForBytes, removeChromaKey, sliceSheet } from './nodeImage.mts';
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
  language?: string; // TEXT_PRESETS key (default: zh-TW)
  chromaKeyColor?: ChromaKeyColorType; // default: green
  includeText?: boolean; // default: true (model draws text)
  scope?: 'set' | 'single'; // default: set
  stickerCount?: number; // set mode only: 40 (LINE default) or 48 (legacy)
  cols?: number; // single mode only (default 4)
  rows?: number; // single mode only (default 6)
  model?: string; // default: gemini-3.1-flash-lite-image
  resolution?: string; // output resolution, default: 1K (model-dependent)
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

interface SheetPlan {
  label: string;
  cols: number;
  rows: number;
  phrases: string[];
}

function planSheets(config: StickerConfig): SheetPlan[] {
  const scope = config.scope ?? 'set';
  if (scope === 'single') {
    const cols = config.cols ?? 4;
    const rows = config.rows ?? 6;
    const phrases = buildPhraseList(config, cols * rows);
    return [{ label: 'sheet-1', cols, rows, phrases }];
  }

  const stickerCount = config.stickerCount ?? DEFAULT_LINE_STICKER_SET_COUNT;
  const layouts = resolveSetLayout(stickerCount);
  const all = buildPhraseList(config, stickerCount);
  const phraseSlices = splitPhrasesAcrossSheets(all, layouts);

  return layouts.map((layout, sheetIndex) => ({
    label: `sheet-${sheetIndex + 1}`,
    cols: layout.cols,
    rows: layout.rows,
    phrases: phraseSlices[sheetIndex] ?? [],
  }));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
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

  const outDir = resolve(process.cwd(), (args.out as string) ?? 'line-stickers-out');
  const includeText = config.includeText ?? true;
  const chromaKeyColor: ChromaKeyColorType = config.chromaKeyColor ?? 'green';
  const model = config.model ?? 'gemini-3.1-flash-lite-image';
  const resolution = config.resolution ?? '1K';

  const sheets = planSheets(config);
  const stickerTotal = sheets.reduce((sum, sheet) => sum + sheet.cols * sheet.rows, 0);

  console.log(
    `▶ LINE sticker job: scope=${config.scope ?? 'set'}, stickers=${stickerTotal}, sheets=${sheets.length}, ` +
      `chroma=${chromaKeyColor}, text=${includeText ? 'model-drawn' : 'none'}, model=${model}, resolution=${resolution}`
  );

  if (dryRun) {
    for (const sheet of sheets) {
      const slots = buildSlots(config, sheet.phrases);
      const prompt = buildLineStickerPrompt(
        slots, sheet.cols, sheet.rows, chromaKeyColor, includeText, undefined, 'v3'
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

  for (const sheet of sheets) {
    const slots = buildSlots(config, sheet.phrases);
    const prompt = buildLineStickerPrompt(
      slots, sheet.cols, sheet.rows, chromaKeyColor, includeText, undefined, 'v3'
    );

    console.log(`\n▶ ${sheet.label}: generating ${sheet.cols}x${sheet.rows} sheet...`);
    const rawPng = await generateSheetImage({
      referenceBase64,
      referenceMimeType,
      prompt,
      cols: sheet.cols,
      rows: sheet.rows,
      apiKey,
      model,
      chromaKeyColor,
      includeText,
      outputResolution: resolution,
      onStatus: (m) => console.log(`   · ${m}`),
    });

    const sheetDir = resolve(outDir, sheet.label);
    await mkdir(sheetDir, { recursive: true });
    await writeFile(resolve(sheetDir, `_raw-sheet.${extForBytes(rawPng)}`), rawPng);

    console.log(`   · removing chroma background...`);
    const image = decodeImage(rawPng);
    removeChromaKey(image, chromaKeyColor);
    await writeFile(resolve(sheetDir, '_processed-sheet.png'), encodePng(image));

    console.log(`   · slicing into ${sheet.cols * sheet.rows} stickers (native ${Math.floor(image.width / sheet.cols)}x${Math.floor(image.height / sheet.rows)} px)...`);
    const frames = sliceSheet(image, sheet.cols, sheet.rows);
    for (let i = 0; i < frames.length; i++) {
      globalIndex++;
      const name = `sticker-${pad(i + 1)}.png`;
      const globalName = `sticker-${pad(globalIndex)}.png`;
      const png = encodePng(frames[i]);
      await writeFile(resolve(sheetDir, name), png);
      await writeFile(resolve(stickersDir, globalName), png);
      manifest.push({
        globalIndex,
        sheet: sheet.label,
        index: i + 1,
        file: `${sheet.label}/${name}`,
        uploadFile: `stickers/${globalName}`,
        phrase: sheet.phrases[i] ?? '',
        width: frames[i].width,
        height: frames[i].height,
      });
    }
    console.log(`   ✓ ${sheet.label} done -> ${sheetDir}`);
  }

  await writeFile(
    resolve(outDir, 'manifest.json'),
    JSON.stringify({ config, stickers: manifest }, null, 2)
  );
  console.log(`\n✓ All done. ${manifest.length} stickers in ${outDir}`);
  console.log(`  upload folder: ${stickersDir}`);
  console.log(`  manifest: ${resolve(outDir, 'manifest.json')}`);
}

main().catch((err) => {
  console.error('✗ Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
