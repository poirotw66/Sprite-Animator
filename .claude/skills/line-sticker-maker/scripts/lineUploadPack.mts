import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import {
  LINE_STICKER_UPLOAD,
  lineUploadStickerFileName,
  resolveLineUploadStickerCount,
} from '../../../../utils/lineStickerUploadSpec.ts';
import {
  encodePng,
  prepareLineMainImage,
  prepareLineStickerFrame,
  prepareLineTabImage,
  type RgbaImage,
} from './nodeImage.mts';

export interface LineUploadPackOptions {
  mainStickerIndex?: number;
  tabStickerIndex?: number;
  stickerCount?: number;
}

export interface LineUploadPackFile {
  name: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  bytesLength: number;
}

export interface LineUploadPackResult {
  stickerCount: number;
  /** 1-based sticker numbers used for main.png / tab.png */
  mainStickerIndex: number;
  tabStickerIndex: number;
  files: LineUploadPackFile[];
  warnings: string[];
}

function clampIndex(index: number, length: number, label: string): number {
  if (length === 0) {
    throw new Error(`Cannot build LINE upload pack: no sticker frames available for ${label}`);
  }
  const clamped = Math.min(Math.max(index, 0), length - 1);
  if (clamped !== index) {
    return clamped;
  }
  return index;
}

/** Pick two distinct 0-based indices for shop main/tab images. */
export function pickRandomShopStickerIndices(
  stickerCount: number,
  rng: () => number = Math.random
): { mainIndex: number; tabIndex: number } {
  if (stickerCount <= 0) {
    throw new Error('Cannot pick shop images: no sticker frames available');
  }
  if (stickerCount === 1) {
    return { mainIndex: 0, tabIndex: 0 };
  }

  const mainIndex = Math.floor(rng() * stickerCount);
  let tabIndex = Math.floor(rng() * stickerCount);
  while (tabIndex === mainIndex) {
    tabIndex = Math.floor(rng() * stickerCount);
  }
  return { mainIndex, tabIndex };
}

export function resolveShopStickerIndices(
  stickerCount: number,
  options: LineUploadPackOptions
): { mainIndex: number; tabIndex: number } {
  const mainGiven = options.mainStickerIndex !== undefined;
  const tabGiven = options.tabStickerIndex !== undefined;

  if (!mainGiven && !tabGiven) {
    return pickRandomShopStickerIndices(stickerCount);
  }

  const fallback = pickRandomShopStickerIndices(stickerCount);
  const mainIndex = mainGiven
    ? clampIndex(options.mainStickerIndex!, stickerCount, 'main image')
    : fallback.mainIndex;
  let tabIndex = tabGiven
    ? clampIndex(options.tabStickerIndex!, stickerCount, 'tab image')
    : fallback.tabIndex;

  if (mainIndex === tabIndex && stickerCount > 1) {
    tabIndex = (mainIndex + 1) % stickerCount;
  }

  return { mainIndex, tabIndex };
}

function buildUploadFile(name: string, image: RgbaImage): LineUploadPackFile {
  const bytes = encodePng(image);
  return {
    name,
    bytes,
    width: image.width,
    height: image.height,
    bytesLength: bytes.byteLength,
  };
}

export function buildLineUploadPack(
  frames: RgbaImage[],
  options: LineUploadPackOptions = {}
): LineUploadPackResult {
  const stickerCount = resolveLineUploadStickerCount(frames.length, options.stickerCount);
  const warnings: string[] = [];

  if (frames.length > stickerCount) {
    warnings.push(
      `Produced ${frames.length} stickers; LINE upload pack uses the first ${stickerCount}.`
    );
  }

  const { mainIndex, tabIndex } = resolveShopStickerIndices(stickerCount, options);

  const files: LineUploadPackFile[] = [];
  files.push(buildUploadFile('main.png', prepareLineMainImage(frames[mainIndex]!)));
  files.push(buildUploadFile('tab.png', prepareLineTabImage(frames[tabIndex]!)));

  for (let index = 0; index < stickerCount; index += 1) {
    const prepared = prepareLineStickerFrame(frames[index]!);
    files.push(buildUploadFile(lineUploadStickerFileName(index + 1), prepared));
  }

  for (const file of files) {
    if (file.bytesLength > LINE_STICKER_UPLOAD.maxFileBytes) {
      warnings.push(
        `${file.name} is ${Math.round(file.bytesLength / 1024)} KB (> ${LINE_STICKER_UPLOAD.maxFileBytes / 1024} KB LINE limit).`
      );
    }
  }

  return {
    stickerCount,
    mainStickerIndex: mainIndex + 1,
    tabStickerIndex: tabIndex + 1,
    files,
    warnings,
  };
}

async function encodeUploadZip(pack: LineUploadPackResult): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of pack.files) {
    zip.file(file.name, file.bytes);
  }
  const zipBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  if (zipBytes.byteLength > LINE_STICKER_UPLOAD.maxZipBytes) {
    pack.warnings.push(
      `Upload ZIP is ${Math.round(zipBytes.byteLength / 1024)} KB (> ${LINE_STICKER_UPLOAD.maxZipBytes / 1024} KB LINE limit).`
    );
  }
  return zipBytes;
}

/** Build upload pack metadata and ZIP bytes (no filesystem writes). */
export async function buildLineUploadZipBytes(
  frames: RgbaImage[],
  options: LineUploadPackOptions = {}
): Promise<{ pack: LineUploadPackResult; zipBytes: Uint8Array }> {
  const pack = buildLineUploadPack(frames, options);
  const zipBytes = await encodeUploadZip(pack);
  return { pack, zipBytes };
}

/** Write upload ZIP to an explicit path (upload-root layout or custom destination). */
export async function writeLineUploadZip(
  zipPath: string,
  frames: RgbaImage[],
  options: LineUploadPackOptions = {}
): Promise<LineUploadPackResult> {
  const { pack, zipBytes } = await buildLineUploadZipBytes(frames, options);
  await mkdir(resolve(zipPath, '..'), { recursive: true });
  await writeFile(zipPath, zipBytes);
  return pack;
}

/** Legacy layout: `<outDir>/line-upload/` + `<outDir>/line-upload.zip`. */
export async function writeLineUploadPack(
  outDir: string,
  frames: RgbaImage[],
  options: LineUploadPackOptions = {}
): Promise<LineUploadPackResult> {
  const { pack, zipBytes } = await buildLineUploadZipBytes(frames, options);
  const uploadDir = resolve(outDir, 'line-upload');
  await mkdir(uploadDir, { recursive: true });

  for (const file of pack.files) {
    await writeFile(resolve(uploadDir, file.name), file.bytes);
  }
  await writeFile(resolve(outDir, 'line-upload.zip'), zipBytes);

  return pack;
}
