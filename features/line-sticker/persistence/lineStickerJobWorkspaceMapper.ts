/**
 * Maps browser workspace arrays (data URLs) to LineStickerJob + IndexedDB assets.
 */
import {
  DEFAULT_BROWSER_LINE_STICKER_SET_COUNT,
  createLineStickerJob,
  createLineStickerJobSheets,
  type LineStickerAssetRef,
  type LineStickerJob,
  type LineStickerJobMode,
  type LineStickerRunState,
} from '../domain';
import {
  LINE_STICKER_FRAMES_PER_SHEET,
  LINE_STICKER_SHEET_INDICES,
  LINE_STICKER_TOTAL_SET_FRAMES,
  getLineStickerFrameRange,
  sliceLineStickerSheetFrames,
  type LineStickerSheetIndex,
} from '../../../utils/lineStickerSetSchema';
import type { LineStickerJobRepository, LineStickerJobSnapshot } from './lineStickerJobRepository';
import { sanitizeLineStickerRunStateForResume } from '../domain/lineStickerRunState';

export interface LineStickerWorkspaceArtifacts {
  mode: LineStickerJobMode;
  sourceImage: string | null;
  setPhrasesList: string[];
  actionDescsList: string[];
  sheetImages: readonly (string | null)[];
  processedSheetImages: readonly (string | null)[];
  sheetFrames: readonly (readonly string[])[];
}

export interface LoadedLineStickerWorkspace {
  snapshot: LineStickerJobSnapshot;
  artifacts: LineStickerWorkspaceArtifacts;
}

const DATA_URL_PATTERN = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i;

export function dataUrlToStoredBytes(dataUrl: string): { mimeType: string; bytes: ArrayBuffer } {
  const match = DATA_URL_PATTERN.exec(dataUrl.trim());
  if (!match) throw new Error('Expected a base64 data URL for LINE sticker persistence.');
  const mimeType = match[1] || 'application/octet-stream';
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { mimeType, bytes: bytes.buffer };
}

export function storedBytesToDataUrl(mimeType: string, bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < view.length; offset += chunkSize) {
    binary += String.fromCharCode(...view.subarray(offset, offset + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function assetId(jobId: string, ...parts: string[]): string {
  return [jobId, ...parts].join('/');
}

function collectAssetIds(job: LineStickerJob): string[] {
  const ids: string[] = [];
  if (job.sourceAsset) ids.push(job.sourceAsset.id);
  for (const sheet of job.sheets) {
    if (sheet.sourceAsset) ids.push(sheet.sourceAsset.id);
    if (sheet.generatedAsset) ids.push(sheet.generatedAsset.id);
    if (sheet.processedAsset) ids.push(sheet.processedAsset.id);
    for (const frame of sheet.frameAssets ?? []) ids.push(frame.id);
  }
  return ids;
}

async function putDataUrlAsset(
  repository: LineStickerJobRepository,
  id: string,
  dataUrl: string,
  updatedAt: string,
): Promise<LineStickerAssetRef> {
  const { mimeType, bytes } = dataUrlToStoredBytes(dataUrl);
  await repository.putAsset({ id, mimeType, bytes, updatedAt });
  return { id, mimeType };
}

async function loadDataUrlAsset(
  repository: LineStickerJobRepository,
  ref: LineStickerAssetRef | undefined,
): Promise<string | null> {
  if (!ref) return null;
  const asset = await repository.getAsset(ref.id);
  if (!asset) return null;
  return storedBytesToDataUrl(asset.mimeType, asset.bytes);
}

function flattenSheetValues(sheets: LineStickerJob['sheets'], pick: 'phrases' | 'actionDescriptions'): string[] {
  const values = Array.from({ length: LINE_STICKER_TOTAL_SET_FRAMES }, () => '');
  for (const sheet of sheets) {
    const sheetIndex = sheet.index as LineStickerSheetIndex;
    if (!LINE_STICKER_SHEET_INDICES.includes(sheetIndex)) continue;
    const { start } = getLineStickerFrameRange(sheetIndex);
    const source = pick === 'phrases' ? sheet.phrases : (sheet.actionDescriptions ?? []);
    source.forEach((value, offset) => {
      if (offset < LINE_STICKER_FRAMES_PER_SHEET) values[start + offset] = value;
    });
  }
  return values;
}

export function hasPersistableWorkspaceArtifacts(artifacts: LineStickerWorkspaceArtifacts): boolean {
  return Boolean(
    artifacts.sourceImage
    || artifacts.sheetImages.some(Boolean)
    || artifacts.processedSheetImages.some(Boolean)
    || artifacts.sheetFrames.some((frames) => frames.length > 0)
    || artifacts.setPhrasesList.some((phrase) => phrase.trim().length > 0),
  );
}

export async function deleteLineStickerJobWithAssets(
  repository: LineStickerJobRepository,
  jobId: string,
): Promise<void> {
  const existing = await repository.load(jobId);
  if (existing) {
    await Promise.all(collectAssetIds(existing.job).map((id) => repository.deleteAsset(id)));
  }
  await repository.delete(jobId);
}

export async function saveLineStickerWorkspaceSnapshot(options: {
  repository: LineStickerJobRepository;
  jobId: string;
  createdAt: string;
  artifacts: LineStickerWorkspaceArtifacts;
  run: LineStickerRunState;
}): Promise<LineStickerJobSnapshot> {
  const { repository, jobId, createdAt, artifacts, run } = options;
  const updatedAt = new Date().toISOString();
  const previous = await repository.load(jobId);
  const previousAssetIds = previous ? new Set(collectAssetIds(previous.job)) : new Set<string>();
  const nextAssetIds = new Set<string>();

  const sourceAsset = artifacts.sourceImage
    ? await putDataUrlAsset(repository, assetId(jobId, 'source'), artifacts.sourceImage, updatedAt)
    : undefined;
  if (sourceAsset) nextAssetIds.add(sourceAsset.id);

  const sheets = createLineStickerJobSheets(DEFAULT_BROWSER_LINE_STICKER_SET_COUNT);
  for (const sheetIndex of LINE_STICKER_SHEET_INDICES) {
    const sheet = sheets[sheetIndex];
    sheet.phrases = sliceLineStickerSheetFrames(artifacts.setPhrasesList, sheetIndex);
    const actions = sliceLineStickerSheetFrames(artifacts.actionDescsList, sheetIndex);
    if (actions.some((value) => value.trim().length > 0)) sheet.actionDescriptions = actions;

    const generated = artifacts.sheetImages[sheetIndex];
    if (generated) {
      sheet.generatedAsset = await putDataUrlAsset(
        repository,
        assetId(jobId, sheet.id, 'generated'),
        generated,
        updatedAt,
      );
      nextAssetIds.add(sheet.generatedAsset.id);
    }

    const processed = artifacts.processedSheetImages[sheetIndex];
    if (processed) {
      sheet.processedAsset = await putDataUrlAsset(
        repository,
        assetId(jobId, sheet.id, 'processed'),
        processed,
        updatedAt,
      );
      nextAssetIds.add(sheet.processedAsset.id);
    }

    const frames = artifacts.sheetFrames[sheetIndex] ?? [];
    if (frames.length > 0) {
      sheet.frameAssets = [];
      for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
        const frame = frames[frameIndex];
        if (!frame) continue;
        const ref = await putDataUrlAsset(
          repository,
          assetId(jobId, sheet.id, 'frame', String(frameIndex)),
          frame,
          updatedAt,
        );
        sheet.frameAssets[frameIndex] = ref;
        nextAssetIds.add(ref.id);
      }
    }
  }

  const job = createLineStickerJob({
    id: jobId,
    mode: artifacts.mode,
    stickerCount: DEFAULT_BROWSER_LINE_STICKER_SET_COUNT,
    createdAt: previous?.job.createdAt ?? createdAt,
    updatedAt,
    sourceAsset,
    sheets,
  });

  const snapshot: LineStickerJobSnapshot = {
    job,
    run: sanitizeLineStickerRunStateForResume(run),
    savedAt: updatedAt,
  };
  await repository.save(snapshot);

  await Promise.all(
    [...previousAssetIds]
      .filter((id) => !nextAssetIds.has(id))
      .map((id) => repository.deleteAsset(id)),
  );

  return snapshot;
}

export async function loadLineStickerWorkspaceSnapshot(options: {
  repository: LineStickerJobRepository;
  jobId: string;
}): Promise<LoadedLineStickerWorkspace | null> {
  const snapshot = await options.repository.load(options.jobId);
  if (!snapshot) return null;

  const sheetImages: (string | null)[] = LINE_STICKER_SHEET_INDICES.map(() => null);
  const processedSheetImages: (string | null)[] = LINE_STICKER_SHEET_INDICES.map(() => null);
  const sheetFrames: string[][] = LINE_STICKER_SHEET_INDICES.map(() => []);

  for (const sheet of snapshot.job.sheets) {
    const sheetIndex = sheet.index as LineStickerSheetIndex;
    if (!LINE_STICKER_SHEET_INDICES.includes(sheetIndex)) continue;
    sheetImages[sheetIndex] = await loadDataUrlAsset(options.repository, sheet.generatedAsset);
    processedSheetImages[sheetIndex] = await loadDataUrlAsset(options.repository, sheet.processedAsset);
    if (sheet.frameAssets?.length) {
      const frames: string[] = [];
      for (const ref of sheet.frameAssets) {
        const frame = await loadDataUrlAsset(options.repository, ref);
        if (frame) frames.push(frame);
      }
      sheetFrames[sheetIndex] = frames;
    }
  }

  return {
    snapshot: {
      ...snapshot,
      run: sanitizeLineStickerRunStateForResume(snapshot.run),
    },
    artifacts: {
      mode: snapshot.job.mode,
      sourceImage: await loadDataUrlAsset(options.repository, snapshot.job.sourceAsset),
      setPhrasesList: flattenSheetValues(snapshot.job.sheets, 'phrases'),
      actionDescsList: flattenSheetValues(snapshot.job.sheets, 'actionDescriptions'),
      sheetImages,
      processedSheetImages,
      sheetFrames,
    },
  };
}
