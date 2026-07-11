/**
 * Resolve phrase list for re-overlaying one sheet directory.
 */

import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { parsePhraseSetJson } from './lineStickerPhraseSetFormat';

export interface LoadSheetPhrasesOptions {
  sheetDir: string;
  cols: number;
  rows: number;
  phraseOffset?: number;
  explicitPhrasesPath?: string;
  jobConfigPath?: string;
}

/** Default phrase offset from sheet folder name (sheet-2 → 20 when grid is 4×5). */
export function sheetPhraseOffsetFromDir(
  sheetDir: string,
  cols: number,
  rows: number
): number {
  const match = basename(sheetDir).match(/sheet-(\d+)/i);
  if (!match) {
    return 0;
  }
  const sheetIndex = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(sheetIndex) || sheetIndex < 1) {
    return 0;
  }
  return (sheetIndex - 1) * cols * rows;
}

export function slicePhraseWindow(
  phrases: string[],
  offset: number,
  count: number
): string[] {
  return phrases.slice(offset, offset + count);
}

async function readPhraseSetFile(path: string): Promise<string[] | null> {
  if (!existsSync(path)) {
    return null;
  }
  const parsed = parsePhraseSetJson(await readFile(path, 'utf8'));
  return parsed?.phrases ?? null;
}

async function phrasesFromJobManifest(
  jobDir: string,
  sheetDir: string,
  count: number
): Promise<string[] | null> {
  const manifestPath = resolve(jobDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return null;
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    stickers?: Array<{ sheet?: string; index?: number; phrase?: string }>;
  };
  const sheetName = basename(sheetDir);
  const sheetStickers = (manifest.stickers ?? [])
    .filter((entry) => entry.sheet === sheetName)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (sheetStickers.length === 0) {
    return null;
  }
  return sheetStickers.slice(0, count).map((entry) => entry.phrase ?? '');
}

/** Load phrases for one sheet with explicit path → job phrase-set → job manifest fallbacks. */
export async function loadSheetPhrases(options: LoadSheetPhrasesOptions): Promise<string[]> {
  const {
    sheetDir,
    cols,
    rows,
    explicitPhrasesPath,
    jobConfigPath,
  } = options;
  const count = cols * rows;
  const jobDir = resolve(sheetDir, '..');
  const configPath = jobConfigPath
    ? resolve(jobConfigPath)
    : resolve(jobDir, 'job.config.json');
  const offset =
    options.phraseOffset ??
    sheetPhraseOffsetFromDir(sheetDir, cols, rows);

  if (explicitPhrasesPath) {
    const phrases = await readPhraseSetFile(resolve(explicitPhrasesPath));
    if (!phrases) {
      throw new Error(`Invalid phrase-set: ${explicitPhrasesPath}`);
    }
    return slicePhraseWindow(phrases, offset, count);
  }

  const localManifest = resolve(sheetDir, 'manifest.json');
  if (existsSync(localManifest)) {
    const manifest = JSON.parse(await readFile(localManifest, 'utf8')) as {
      stickers?: Array<{ phrase?: string }>;
    };
    const local = (manifest.stickers ?? []).map((entry) => entry.phrase ?? '');
    if (local.length > 0) {
      return slicePhraseWindow(local, 0, count);
    }
  }

  if (existsSync(configPath)) {
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      phraseSetFile?: string;
    };
    if (config.phraseSetFile) {
      const phrases = await readPhraseSetFile(resolve(jobDir, config.phraseSetFile));
      if (phrases) {
        return slicePhraseWindow(phrases, offset, count);
      }
    }
  }

  const fromJobManifest = await phrasesFromJobManifest(jobDir, sheetDir, count);
  if (fromJobManifest) {
    return fromJobManifest;
  }

  return Array.from({ length: count }, () => '');
}
