/**
 * Generate a character model-sheet reference image via Gemini.
 *
 *   npx tsx generate-character-ref.mts \
 *     --concept "圓潤奶油色水獺，頑皮愛撒嬌" \
 *     --style chibi \
 *     --out output/refs/my-character.png
 *
 * Sheet layout is text-only (no layout PNG attachment).
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STYLE_PRESETS } from '../../../utils/lineStickerPresets.ts';
import { DEFAULT_MODEL, defaultResolutionForModel } from '../../../utils/constants.ts';
import { loadGeminiApiKey } from '../../shared/loadGeminiApiKey.mts';
import { buildCharacterRefPrompt, listStyleKeys } from './characterRefPrompt.ts';
import { generateCharacterRefImage } from './geminiCharacterRef.mts';
import { CliUsageError, cliBoolean, parseCliArgs, printCliHelp, reportCliError } from '../../../scripts/line-sticker/cli.mts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(SCRIPT_DIR, '..');
const ROOT_DIR = resolve(SKILL_DIR, '../../..');

const USAGE =
  'Usage: generate-character-ref.mts --concept <description> --out <character-ref.png> [--style <preset>] [--identity-ref <image>] [--dry-run] [--list-styles]';

function mimeFromPath(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'image/png';
}

function resolveImagePath(pathArg: string): string {
  for (const base of [process.cwd(), ROOT_DIR, SKILL_DIR]) {
    const full = resolve(base, pathArg);
    if (existsSync(full)) return full;
  }
  throw new Error(`Image not found: ${pathArg}`);
}

function printStyleTable(): void {
  console.log('Available --style keys:\n');
  for (const key of listStyleKeys()) {
    const preset = STYLE_PRESETS[key];
    console.log(`  ${key.padEnd(14)} ${preset.label}`);
  }
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2), {
    values: ['concept', 'out', 'style', 'style-context', 'name', 'identity-ref', 'model', 'resolution'],
    booleans: ['dry-run', 'list-styles', 'help'],
  });
  if (cliBoolean(args.help)) {
    printCliHelp(USAGE);
    return;
  }

  if (cliBoolean(args['list-styles'])) {
    printStyleTable();
    return;
  }

  const concept = args.concept;
  const outArg = args.out;
  const dryRun = cliBoolean(args['dry-run']);

  if (!concept || typeof concept !== 'string') {
    throw new CliUsageError('Missing --concept "character description"');
  }
  if (!dryRun && (!outArg || typeof outArg !== 'string')) {
    throw new CliUsageError('Missing --out <path/to/character-ref.png>');
  }

  const styleKey = typeof args.style === 'string' ? args.style : 'chibi';
  const styleContext = typeof args['style-context'] === 'string' ? args['style-context'] : undefined;
  const characterName = typeof args.name === 'string' ? args.name : undefined;
  const identityRefArg = typeof args['identity-ref'] === 'string' ? args['identity-ref'] : undefined;
  const model = typeof args.model === 'string' ? args.model : DEFAULT_MODEL;
  const resolution = typeof args.resolution === 'string' ? args.resolution : defaultResolutionForModel(model);

  const prompt = buildCharacterRefPrompt({
    concept,
    styleKey,
    customStyle: styleContext,
    characterName,
    hasIdentityReference: Boolean(identityRefArg),
  });

  if (dryRun) {
    console.log('=== Character ref prompt (dry-run) ===\n');
    console.log(prompt);
    console.log('\nlayout: text-only (no layout image attached)');
    console.log(`style: ${styleKey}`);
    if (identityRefArg) console.log(`identity-ref: ${identityRefArg}`);
    return;
  }

  const apiKey = loadGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY not found (env or .env.local).');

  let identityBase64: string | undefined;
  let identityMime: string | undefined;
  if (identityRefArg) {
    const identityPath = resolveImagePath(identityRefArg);
    identityBase64 = readFileSync(identityPath).toString('base64');
    identityMime = mimeFromPath(identityPath);
  }

  console.log(`▶ Generating character ref (${STYLE_PRESETS[styleKey as keyof typeof STYLE_PRESETS]?.label ?? styleKey})…`);
  const pngBytes = await generateCharacterRefImage({
    apiKey,
    prompt,
    identityRefBase64: identityBase64,
    identityRefMimeType: identityMime,
    model,
    resolution,
    onStatus: (msg) => console.log(`  … ${msg}`),
  });

  const outPath = resolve(ROOT_DIR, outArg as string);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, pngBytes);
  console.log(`\n✓ Wrote ${outPath}`);
  console.log(`  Use with pipeline: --image ${outArg}`);
}

main().catch((err: unknown) => {
  reportCliError(err, USAGE);
});
