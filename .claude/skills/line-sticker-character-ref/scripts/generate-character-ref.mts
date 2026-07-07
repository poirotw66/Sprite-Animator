/**
 * Generate a character model-sheet reference image via Gemini.
 *
 *   npx tsx generate-character-ref.mts \
 *     --concept "圓潤奶油色水獺，頑皮愛撒嬌" \
 *     --style chibi \
 *     --out output/refs/my-character.png
 *
 * Layout target: reference/model-sheet-layout.png (from p1.png otter model sheet).
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STYLE_PRESETS } from '../../../../utils/lineStickerPresets.ts';
import { DEFAULT_MODEL } from '../../../../utils/constants.ts';
import { loadGeminiApiKey } from '../../shared/loadGeminiApiKey.mts';
import { buildCharacterRefPrompt, listStyleKeys } from './characterRefPrompt.ts';
import { generateCharacterRefImage } from './geminiCharacterRef.mts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(SCRIPT_DIR, '..');
const ROOT_DIR = resolve(SKILL_DIR, '../../..');
const DEFAULT_LAYOUT_REF = resolve(SKILL_DIR, 'reference/model-sheet-layout.png');

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

  const apiKey = loadGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY not found (env or .env.local).');
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
  const args = parseArgs(process.argv.slice(2));

  if (args['list-styles']) {
    printStyleTable();
    return;
  }

  const concept = args.concept;
  const outArg = args.out;
  const dryRun = Boolean(args['dry-run']);

  if (!concept || typeof concept !== 'string') {
    throw new Error('Missing --concept "character description"');
  }
  if (!dryRun && (!outArg || typeof outArg !== 'string')) {
    throw new Error('Missing --out <path/to/character-ref.png>');
  }

  const styleKey = typeof args.style === 'string' ? args.style : 'chibi';
  const styleContext = typeof args['style-context'] === 'string' ? args['style-context'] : undefined;
  const characterName = typeof args.name === 'string' ? args.name : undefined;
  const layoutRefArg = typeof args['layout-ref'] === 'string' ? args['layout-ref'] : DEFAULT_LAYOUT_REF;
  const identityRefArg = typeof args['identity-ref'] === 'string' ? args['identity-ref'] : undefined;
  const model = typeof args.model === 'string' ? args.model : DEFAULT_MODEL;
  const resolution = typeof args.resolution === 'string' ? args.resolution : '1K';

  const layoutPath = resolveImagePath(layoutRefArg);
  const prompt = buildCharacterRefPrompt({
    concept,
    styleKey,
    customStyle: styleContext,
    characterName,
  });

  if (dryRun) {
    console.log('=== Character ref prompt (dry-run) ===\n');
    console.log(prompt);
    console.log(`\nlayout-ref: ${layoutPath}`);
    console.log(`style: ${styleKey}`);
    if (identityRefArg) console.log(`identity-ref: ${identityRefArg}`);
    return;
  }

  const apiKey = loadGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY not found (env or .env.local).');

  const layoutBase64 = readFileSync(layoutPath).toString('base64');
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
    layoutRefBase64: layoutBase64,
    layoutRefMimeType: mimeFromPath(layoutPath),
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
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
