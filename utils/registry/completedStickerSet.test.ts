import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { validateCompletedStickerSet } from './completedStickerSet';

const dirs: string[] = [];

function fixture(qaPass = true): string {
  const dir = mkdtempSync(join(tmpdir(), 'sticker-complete-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'stickers'));
  mkdirSync(join(dir, 'sheet-1'));
  writeFileSync(join(dir, 'sheet-1', '_processed-sheet.png'), 'png');
  for (let i = 1; i <= 2; i++) {
    writeFileSync(join(dir, 'stickers', `sticker-${String(i).padStart(2, '0')}.png`), 'png');
  }
  writeFileSync(join(dir, 'line-upload.zip'), 'zip');
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
    completionStatus: qaPass ? 'completed' : 'qa_failed',
    config: { stickerCount: 2, minGridAlignmentScore: 0.8 },
    activeSheets: ['sheet-1'],
    gridScores: { 'sheet-1': 0.9 },
    qaReport: { pass: qaPass, gridPass: true },
    stickers: [{}, {}],
  }));
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('validateCompletedStickerSet', () => {
  it('accepts only a fully packaged, QA-passing set', () => {
    expect(validateCompletedStickerSet(fixture()).complete).toBe(true);
  });

  it('rejects QA failures', () => {
    const result = validateCompletedStickerSet(fixture(false));
    expect(result.complete).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/qa|completionStatus/i);
  });

  it('rejects a partial sticker directory', () => {
    const dir = fixture();
    rmSync(join(dir, 'stickers', 'sticker-02.png'));
    expect(validateCompletedStickerSet(dir).reasons.join(' ')).toContain('sticker-02.png');
  });
});
