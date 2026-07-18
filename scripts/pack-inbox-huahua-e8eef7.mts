/**
 * Pack two ChatGPT 4×5 crayon sheets (#E8EEF7 paper) into a LINE 40-set.
 * Adaptive blue-paper removal.  The paper is a light blue gradient, so an
 * exact RGB key leaves large opaque islands; hue + connectivity separates it
 * from the cat's neutral white fur.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

import { encodePng } from './line-sticker/nodeImage.mts';
import {
  sliceSheetByComponentOwnership,
  type RgbaFrameBuffer,
} from '../utils/sheetComponentSlicer.ts';
import { cleanPaperBackgroundMatte } from '../utils/paperBackgroundMatte.ts';
import { detectSheetGridBoundaries } from '../utils/sheetBoundaryDetection.ts';
import { clearEdgeConnectedResidue } from '../utils/frameEdgeCleanup.ts';

/** 蛤？ sheet */
const SHEET1 = 'inbox/ChatGPT Image 2026年7月17日 上午08_16_50.png';
/** 想睡 sheet */
const SHEET2 = 'inbox/ChatGPT Image 2026年7月17日 上午08_15_40.png';
const SET_ID = 'SET-20260718-001';
const OUT = join('output', 'vault-production', SET_ID);
const COLS = 4;
const ROWS = 5;

const KEY = { r: 0xe8, g: 0xee, b: 0xf7 };
/** Exact-key fallback for the darker parts of the generated paper texture. */
const MAX_DIST = 14;

const PHRASES = [
  '蛤？', '？？？', 'CPU 0%', '已讀', '笑死', '真假', '我裂開了', '不要 Cue 我',
  '我先裝死', '今天不想努力', '先不要', '可以啦', '不會吧', '真的假的', '好欸', '救命',
  '累', '社交能量不足', '人生好難', '餓我',
  '想睡', '沒電了', '放空', '我好了', '又是我', '欸不是', '拜託', '沒救了',
  '我看看', '穩', '衝', '舒服', '好想回家', '下班!!', '不要啦', '再一下',
  '等等', '先閃', '……', '哈',
];

function nearKey(r: number, g: number, b: number): boolean {
  // The source paper ranges roughly from (226, 233, 246) to (234, 240, 250).
  // Its stable feature is the cool blue bias, not its brightness.  White fur
  // is neutral (B-R is small), so it remains foreground even when very bright.
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const isBluePaper =
    min >= 198 &&
    b - r >= 7 &&
    b - g >= 4 &&
    max - min <= 38;
  if (isBluePaper) return true;

  const dr = r - KEY.r;
  const dg = g - KEY.g;
  const db = b - KEY.b;
  return dr * dr + dg * dg + db * db <= MAX_DIST * MAX_DIST;
}

/** More permissive only when the pixel is connected to the outside paper. */
function nearFloodPaper(r: number, g: number, b: number): boolean {
  if (nearKey(r, g, b)) return true;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return (
    min >= 178 &&
    b - r >= 4 &&
    b - g >= 2 &&
    max - min <= 45
  );
}

/** Transparentize paper connected to the sheet border only. */
function floodRemovePaperBg(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number {
  const visited = new Uint8Array(width * height);
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
    if (!nearFloodPaper(data[i]!, data[i + 1]!, data[i + 2]!)) return;
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
        if (!nearFloodPaper(data[i]!, data[i + 1]!, data[i + 2]!)) continue;
        data[i + 3] = 0;
        cleared++;
        queue.push(np);
      }
    }
  }
  return cleared;
}

/** Clear paper-coloured holes enclosed by lettering or character poses. */
function removeEnclosedPaper(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number {
  let cleared = 0;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if (data[i + 3]! < 8) continue;
    if (!nearKey(data[i]!, data[i + 1]!, data[i + 2]!)) continue;
    data[i + 3] = 0;
    cleared++;
  }
  return cleared;
}

/** Crop to opaque bbox — do NOT clearSmallOpaqueIslands (eats whiskers / text crumbs). */
function trimOpaqueBBox(frame: RgbaFrameBuffer, marginRatio = 0.05): RgbaFrameBuffer {
  const { data, width, height } = frame;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return frame;
  const margin = Math.max(6, Math.round(Math.min(width, height) * marginRatio));
  const x0 = Math.max(0, minX - margin);
  const y0 = Math.max(0, minY - margin);
  const x1 = Math.min(width, maxX + 1 + margin);
  const y1 = Math.min(height, maxY + 1 + margin);
  const outW = x1 - x0;
  const outH = y1 - y0;
  if (outW === width && outH === height) return frame;
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = y0; y < y1; y++) {
    const srcRow = (y * width + x0) * 4;
    const dstRow = (y - y0) * outW * 4;
    out.set(data.subarray(srcRow, srcRow + outW * 4), dstRow);
  }
  return { data: out, width: outW, height: outH };
}

async function sliceSheet(path: string, label: string): Promise<RgbaFrameBuffer[]> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width!;
  const h = info.height!;
  const rgba = new Uint8ClampedArray(data);
  const floodCleared = floodRemovePaperBg(rgba, w, h);
  const enclosedCleared = removeEnclosedPaper(rgba, w, h);
  const matteCleanup = cleanPaperBackgroundMatte(rgba, w, h, {
    haloDepth: 2,
    maxCrumbSize: 8,
    maxTinyArtifactSize: 2,
    whiteStrokePx: 2,
  });
  console.log(
    `${label}: cleared ${floodCleared + enclosedCleared} paper px ` +
      `(flood ${floodCleared}, enclosed ${enclosedCleared}); ` +
      `halo ${matteCleanup.haloPixelsCleared}, crumbs ${matteCleanup.crumbPixelsCleared}, ` +
      `dust ${matteCleanup.tinyArtifactPixelsCleared}, stroke ${matteCleanup.strokePixelsAdded}`
  );

  const sheetDir = join(OUT, label);
  await mkdir(sheetDir, { recursive: true });
  await copyFile(path, join(sheetDir, '_raw-sheet.png'));
  await writeFile(
    join(sheetDir, '_processed-sheet.png'),
    Buffer.from(encodePng({ data: rgba, width: w, height: h }))
  );

  const { xBounds, yBounds } = detectSheetGridBoundaries(rgba, w, h, COLS, ROWS, {
    searchRadiusRatio: 0.12,
    rowSearchRadiusRatio: 0.14,
  });
  console.log(`${label}: smart grid x=${xBounds.join(',')} y=${yBounds.join(',')}`);
  const cells = sliceSheetByComponentOwnership(rgba, w, h, xBounds, yBounds, {
    minComponentArea: 13,
    overflowPaddingPx: 6,
  });

  const frames: RgbaFrameBuffer[] = [];
  let edgeResidueCleared = 0;
  for (let i = 0; i < cells.length; i++) {
    edgeResidueCleared += clearEdgeConnectedResidue(
      cells[i]!.data,
      cells[i]!.width,
      cells[i]!.height,
      { maxDepthPx: 4 }
    );
    const trimmed = trimOpaqueBBox(cells[i]!);
    frames.push(trimmed);
    const name = `sticker-${String(i + 1).padStart(2, '0')}.png`;
    await writeFile(join(sheetDir, name), Buffer.from(encodePng(trimmed)));
  }
  console.log(`${label}: ${frames.length} frames; edge residue ${edgeResidueCleared}`);
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
    name: '花花·蠟筆藍灰底聊天',
    phrases: PHRASES,
    actionDescs: PHRASES.map(() => ''),
  };
  await writeFile(join(OUT, 'phrase-set.json'), `${JSON.stringify(phraseSet, null, 2)}\n`);

  const job = {
    referenceImage: 'sheet-1/_raw-sheet.png',
    phraseSetFile: 'phrase-set.json',
    characterDescription: '三花貓花花手繪蠟筆風貼圖（#E8EEF7 邊緣 flood 去背）',
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
      setName: 'Huahua Calico E8EEF7 Chat Preview',
      titleZh: '花花·蠟筆聊天預覽',
      descZh: '蛤？、笑死、下班!!——花花蠟筆藍灰底聊天貼圖預覽。',
      titleEn: 'HuaHua Crayon Chat Preview',
      descEn: 'HuaHua crayon chat stickers preview — transparent bg.',
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
