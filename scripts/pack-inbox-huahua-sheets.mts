/**
 * Crop-only pack for inbox ChatGPT 4×5 sheets — NO background removal.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

import { encodePng } from '../.claude/skills/line-sticker-maker/scripts/nodeImage.mts';
import type { RgbaFrameBuffer } from '../utils/sheetComponentSlicer.ts';
import { buildEqualGridBounds } from '../utils/sliceSpriteSheetByOwnership.ts';

const SHEET1 = 'inbox/ChatGPT Image 2026年7月16日 上午01_32_58.png';
const SHEET2 = 'inbox/ChatGPT Image 2026年7月16日 上午01_39_08.png';
const SET_ID = 'SET-20260716-002';
const OUT = join('output', 'vault-production', SET_ID);
const COLS = 4;
const ROWS = 5;

const PHRASES = [
  '蛤？', '？？？', '當機了', '已讀', '笑死', '真假', '裂開了', '別找我',
  '先裝死', '躺平啦', '先不要', '可以啦', '不會吧', '真的假', '好欸', '救命',
  '好累', '社恐了', '人生難', '餓了',
  '想睡', '沒電了', '放空', '我好了', '又是我', '欸不是', '拜託', '沒救了',
  '我看看', '穩了', '衝啊', '舒服', '想回家', '下班啦', '不要啦', '再一下',
  '等等', '先閃', '……', '哈',
];

async function sliceSheet(path: string, label: string): Promise<RgbaFrameBuffer[]> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width!;
  const h = info.height!;
  const rgba = new Uint8ClampedArray(data);
  const { xBounds, yBounds } = buildEqualGridBounds(w, h, COLS, ROWS, 0, 0, 0, 0);

  const sheetDir = join(OUT, label);
  await mkdir(sheetDir, { recursive: true });
  await copyFile(path, join(sheetDir, '_raw-sheet.png'));
  await sharp(path).png().toFile(join(sheetDir, '_processed-sheet.png'));

  const frames: RgbaFrameBuffer[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x0 = Math.round(xBounds[col]!);
      const x1 = Math.round(xBounds[col + 1]!);
      const y0 = Math.round(yBounds[row]!);
      const y1 = Math.round(yBounds[row + 1]!);
      const fw = Math.max(1, x1 - x0);
      const fh = Math.max(1, y1 - y0);
      const frame = new Uint8ClampedArray(fw * fh * 4);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const si = (y * w + x) * 4;
          const di = ((y - y0) * fw + (x - x0)) * 4;
          frame[di] = rgba[si]!;
          frame[di + 1] = rgba[si + 1]!;
          frame[di + 2] = rgba[si + 2]!;
          frame[di + 3] = rgba[si + 3]!;
        }
      }
      frames.push({ data: frame, width: fw, height: fh });
      const name = `sticker-${String(frames.length).padStart(2, '0')}.png`;
      await writeFile(join(sheetDir, name), Buffer.from(encodePng(frames[frames.length - 1]!)));
    }
  }
  console.log(`${label}: ${frames.length} frames (crop only)`);
  return frames;
}

async function main(): Promise<void> {
  await mkdir(join(OUT, 'stickers'), { recursive: true });
  const all = [...(await sliceSheet(SHEET1, 'sheet-1')), ...(await sliceSheet(SHEET2, 'sheet-2'))];
  for (let i = 0; i < all.length; i++) {
    await writeFile(
      join(OUT, 'stickers', `sticker-${String(i + 1).padStart(2, '0')}.png`),
      Buffer.from(encodePng(all[i]!))
    );
  }

  const phraseSet = {
    format: 'line-sticker-phrase-set',
    version: 1,
    mode: 'set',
    name: '花花·蠟筆聊天',
    phrases: PHRASES,
    actionDescs: PHRASES.map(() => ''),
  };
  await writeFile(join(OUT, 'phrase-set.json'), `${JSON.stringify(phraseSet, null, 2)}\n`);

  const job = {
    referenceImage: 'sheet-1/_raw-sheet.png',
    phraseSetFile: 'phrase-set.json',
    characterDescription: '三花貓花花手繪蠟筆風貼圖',
    style: 'matchUploaded',
    fontKey: 'matchUploaded',
    language: 'zh-TW',
    chromaKeyColor: 'green',
    includeText: true,
    textRendering: 'model',
    scope: 'set',
    stickerCount: 40,
    lineUpload: true,
    lineUploadSubmit: false,
    customPhrases: PHRASES,
    customActionDescs: PHRASES.map(() => ''),
    upload: {
      syncToUploadRoot: true,
      creatorId: '706',
      setName: 'Huahua Calico Handdrawn Chat',
      titleZh: '花花·蠟筆聊天',
      descZh: '蛤？、笑死、沒電了——花花蠟筆風聊天貼圖，表情滿滿隨時接招！',
      titleEn: 'HuaHua Crayon Chat',
      descEn: 'HuaHua crayon-style chat stickers for everyday memes and reactions.',
      writeEnvBatch: true,
    },
  };
  await writeFile(join(OUT, 'job.config.json'), `${JSON.stringify(job, null, 2)}\n`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    activeSheets: ['sheet-1', 'sheet-2'],
    gridScores: { 'sheet-1': 1, 'sheet-2': 1 },
    stickers: all.map((frame, i) => ({
      globalIndex: i + 1,
      sheet: i < 20 ? 'sheet-1' : 'sheet-2',
      index: (i % 20) + 1,
      file: `${i < 20 ? 'sheet-1' : 'sheet-2'}/sticker-${String((i % 20) + 1).padStart(2, '0')}.png`,
      uploadFile: `stickers/sticker-${String(i + 1).padStart(2, '0')}.png`,
      phrase: PHRASES[i] ?? '',
      width: frame.width,
      height: frame.height,
    })),
  };
  await writeFile(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`✓ ${SET_ID} crop-only → ${OUT}`);
}

await main();
