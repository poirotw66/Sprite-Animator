/**
 * Rebuild LINE upload pack from existing sheet folders (no Gemini call).
 *
 *   npx tsx rebuild-line-upload.mts --out <dir> --sheets sheet-1-flash,sheet-2
 *     [--config p1-job.config.json] [--main 1] [--tab 1]
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodePng, encodePng, type RgbaImage } from './nodeImage.mts';
import { writeLineUploadPack, type LineUploadPackOptions } from './lineUploadPack.mts';
import { resolveSetLayout } from './sheetPlan.ts';
import { DEFAULT_LINE_STICKER_SET_COUNT } from './sheetPlan.ts';

interface JobConfig {
  stickerCount?: number;
  mainStickerIndex?: number;
  tabStickerIndex?: number;
  lineUploadStickerCount?: number;
  customPhrases?: string[];
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
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

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(process.cwd(), args.out ?? '');
const sheetsArg = args.sheets ?? '';
if (!outDir || !sheetsArg) {
  console.error(
    'Usage: rebuild-line-upload.mts --out <dir> --sheets sheet-1-flash,sheet-2 [--config job.json]'
  );
  process.exit(1);
}

const sheetFolders = sheetsArg.split(',').map((name) => name.trim()).filter(Boolean);
let config: JobConfig = {};
if (args.config) {
  const configPath = resolve(process.cwd(), args.config);
  config = JSON.parse(await readFile(configPath, 'utf8')) as JobConfig;
}

const stickerCount = config.stickerCount ?? DEFAULT_LINE_STICKER_SET_COUNT;
const layouts = resolveSetLayout(stickerCount);
if (sheetFolders.length !== layouts.length) {
  throw new Error(
    `Expected ${layouts.length} sheet folders for ${stickerCount} stickers, got ${sheetFolders.length}: ${sheetFolders.join(', ')}`
  );
}

const manifestPath = resolve(outDir, 'manifest.json');
const existingManifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{}')) as {
  config?: JobConfig;
  stickers?: Array<{ phrase?: string }>;
};
if (existingManifest.config) {
  config = { ...existingManifest.config, ...config };
}
const phrases: string[] = [...(config.customPhrases ?? [])];
if (phrases.length === 0 && existingManifest.stickers?.length) {
  phrases.push(...existingManifest.stickers.map((entry) => entry.phrase ?? ''));
}
const nativeFrames: RgbaImage[] = [];
const manifest: Array<Record<string, unknown>> = [];
const stickersDir = resolve(outDir, 'stickers');
await mkdir(stickersDir, { recursive: true });

let globalIndex = 0;
for (let sheetIndex = 0; sheetIndex < sheetFolders.length; sheetIndex++) {
  const sheetFolder = sheetFolders[sheetIndex]!;
  const layout = layouts[sheetIndex]!;
  const frameCount = layout.cols * layout.rows;
  const sheetDir = resolve(outDir, sheetFolder);
  console.log(`▶ ${sheetFolder}: loading ${frameCount} stickers...`);
  const frames = await loadSheetFrames(sheetDir, frameCount);

  for (let i = 0; i < frames.length; i++) {
    globalIndex++;
    const frame = frames[i]!;
    nativeFrames.push(frame);
    const localName = `sticker-${pad(i + 1)}.png`;
    const globalName = `sticker-${pad(globalIndex)}.png`;
    await writeFile(resolve(stickersDir, globalName), encodePng(frame));
    manifest.push({
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

const toZeroBased = (oneBased: number | undefined, fallback: number) =>
  Math.max(0, (oneBased ?? fallback) - 1);

const uploadOptions: LineUploadPackOptions = {
  stickerCount: config.lineUploadStickerCount,
};
if (args.main) {
  uploadOptions.mainStickerIndex = Number(args.main) - 1;
} else if (config.mainStickerIndex != null) {
  uploadOptions.mainStickerIndex = toZeroBased(config.mainStickerIndex, 1);
}
if (args.tab) {
  uploadOptions.tabStickerIndex = Number(args.tab) - 1;
} else if (config.tabStickerIndex != null) {
  uploadOptions.tabStickerIndex = toZeroBased(config.tabStickerIndex, 1);
}

console.log('\n▶ Building LINE Creators Market upload pack...');
const uploadPack = await writeLineUploadPack(outDir, nativeFrames, uploadOptions);
uploadPack.warnings.forEach((warning) => console.warn(`   ! ${warning}`));
console.log(
  `   · shop images: main=sticker-${String(uploadPack.mainStickerIndex).padStart(2, '0')}, tab=sticker-${String(uploadPack.tabStickerIndex).padStart(2, '0')}`
);

await writeFile(
  manifestPath,
  JSON.stringify({ ...existingManifest, config: existingManifest.config ?? config, stickers: manifest }, null, 2)
);

console.log(
  `   ✓ line-upload/ (${uploadPack.stickerCount + 2} PNGs) + line-upload.zip`
);
console.log(`\n✓ Done. ${nativeFrames.length} stickers → ${outDir}`);
