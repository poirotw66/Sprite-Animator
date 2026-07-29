/** Strict, shared validator for outputs that may be marked/resumed as completed. */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import {
  LINE_STICKER_UPLOAD,
  lineUploadStickerFileName,
  resolveLineUploadStickerCount,
} from '../lineStickerUploadSpec';
import { decodePng } from '../../scripts/line-sticker/nodeImage.mts';

export interface CompletedStickerSetValidation {
  complete: boolean;
  reasons: string[];
  expectedStickerCount: number;
  actualStickerCount: number;
}

interface ManifestSticker {
  globalIndex?: number;
  uploadFile?: string;
}

interface CompletedManifest {
  completionStatus?: string;
  runId?: string;
  config?: {
    stickerCount?: number;
    lineUploadStickerCount?: number;
    minGridAlignmentScore?: number;
    qaMode?: string;
  };
  activeSheets?: string[];
  gridScores?: Record<string, number>;
  qaReport?: { pass?: boolean; gridPass?: boolean };
  stickers?: ManifestSticker[];
  uploadPackPath?: string;
  uploadZipFile?: string;
  uploadZipSha256?: string;
}

interface PngInfo {
  width: number;
  height: number;
  hasAlpha: boolean;
  hasTransparentPixels: boolean;
}

function inspectPng(bytes: Uint8Array): PngInfo | undefined {
  if (
    bytes.length < 33 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return undefined;
  }
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.readUInt32BE(16);
  const height = view.readUInt32BE(20);
  const colorType = view[25]!;
  const hasAlpha = colorType === 4 || colorType === 6 || view.includes(Buffer.from('tRNS'));
  try {
    const decoded = decodePng(bytes);
    let hasTransparentPixels = false;
    for (let i = 3; i < decoded.data.length; i += 4) {
      if (decoded.data[i]! < 255) {
        hasTransparentPixels = true;
        break;
      }
    }
    return { width, height, hasAlpha, hasTransparentPixels };
  } catch {
    return undefined;
  }
}

const CRC32_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let k = 0; k < 8; k++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC32_TABLE[n] = value >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP reader for validator use (stored/deflated entries, no filesystem extraction). */
function readZipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('missing ZIP end-of-central-directory');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, Uint8Array>();
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('invalid ZIP central directory');
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const expectedCrc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const normalizedName = name.replaceAll('\\', '/');
    if (
      normalizedName.startsWith('/') ||
      normalizedName.split('/').some((part) => part === '..')
    ) {
      throw new Error(`unsafe ZIP entry path ${name}`);
    }
    if (entries.has(normalizedName)) {
      throw new Error(`duplicate ZIP entry ${normalizedName}`);
    }
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`invalid ZIP local header for ${name}`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localName = buffer
      .subarray(localOffset + 30, localOffset + 30 + localNameLength)
      .toString('utf8')
      .replaceAll('\\', '/');
    if (localName !== normalizedName) {
      throw new Error(`ZIP local/central name mismatch for ${normalizedName}`);
    }
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const decoded =
      method === 0
        ? new Uint8Array(compressed)
        : method === 8
          ? new Uint8Array(inflateRawSync(compressed))
          : (() => {
              throw new Error(`unsupported ZIP compression method ${method}`);
            })();
    if (decoded.byteLength !== uncompressedSize) {
      throw new Error(`ZIP size mismatch for ${normalizedName}`);
    }
    if (crc32(decoded) !== expectedCrc) {
      throw new Error(`ZIP CRC mismatch for ${normalizedName}`);
    }
    entries.set(normalizedName, decoded);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function resolveZipDirectories(outputDir: string, uploadPackPath?: string): string[] {
  const dirs = [outputDir];
  if (uploadPackPath) {
    dirs.push(
      isAbsolute(uploadPackPath) ? uploadPackPath : resolve(outputDir, uploadPackPath),
      resolve(process.cwd(), uploadPackPath)
    );
  }
  return [...new Set(dirs)];
}

function validateUploadZip(
  zipPath: string,
  uploadStickerCount: number
): string[] {
  const reasons: string[] = [];
  if (statSync(zipPath).size > LINE_STICKER_UPLOAD.maxZipBytes) {
    reasons.push('upload ZIP exceeds LINE archive limit');
  }
  let entries: Map<string, Uint8Array>;
  try {
    entries = readZipEntries(new Uint8Array(readFileSync(zipPath)));
  } catch (error) {
    return [`invalid upload ZIP ${zipPath}: ${error instanceof Error ? error.message : String(error)}`];
  }

  const expectedNames = [
    'main.png',
    'tab.png',
    ...Array.from({ length: uploadStickerCount }, (_, i) => lineUploadStickerFileName(i + 1)),
  ];
  const unexpectedNames = [...entries.keys()].filter((name) => !expectedNames.includes(name));
  if (unexpectedNames.length > 0) {
    reasons.push(`upload ZIP has unexpected entries: ${unexpectedNames.slice(0, 3).join(', ')}`);
  }
  for (const name of expectedNames) {
    const bytes = entries.get(name);
    if (!bytes) {
      reasons.push(`upload ZIP missing ${name}`);
      continue;
    }
    const png = inspectPng(bytes);
    if (!png) {
      reasons.push(`upload ZIP ${name} is not a valid PNG`);
      continue;
    }
    if (!png.hasAlpha) reasons.push(`upload ZIP ${name} has no alpha channel`);
    else if (!png.hasTransparentPixels) {
      reasons.push(`upload ZIP ${name} has no transparent pixels`);
    }
    if (bytes.byteLength > LINE_STICKER_UPLOAD.maxFileBytes) {
      reasons.push(`upload ZIP ${name} exceeds LINE file limit`);
    }
    if (name === 'main.png' && (png.width !== LINE_STICKER_UPLOAD.mainSize || png.height !== LINE_STICKER_UPLOAD.mainSize)) {
      reasons.push(`upload ZIP main.png must be ${LINE_STICKER_UPLOAD.mainSize}x${LINE_STICKER_UPLOAD.mainSize}`);
    } else if (
      name === 'tab.png' &&
      (png.width !== LINE_STICKER_UPLOAD.tabWidth || png.height !== LINE_STICKER_UPLOAD.tabHeight)
    ) {
      reasons.push(`upload ZIP tab.png must be ${LINE_STICKER_UPLOAD.tabWidth}x${LINE_STICKER_UPLOAD.tabHeight}`);
    } else if (
      name !== 'main.png' &&
      name !== 'tab.png' &&
      (png.width > LINE_STICKER_UPLOAD.stickerMaxWidth ||
        png.height > LINE_STICKER_UPLOAD.stickerMaxHeight ||
        png.width % 2 !== 0 ||
        png.height % 2 !== 0)
    ) {
      reasons.push(`upload ZIP ${name} violates LINE sticker dimensions`);
    }
  }
  return reasons;
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
  const completedWithWarnings =
    manifest.completionStatus === 'completed_with_warnings' &&
    manifest.config?.qaMode === 'report';
  if (manifest.completionStatus !== 'completed' && !completedWithWarnings) {
    reasons.push(`completionStatus is ${manifest.completionStatus ?? 'missing'}`);
  }
  if (!manifest.runId?.trim()) reasons.push('missing runId');
  if (actualStickerCount !== expectedStickerCount) {
    reasons.push(`manifest has ${actualStickerCount}/${expectedStickerCount} stickers`);
  }

  const stickersDir = join(outputDir, 'stickers');
  for (let i = 1; i <= expectedStickerCount; i++) {
    const expectedRel = `stickers/sticker-${String(i).padStart(2, '0')}.png`;
    const entry = manifest.stickers?.[i - 1];
    if (entry?.globalIndex !== i || entry.uploadFile?.replaceAll('\\', '/') !== expectedRel) {
      reasons.push(`manifest sticker ${i} does not map to ${expectedRel}`);
      break;
    }
    const file = join(stickersDir, `sticker-${String(i).padStart(2, '0')}.png`);
    if (!existsSync(file) || !statSync(file).isFile()) {
      reasons.push(`missing ${expectedRel}`);
      break;
    }
    const png = inspectPng(new Uint8Array(readFileSync(file)));
    if (!png) {
      reasons.push(`invalid ${expectedRel}`);
      break;
    }
    if (!png.hasAlpha) {
      reasons.push(`${expectedRel} has no alpha channel`);
      break;
    }
    if (!png.hasTransparentPixels) {
      reasons.push(`${expectedRel} has no transparent pixels`);
      break;
    }
  }

  if (!manifest.activeSheets?.length) {
    reasons.push('missing activeSheets');
  } else {
    for (const sheet of manifest.activeSheets) {
      const processed = join(outputDir, sheet, '_processed-sheet.png');
      if (!existsSync(processed) || !inspectPng(new Uint8Array(readFileSync(processed)))) {
        reasons.push(`missing or invalid ${sheet}/_processed-sheet.png`);
      }
    }
  }

  const minGridScore = manifest.config?.minGridAlignmentScore ?? 0.8;
  if (!manifest.gridScores || Object.keys(manifest.gridScores).length === 0) {
    reasons.push('missing gridScores');
  } else if (Object.values(manifest.gridScores).some((score) => score < minGridScore)) {
    reasons.push(`grid score below ${minGridScore}`);
  }
  if (
    manifest.qaReport?.gridPass !== true ||
    (!completedWithWarnings && manifest.qaReport?.pass !== true)
  ) {
    reasons.push('QA did not pass');
  }

  let uploadStickerCount = 0;
  try {
    uploadStickerCount = resolveLineUploadStickerCount(
      expectedStickerCount,
      manifest.config?.lineUploadStickerCount
    );
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : String(error));
  }

  if (!manifest.uploadZipFile?.trim()) reasons.push('missing uploadZipFile');
  if (!/^[a-f0-9]{64}$/i.test(manifest.uploadZipSha256 ?? '')) {
    reasons.push('missing or invalid uploadZipSha256');
  }
  const zipPaths = resolveZipDirectories(outputDir, manifest.uploadPackPath)
    .flatMap((dir) => {
      try {
        return readdirSync(dir)
          .filter((name) =>
            manifest.uploadZipFile
              ? name === manifest.uploadZipFile
              : name.toLowerCase().endsWith('.zip')
          )
          .map((name) => join(dir, name));
      } catch {
        return [];
      }
    });
  if (zipPaths.length === 0) {
    reasons.push('missing upload ZIP');
  } else if (uploadStickerCount > 0) {
    const validations = zipPaths.map((zipPath) => {
      const bytes = readFileSync(zipPath);
      const digest = createHash('sha256').update(bytes).digest('hex');
      const checksumReasons =
        manifest.uploadZipSha256 && digest !== manifest.uploadZipSha256
          ? ['upload ZIP checksum does not match manifest']
          : [];
      return [...checksumReasons, ...validateUploadZip(zipPath, uploadStickerCount)];
    });
    const validIndex = validations.findIndex((validation) => validation.length === 0);
    if (validIndex < 0) reasons.push(...validations[0]!);
  }

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
