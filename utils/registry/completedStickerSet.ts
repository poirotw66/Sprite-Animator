/** Strict, shared validator for outputs that may be marked/resumed as completed. */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface CompletedStickerSetValidation {
  complete: boolean;
  reasons: string[];
  expectedStickerCount: number;
  actualStickerCount: number;
}

interface CompletedManifest {
  completionStatus?: string;
  config?: { stickerCount?: number; minGridAlignmentScore?: number };
  activeSheets?: string[];
  gridScores?: Record<string, number>;
  qaReport?: { pass?: boolean; gridPass?: boolean };
  stickers?: unknown[];
  uploadPackPath?: string;
}

export function validateCompletedStickerSet(outputDir: string): CompletedStickerSetValidation {
  const reasons: string[] = [];
  const manifestPath = join(outputDir, 'manifest.json');
  let manifest: CompletedManifest = {};
  if (!existsSync(manifestPath)) {
    reasons.push('missing manifest.json');
  } else {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CompletedManifest;
    } catch {
      reasons.push('invalid manifest.json');
    }
  }

  const expectedStickerCount = manifest.config?.stickerCount ?? 40;
  const actualStickerCount = Array.isArray(manifest.stickers) ? manifest.stickers.length : 0;
  if (manifest.completionStatus && manifest.completionStatus !== 'completed') {
    reasons.push(`completionStatus is ${manifest.completionStatus}`);
  }
  if (actualStickerCount !== expectedStickerCount) {
    reasons.push(`manifest has ${actualStickerCount}/${expectedStickerCount} stickers`);
  }

  const stickersDir = join(outputDir, 'stickers');
  for (let i = 1; i <= expectedStickerCount; i++) {
    const file = join(stickersDir, `sticker-${String(i).padStart(2, '0')}.png`);
    if (!existsSync(file) || !statSync(file).isFile()) {
      reasons.push(`missing stickers/sticker-${String(i).padStart(2, '0')}.png`);
      break;
    }
  }

  if (!manifest.activeSheets?.length) {
    reasons.push('missing activeSheets');
  } else {
    for (const sheet of manifest.activeSheets) {
      if (!existsSync(join(outputDir, sheet, '_processed-sheet.png'))) {
        reasons.push(`missing ${sheet}/_processed-sheet.png`);
      }
    }
  }

  const minGridScore = manifest.config?.minGridAlignmentScore ?? 0.8;
  if (!manifest.gridScores || Object.keys(manifest.gridScores).length === 0) {
    reasons.push('missing gridScores');
  } else if (Object.values(manifest.gridScores).some((score) => score < minGridScore)) {
    reasons.push(`grid score below ${minGridScore}`);
  }
  if (manifest.qaReport?.pass !== true || manifest.qaReport.gridPass === false) {
    reasons.push('QA did not pass');
  }

  const zipDirs = [outputDir, manifest.uploadPackPath].filter((value): value is string => Boolean(value));
  const hasZip = zipDirs.some((dir) => {
    try {
      return readdirSync(dir).some((name) => name.toLowerCase().endsWith('.zip'));
    } catch {
      return false;
    }
  });
  if (!hasZip) reasons.push('missing upload ZIP');

  return {
    complete: reasons.length === 0,
    reasons,
    expectedStickerCount,
    actualStickerCount,
  };
}

export function isCompletedStickerSet(outputDir: string): boolean {
  return validateCompletedStickerSet(outputDir).complete;
}
