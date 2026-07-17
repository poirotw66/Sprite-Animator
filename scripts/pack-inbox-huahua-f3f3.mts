/**
 * Pack two ChatGPT 4×5 crayon sheets (#F3F3F3 paper bg) into a LINE 40-set.
 * Edge flood-fill keyed to #F3F3F3 — preserves enclosed crayon white fills.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

import { encodePng } from '../.claude/skills/line-sticker-maker/scripts/nodeImage.mts';
import { trimFrameToContent, type RgbaFrameBuffer } from '../utils/sheetComponentSlicer.ts';
import { buildEqualGridBounds } from '../utils/sliceSpriteSheetByOwnership.ts';

const SHEET1 = 'inbox/ChatGPT Image 2026年7月16日 上午02_36_42.png';
const SHEET2 = 'inbox/ChatGPT Image 2026年7月16日 上午02_40_12.png';
const SET_ID = 'SET-20260716-003';
const OUT = join('output', 'vault-production', SET_ID);
const COLS = 4;
const ROWS = 5;

/** Target paper / sheet background. */
const KEY = { r: 0xf3, g: 0xf3, b: 0xf3 };
/** Keep below ~20 so enclosed ~white fur (250+) is not eaten via AA bridges. */
const MAX_DIST = 14;

const PHRASES = [
  '蛤？', '？？？', 'CPU 0%', '已讀', '笑死', '真假', '我裂開了', '不要 Cue 我',
  '我先裝死', '今天不想努力', '先不要', '可以啦', '不會吧', '真的假的', '好欸', '救命',
  '累', '社交能量不足', '人生好難', '餓',
  '想睡', '沒電了', '放空', '我好了', '又是我', '欸不是', '拜託', '沒救了',
  '我看看', '穩', '衝', '舒服', '好想回家', '下班!!', '不要啦', '再一下',
  '等等', '先閃', '……', '哈',
];

function nearKey(r: number, g: number, b: number): boolean {
  const dr = r - KEY.r;
  const dg = g - KEY.g;
  const db = b - KEY.b;
  return dr * dr + dg * dg + db * db <= MAX_DIST * MAX_DIST;
}

/** Transparentize paper connected to the sheet border. */
function floodRemovePaperBg(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue: number[] = [];
  let cleared = 0;

  const trySeed = (x: number, y: number): void => {
    const p = y * width + x;
    if (visited[p]) return;
    const i = p * 4;
    if (data[i + 3]! < 8) {
      visited[p] = 1;
      queue.push(p);
      return;
    }
    if (!nearKey(data[i]!, data[i + 1]!, data[i + 2]!)) return;
    visited[p] = 1;
    data[i + 3] = 0;
    cleared++;
    queue.push(p);
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const p = queue[head++]!;
    const x = p % width;
    const y = (p - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const np = ny * width + nx;
        if (visited[np]) continue;
        visited[np] = 1;
        const i = np * 4;
        if (data[i + 3]! < 8) {
          queue.push(np);
          continue;
        }
        if (!nearKey(data[i]!, data[i + 1]!, data[i + 2]!)) continue;
        data[i + 3] = 0;
        cleared++;
        queue.push(np);
      }
    }
  }
  return cleared;
}

async function sliceSheet(path: string, label: string): Promise<RgbaFrameBuffer[]> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width!;
  const h = info.height!;
  const rgba = new Uint8ClampedArray(data);
  const cleared = floodRemovePaperBg(rgba, w, h);
  console.log(`${label}: cleared ${cleared} paper px (#F3F3F3 flood)`);

  const sheetDir = join(OUT, label);
  await mkdir(sheetDir, { recursive: true });
  await copyFile(path, join(sheetDir, '_raw-sheet.png'));
  await writeFile(
    join(sheetDir, '_processed-sheet.png'),
    Buffer.from(encodePng({ data: rgba, width: w, height: h }))
  );

  const { xBounds, yBounds } = buildEqualGridBounds(w, h, COLS, ROWS, 0, 0, 0, 0);
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
      const trimmed = trimFrameToContent({ data: frame, width: fw, height: fh }) ?? {
        data: frame,
        width: fw,
        height: fh,
      };
      frames.push(trimmed);
      const name = `sticker-${String(frames.length).padStart(2, '0')}.png`;
      await writeFile(join(sheetDir, name), Buffer.from(encodePng(trimmed)));
    }
  }
  console.log(`${label}: ${frames.length} frames`);
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
    name: '花花·蠟筆灰底聊天',
    phrases: PHRASES,
    actionDescs: PHRASES.map(() => ''),
  };
  await writeFile(join(OUT, 'phrase-set.json'), `${JSON.stringify(phraseSet, null, 2)}\n`);

  const job = {
    referenceImage: 'sheet-1/_raw-sheet.png',
    phraseSetFile: 'phrase-set.json',
    characterDescription: '三花貓花花手繪蠟筆風貼圖（#F3F3F3 去背）',
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
    minGridAlignmentScore: 0,
    customPhrases: PHRASES,
    customActionDescs: PHRASES.map(() => ''),
    upload: {
      syncToUploadRoot: true,
      creatorId: '706',
      setName: 'Huahua Calico F3F3 Chat',
      titleZh: '花花·蠟筆聊天2',
      descZh: '蛤？、笑死、下班!!——花花蠟筆灰底聊天貼圖，表情滿滿隨時接招！',
      titleEn: 'HuaHua Crayon Chat 2',
      descEn: 'HuaHua crayon chat stickers on transparent bg — everyday memes and reactions.',
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
  console.log(`✓ ${SET_ID} → ${OUT}`);
}

await main();
