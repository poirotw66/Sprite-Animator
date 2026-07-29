import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CHARACTER_SLOT,
  DEFAULT_TEXT_SLOT,
  DEFAULT_THEME_SLOT,
  STYLE_PRESETS,
} from '../../utils/lineStickerPrompt';
import { encodePng, type RgbaImage } from './nodeImage.mts';

const { generateSheetImage } = vi.hoisted(() => ({
  generateSheetImage: vi.fn(),
}));
vi.mock('./geminiSheet.mts', () => ({
  generateSheetImage,
}));

import { generateOneSheet } from './sheetGeneration.mts';

const dirs: string[] = [];

function solidMagenta(width = 64, height = 64): Uint8Array {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  return encodePng({ data, width, height } satisfies RgbaImage);
}

afterEach(() => {
  generateSheetImage.mockReset();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('generateOneSheet chroma contract', () => {
  it('uses the existing retry budget when generated chroma differs from the request', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'sheet-chroma-'));
    dirs.push(outDir);
    generateSheetImage.mockResolvedValue(solidMagenta());

    await expect(
      generateOneSheet({
        sheet: { label: 'sheet-1', cols: 1, rows: 1, phrases: ['test'] },
        sheetFolder: 'sheet-1',
        outDir,
        stickersDir: join(outDir, 'stickers'),
        slots: {
          style: STYLE_PRESETS.matchUploaded,
          character: DEFAULT_CHARACTER_SLOT,
          theme: DEFAULT_THEME_SLOT,
          text: DEFAULT_TEXT_SLOT,
        },
        referenceBase64: 'AA==',
        referenceMimeType: 'image/png',
        apiKey: 'test',
        model: 'test-model',
        resolution: '1K',
        chromaKeyColor: 'green',
        includeText: false,
        textRendering: 'programmatic',
        maxSheetRetries: 2,
        minGridAlignmentScore: 0,
        isolatedSheetRun: false,
        globalIndexStart: 0,
        gridTemplate: false,
      })
    ).rejects.toThrow(/generated magenta chroma instead of green after 2 attempts/i);

    expect(generateSheetImage).toHaveBeenCalledTimes(2);
  });
});
