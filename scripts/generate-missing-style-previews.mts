/**
 * Generate missing public/style-previews/{styleKey}.png from a reference photo.
 *
 *   npx tsx scripts/generate-missing-style-previews.mts --image example/chae.jpg
 *   npx tsx scripts/generate-missing-style-previews.mts --image example/chae.jpg --only trigger,sumiE
 *   npx tsx scripts/generate-missing-style-previews.mts --image example/chae.jpg --dry-run
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGeminiApiKey } from '../skills/shared/loadGeminiApiKey.mts';
import { generateSpriteSheet } from '../services/gemini/spriteSheet.ts';
import { DEFAULT_MODEL, defaultResolutionForModel } from '../utils/constants.ts';
import {
  DEFAULT_CHARACTER_SLOT,
  STYLE_PRESET_ORDER,
  STYLE_PRESETS,
} from '../utils/lineStickerPresets.ts';
import { buildLineStickerStylePreviewPrompt } from '../utils/lineStickerPrompt.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/style-previews');

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

function mimeFromPath(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function existingPreviewKeys(): Set<string> {
  if (!existsSync(OUT_DIR)) return new Set();
  return new Set(
    readdirSync(OUT_DIR)
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .map((f) => f.replace(/\.png$/i, '').toLowerCase())
  );
}

function missingStyleKeys(only?: Set<string>): string[] {
  const have = existingPreviewKeys();
  return STYLE_PRESET_ORDER.filter((key) => {
    if (key === 'matchUploaded') return false;
    if (only && !only.has(key)) return false;
    return !have.has(key.toLowerCase());
  });
}

function dataUrlToPngBuffer(dataUrl: string): Buffer {
  const m = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!m?.[1]) throw new Error('Expected data URL image from generateSpriteSheet');
  return Buffer.from(m[1], 'base64');
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i]!, i);
    }
  });
  await Promise.all(runners);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const imageArg = typeof args.image === 'string' ? args.image : 'example/chae.jpg';
  const dryRun = Boolean(args['dry-run']);
  const concurrency = Math.max(1, Number(args.concurrency ?? 2) || 2);
  const only = typeof args.only === 'string'
    ? new Set(args.only.split(',').map((s) => s.trim()).filter(Boolean))
    : undefined;

  const imagePath = resolve(ROOT, imageArg);
  if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);

  const keys = missingStyleKeys(only);
  console.log(`Reference: ${imagePath}`);
  console.log(`Missing style previews: ${keys.length}`);
  for (const k of keys) {
    const label = STYLE_PRESETS[k]?.label ?? k;
    console.log(`  - ${k} (${label})`);
  }
  if (keys.length === 0) {
    console.log('Nothing to generate.');
    return;
  }
  if (dryRun) return;

  const apiKey = loadGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY not found (env / .env / .env.local).');

  const mime = mimeFromPath(imagePath);
  const imageBase64 = `data:${mime};base64,${readFileSync(imagePath).toString('base64')}`;
  const model = typeof args.model === 'string' ? args.model : DEFAULT_MODEL;
  const resolution = (typeof args.resolution === 'string'
    ? args.resolution
    : defaultResolutionForModel(model)) as '1K' | '2K' | '4K';

  await mkdir(OUT_DIR, { recursive: true });

  const failed: string[] = [];
  await mapPool(keys, concurrency, async (styleKey) => {
    const preset = STYLE_PRESETS[styleKey];
    if (!preset) {
      failed.push(styleKey);
      console.error(`✗ unknown style: ${styleKey}`);
      return;
    }
    const outPath = resolve(OUT_DIR, `${styleKey}.png`);
    console.log(`▶ ${styleKey} (${preset.label})…`);
    try {
      const prompt = buildLineStickerStylePreviewPrompt({
        style: preset,
        character: DEFAULT_CHARACTER_SLOT,
      });
      const dataUrl = await generateSpriteSheet(
        imageBase64,
        prompt,
        1,
        1,
        apiKey,
        model,
        (msg) => console.log(`  [${styleKey}] ${msg}`),
        'green',
        resolution,
        false
      );
      await writeFile(outPath, dataUrlToPngBuffer(dataUrl));
      console.log(`✓ ${styleKey} → ${outPath}`);
    } catch (err) {
      failed.push(styleKey);
      console.error(`✗ ${styleKey}:`, err instanceof Error ? err.message : err);
    }
  });

  console.log(`\nDone. ok=${keys.length - failed.length} failed=${failed.length}`);
  if (failed.length) {
    console.log('Failed:', failed.join(', '));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
