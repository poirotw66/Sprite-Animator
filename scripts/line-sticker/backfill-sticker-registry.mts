/**
 * Backfill sticker-registry.json from existing output/ folders.
 *
 *   npx tsx backfill-sticker-registry.mts --dry-run
 *   npx tsx backfill-sticker-registry.mts --merge
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePhraseSetJson } from '../../utils/lineStickerPhraseSetFormat.ts';
import {
  DEFAULT_REGISTRY_REL_PATH,
  formatSetId,
  inferCharacterNameFromPhraseSetName,
  isCompletedStickerSet,
  loadRegistry,
  resolveRefImageInDir,
  saveRegistry,
  type StickerRegistryEntry,
  upsertEntry,
} from '../../utils/registry/stickerRegistry.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../..');

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

async function collectOutputDirs(outputRoot: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    if (isCompletedStickerSet(dir)) {
      results.push(dir);
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'stickers' || entry.name === '.env.batch') continue;
      await walk(join(dir, entry.name));
    }
  }

  if (!existsSync(outputRoot)) {
    return results;
  }
  await walk(outputRoot);
  return results;
}

function inferDateFromPath(outputDir: string): string {
  const parts = outputDir.split(/[/\\]/);
  for (const part of parts) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
      return part;
    }
  }
  return '1970-01-01';
}

function inferBatchType(
  characterName: string,
  outputDir: string,
  earliestBByCharacter: Map<string, string>
): 'A' | 'B' {
  const earliest = earliestBByCharacter.get(characterName);
  if (!earliest || earliest === outputDir) {
    return 'B';
  }
  return 'A';
}

async function buildEntryFromDir(
  outputDir: string,
  slotIndex: number
): Promise<StickerRegistryEntry | undefined> {
  const phraseSetPath = join(outputDir, 'phrase-set.json');
  if (!existsSync(phraseSetPath)) {
    return undefined;
  }

  const refAbs = resolveRefImageInDir(outputDir);
  if (!refAbs) {
    return undefined;
  }

  const raw = await readFile(phraseSetPath, 'utf8');
  const phraseSet = parsePhraseSetJson(raw);
  if (!phraseSet) {
    return undefined;
  }

  const folderName = basename(outputDir);
  const characterName = inferCharacterNameFromPhraseSetName(phraseSet.name, folderName);
  const date = inferDateFromPath(outputDir);
  const relOutput = relative(ROOT, outputDir).replace(/\\/g, '/');
  const relRef = relative(ROOT, refAbs).replace(/\\/g, '/');

  return {
    id: formatSetId(date, slotIndex),
    date,
    batchType: 'B',
    characterName,
    characterConcept: phraseSet.name?.trim() || folderName,
    style: 'chibi',
    theme: 'daily',
    voice: 'nishimura',
    refImagePath: relRef,
    outputDir: relOutput,
    status: 'completed',
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args['dry-run']);
  const merge = Boolean(args.merge);
  if (!dryRun && !merge) {
    throw new Error('Pass --dry-run to preview or --merge to write registry');
  }

  const outputRoot = resolve(ROOT, typeof args.output === 'string' ? args.output : 'output');
  const registryPath = resolve(ROOT, typeof args.registry === 'string' ? args.registry : DEFAULT_REGISTRY_REL_PATH);

  const dirs = await collectOutputDirs(outputRoot);
  const withMtime = await Promise.all(
    dirs.map(async (dir) => ({
      dir,
      mtime: (await stat(dir)).mtimeMs,
    }))
  );
  withMtime.sort((a, b) => a.mtime - b.mtime);

  const earliestBByCharacter = new Map<string, string>();
  const draftEntries: StickerRegistryEntry[] = [];

  for (let i = 0; i < withMtime.length; i++) {
    const { dir } = withMtime[i]!;
    const entry = await buildEntryFromDir(dir, i + 1);
    if (!entry) continue;

    if (!earliestBByCharacter.has(entry.characterName)) {
      earliestBByCharacter.set(entry.characterName, dir);
    }
    draftEntries.push(entry);
  }

  for (const entry of draftEntries) {
    const absOutput = resolve(ROOT, entry.outputDir);
    entry.batchType = inferBatchType(entry.characterName, absOutput, earliestBByCharacter);
  }

  let registry = await loadRegistry(registryPath);
  let added = 0;
  let skipped = 0;

  for (const entry of draftEntries) {
    const existing = registry.entries.find((e) => e.outputDir === entry.outputDir);
    if (existing) {
      skipped++;
      continue;
    }
    registry = upsertEntry(registry, entry);
    added++;
    console.log(`  + ${entry.id} ${entry.batchType} ${entry.characterName} ← ${entry.outputDir}`);
  }

  console.log(`\nBackfill: scanned ${dirs.length} completed sets, add ${added}, skip ${skipped}`);

  if (merge && !dryRun) {
    await saveRegistry(registryPath, registry);
    console.log(`Wrote ${relative(ROOT, registryPath)}`);
  } else if (dryRun) {
    console.log('(dry-run — no file written)');
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
