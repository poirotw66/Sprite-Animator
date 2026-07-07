/**
 * Design and validate line-sticker-phrase-set JSON (phrases + actionDescs).
 *
 *   npx tsx design-phrase-set.mts \
 *     --theme daily \
 *     --mode set --count 40 \
 *     --language zh-TW \
 *     --name "奶油貓日常" \
 *     --voice meme \
 *     --voice-context "老公俠吐槽風格" \
 *
 *   npx tsx design-phrase-set.mts --theme-context "戀愛撒嬌" --mode set --count 40 --out ...
 *   npx tsx design-phrase-set.mts --theme daily --preset-only --mode set --count 40 --out ...
 *   npx tsx design-phrase-set.mts --validate path/to/phrases.json
 *   npx tsx design-phrase-set.mts --actions-only path/to/phrases.json --out path/to/out.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { generateActionDescriptions } from '../../../../services/gemini/actionDescriptions.ts';
import { generateStickerPhrases } from '../../../../services/gemini/stickerPhrases.ts';
import { clampStickerPhrase } from '../../../../utils/lineStickerPhraseLength.ts';
import {
  auditStickerPhrases,
  polishStickerPhrases,
} from '../../../../utils/lineStickerPhraseQuality.ts';
import {
  buildPhraseSetExport,
  parsePhraseSetJson,
  PHRASE_SET_FORMAT,
  PHRASE_SET_VERSION,
  type LineStickerPhraseSetJson,
} from '../../../../utils/lineStickerPhraseSetFormat.ts';
import {
  expandThemePhrasesForFrames,
  getActionHint,
  TEXT_PRESETS,
  THEME_PRESETS,
  type ThemeOption,
} from '../../../../utils/lineStickerPrompt.ts';
import {
  listStickerVoiceKeys,
  resolveStickerVoice,
} from '../../../../utils/lineStickerVoicePresets.ts';
import { loadApiKey, ROOT_DIR } from './apiKey.mts';

const THEME_KEYS = Object.keys(THEME_PRESETS);
const VOICE_KEYS = listStickerVoiceKeys();

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function resolveLanguageLabel(languageKey: string): string {
  const preset = TEXT_PRESETS[languageKey as keyof typeof TEXT_PRESETS];
  return preset?.label ?? languageKey;
}

function buildThemeContext(themeKey: string | undefined, themeContext: string | undefined): string {
  if (themeContext?.trim()) {
    return themeContext.trim();
  }
  if (themeKey && themeKey in THEME_PRESETS) {
    const theme = THEME_PRESETS[themeKey as ThemeOption];
    return `${theme.label} (${theme.chatContext})`;
  }
  throw new Error(`Provide --theme <${THEME_KEYS.join('|')}> or --theme-context "..."`);
}

function countNonEmpty(phrases: string[]): number {
  return phrases.filter((p) => p.trim().length > 0).length;
}

function findDuplicatePhrases(phrases: string[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const phrase of phrases) {
    const key = phrase.trim();
    if (!key) continue;
    if (seen.has(key)) dupes.push(key);
    else seen.add(key);
  }
  return dupes;
}

function validatePhraseLengths(phrases: string[], languageLabel: string): string[] {
  const warnings: string[] = [];
  for (const entry of auditStickerPhrases(phrases, languageLabel)) {
    if (!entry.phrase.trim()) continue;
    const label = `phrase[${entry.index + 1}] "${entry.phrase}"`;
    for (const issue of entry.issues) {
      const prefix = ['too_long', 'emoji', 'forbidden_char', 'english_too_wordy', 'empty'].includes(
        issue.code
      )
        ? '✗'
        : '⚠';
      warnings.push(`${prefix} ${label}: ${issue.message}`);
    }
  }
  return warnings;
}

async function validatePhraseSetFile(path: string, languageLabel = 'Traditional Chinese'): Promise<number> {
  const raw = await readFile(path, 'utf8');
  let filePhraseCount = 0;
  try {
    const data = JSON.parse(raw) as { phrases?: unknown };
    if (Array.isArray(data.phrases)) filePhraseCount = data.phrases.length;
  } catch {
    /* parsePhraseSetJson will report invalid */
  }

  const parsed = parsePhraseSetJson(raw);
  if (!parsed) {
    throw new Error(`Invalid phrase-set JSON: ${path}`);
  }

  const nonEmpty = countNonEmpty(parsed.phrases);
  const dupes = findDuplicatePhrases(parsed.phrases);
  const lengthWarnings = validatePhraseLengths(parsed.phrases, languageLabel);

  console.log(`✓ Valid phrase-set: ${path}`);
  console.log(`  name: ${parsed.name ?? '(none)'}`);
  console.log(`  mode: ${parsed.mode}`);
  if (parsed.mode === 'single') {
    console.log(`  grid: ${parsed.gridCols}×${parsed.gridRows}`);
  }
  console.log(`  phrases: ${filePhraseCount || parsed.phrases.length} (${nonEmpty} non-empty)`);
  console.log(`  actionDescs: ${parsed.actionDescs?.length ?? 0}`);

  if (dupes.length > 0) {
    console.warn(`  ⚠ duplicate phrases: ${dupes.join(', ')}`);
  }
  for (const warning of lengthWarnings) {
    console.warn(`  ⚠ ${warning}`);
  }
  if (parsed.mode === 'set' && nonEmpty < 8) {
    console.warn('  ⚠ very few phrases for a set — consider at least 32–40');
  }

  return nonEmpty > 0 ? 0 : 1;
}

async function writePhraseSet(outPath: string, data: LineStickerPhraseSetJson): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
}

async function designPhraseSet(args: Record<string, string | boolean>): Promise<void> {
  const outArg = args.out;
  if (!outArg || typeof outArg !== 'string') {
    throw new Error('Missing --out <path/to/phrases.json>');
  }

  const mode = args.mode === 'single' ? 'single' : 'set';
  const languageKey = typeof args.language === 'string' ? args.language : 'zh-TW';
  const languageLabel = resolveLanguageLabel(languageKey);
  const count =
    mode === 'set'
      ? Number.parseInt(String(args.count ?? '40'), 10)
      : (Number.parseInt(String(args.cols ?? '4'), 10) *
          Number.parseInt(String(args.rows ?? '5'), 10));
  if (!Number.isFinite(count) || count < 1) {
    throw new Error('Invalid --count or --cols/--rows');
  }

  const themeKey = typeof args.theme === 'string' ? args.theme : undefined;
  const themeContext = typeof args['theme-context'] === 'string' ? args['theme-context'] : undefined;
  const fullContext = buildThemeContext(themeKey, themeContext);
  const presetOnly = Boolean(args['preset-only']);
  const skipActions = Boolean(args['no-actions']);
  const name = typeof args.name === 'string' ? args.name.trim() : undefined;
  const voiceKey = typeof args.voice === 'string' ? args.voice : undefined;
  const voiceContext = typeof args['voice-context'] === 'string' ? args['voice-context'] : undefined;
  const voice = resolveStickerVoice(voiceKey, voiceContext);

  let phrases: string[];
  if (presetOnly) {
    if (!themeKey || !(themeKey in THEME_PRESETS)) {
      throw new Error(`--preset-only requires --theme <${THEME_KEYS.join('|')}>`);
    }
    phrases = expandThemePhrasesForFrames(THEME_PRESETS[themeKey as ThemeOption], count, languageLabel);
  } else {
    const apiKey = loadApiKey();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found (env or .env.local).');
    }
    const examplePhrases =
      themeKey && themeKey in THEME_PRESETS
        ? THEME_PRESETS[themeKey as ThemeOption].examplePhrases
        : [];
    console.log(`▶ Generating ${count} phrases (${languageLabel}, voice: ${voice.label})…`);
    phrases = await generateStickerPhrases(
      apiKey,
      `Character/style: From uploaded reference image only.\nTheme: ${fullContext}`,
      languageLabel,
      count,
      undefined,
      examplePhrases,
      voice.key,
      voiceContext
    );
    if (phrases.length === 0) {
      throw new Error('Gemini returned no phrases');
    }
  }

  let actionDescs: string[];
  if (skipActions) {
    actionDescs = phrases.map(() => getActionHint(''));
  } else if (presetOnly) {
    const apiKey = loadApiKey();
    if (!apiKey) {
      actionDescs = phrases.map(() => getActionHint(''));
      console.warn('  ⚠ no API key — actionDescs use generic hints');
    } else {
      console.log('▶ Generating action descriptions…');
      actionDescs = await generateActionDescriptions(apiKey, phrases, {
        themeContext: fullContext,
        language: languageLabel,
      });
    }
  } else {
    const apiKey = loadApiKey();
    if (!apiKey) throw new Error('GEMINI_API_KEY not found for action descriptions.');
    console.log('▶ Generating action descriptions…');
    actionDescs = await generateActionDescriptions(apiKey, phrases, {
      themeContext: fullContext,
      language: languageLabel,
    });
  }

  while (actionDescs.length < phrases.length) {
    actionDescs.push(getActionHint(''));
  }
  actionDescs = actionDescs.slice(0, phrases.length);

  phrases = polishStickerPhrases(phrases, languageLabel);
  const captionAudit = auditStickerPhrases(phrases, languageLabel);
  const hardFails = captionAudit.filter((entry) =>
    entry.issues.some((issue) =>
      ['empty', 'too_long', 'emoji', 'forbidden_char', 'english_too_wordy'].includes(issue.code)
    )
  );
  if (hardFails.length > 0) {
    const sample = hardFails
      .slice(0, 3)
      .map((e) => `#${e.index + 1} "${e.phrase}"`)
      .join(', ');
    throw new Error(`Sticker caption quality failed for: ${sample}`);
  }
  const softWarnings = validatePhraseLengths(phrases, languageLabel);
  for (const warning of softWarnings) {
    console.warn(`  ${warning}`);
  }

  const gridCols = mode === 'single' ? Number.parseInt(String(args.cols ?? '4'), 10) : 4;
  const gridRows = mode === 'single' ? Number.parseInt(String(args.rows ?? '5'), 10) : 5;

  const exportData: LineStickerPhraseSetJson =
    mode === 'single'
      ? buildPhraseSetExport({
          mode,
          gridCols,
          gridRows,
          phrases,
          actionDescs,
          name,
        })
      : {
          format: PHRASE_SET_FORMAT,
          version: PHRASE_SET_VERSION,
          mode: 'set',
          phrases,
          actionDescs,
          name,
        };

  const outPath = resolve(ROOT_DIR, outArg);
  await writePhraseSet(outPath, exportData);
  await validatePhraseSetFile(outPath, languageLabel);
}

async function actionsOnly(args: Record<string, string | boolean>): Promise<void> {
  const inputArg = args['actions-only'];
  if (!inputArg || typeof inputArg !== 'string') {
    throw new Error('Missing --actions-only <phrases.json>');
  }
  const outArg = args.out;
  const inputPath = resolve(ROOT_DIR, inputArg);
  const raw = await readFile(inputPath, 'utf8');
  const parsed = parsePhraseSetJson(raw);
  if (!parsed) {
    throw new Error(`Invalid phrase-set JSON: ${inputArg}`);
  }

  const apiKey = loadApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY not found.');

  const languageKey = typeof args.language === 'string' ? args.language : 'zh-TW';
  const languageLabel = resolveLanguageLabel(languageKey);
  const themeContext =
    typeof args['theme-context'] === 'string'
      ? args['theme-context']
      : typeof args.theme === 'string' && args.theme in THEME_PRESETS
        ? buildThemeContext(args.theme, undefined)
        : 'General chat context';

  console.log(`▶ Generating ${parsed.phrases.length} action descriptions…`);
  const actionDescs = await generateActionDescriptions(apiKey, parsed.phrases, {
    themeContext,
    language: languageLabel,
  });

  const updated: LineStickerPhraseSetJson = { ...parsed, actionDescs };
  const outPath = resolve(ROOT_DIR, typeof outArg === 'string' ? outArg : inputArg);
  await writePhraseSet(outPath, updated);
  await validatePhraseSetFile(outPath);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.validate) {
    const path = typeof args.validate === 'string' ? args.validate : '';
    if (!path) throw new Error('Missing --validate <phrases.json>');
    const code = await validatePhraseSetFile(resolve(ROOT_DIR, path), 'Traditional Chinese');
    process.exit(code);
  }

  if (args['actions-only']) {
    await actionsOnly(args);
    return;
  }

  await designPhraseSet(args);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
