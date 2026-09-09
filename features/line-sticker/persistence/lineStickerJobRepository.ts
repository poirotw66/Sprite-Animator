import {
  LINE_STICKER_JOB_SCHEMA_VERSION,
  createLineStickerJobSheets,
  type LineStickerJob,
  type LineStickerJobSheet,
  type LineStickerRunState,
  type PipelineStage,
  type SupportedLineStickerSetCount,
} from '../domain';

export interface LineStickerJobSnapshot {
  job: LineStickerJob;
  run: LineStickerRunState;
  savedAt: string;
}

export interface LineStickerJobSummary {
  id: string;
  mode: LineStickerJob['mode'];
  stickerCount: number;
  updatedAt: string;
  savedAt: string;
  stage: PipelineStage;
}

export interface LineStickerStoredAsset {
  id: string;
  mimeType: string;
  bytes: ArrayBuffer;
  updatedAt: string;
}

export interface LineStickerJobRepository {
  save(snapshot: LineStickerJobSnapshot): Promise<void>;
  load(jobId: string): Promise<LineStickerJobSnapshot | null>;
  list(): Promise<LineStickerJobSummary[]>;
  delete(jobId: string): Promise<void>;
  putAsset(asset: LineStickerStoredAsset): Promise<void>;
  getAsset(assetId: string): Promise<LineStickerStoredAsset | null>;
  deleteAsset(assetId: string): Promise<void>;
}

const PIPELINE_STAGES = new Set<PipelineStage>([
  'idle', 'validating', 'queued', 'generating', 'processing', 'slicing',
  'qa', 'packaging', 'ready', 'failed', 'cancelled',
]);
const SECRET_FIELD_PATTERN = /(?:api[-_]?key|hf[-_]?token|authorization)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNoCredentialFields(value: unknown, path = 'snapshot'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoCredentialFields(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_FIELD_PATTERN.test(key)) {
      throw new Error(`Credential field is not allowed in persisted LINE sticker jobs: ${path}.${key}`);
    }
    assertNoCredentialFields(entry, `${path}.${key}`);
  }
}

function inferLegacyStickerCount(sheetCount: number): SupportedLineStickerSetCount {
  if (sheetCount === 2) return 40;
  if (sheetCount === 3) return 48;
  throw new Error(`Cannot migrate LINE sticker job with ${sheetCount} sheets.`);
}

function migrateLegacyJob(raw: Record<string, unknown>): LineStickerJob {
  if (!Array.isArray(raw.sheets)) throw new Error('Legacy LINE sticker job has no sheets.');
  const stickerCount = inferLegacyStickerCount(raw.sheets.length);
  const planned = createLineStickerJobSheets(stickerCount);
  const sheets = raw.sheets.map((sheet, index) => {
    if (!isRecord(sheet)) throw new Error(`Legacy LINE sticker sheet ${index} is invalid.`);
    return { ...planned[index], ...sheet } as LineStickerJobSheet;
  });
  return {
    ...raw,
    schemaVersion: LINE_STICKER_JOB_SCHEMA_VERSION,
    stickerCount,
    sheets,
  } as unknown as LineStickerJob;
}

export function parseLineStickerJobSnapshot(value: unknown): LineStickerJobSnapshot {
  assertNoCredentialFields(value);
  if (!isRecord(value) || !isRecord(value.job) || !isRecord(value.run)) {
    throw new Error('Invalid LINE sticker job snapshot.');
  }
  const job = value.job.schemaVersion === 1 ? migrateLegacyJob(value.job) : value.job;
  const jobSheets = Array.isArray(job.sheets) ? job.sheets : [];
  const invalidSheet = !Array.isArray(job.sheets) || jobSheets.some((sheet) => !isRecord(sheet)
    || typeof sheet.id !== 'string'
    || typeof sheet.cols !== 'number'
    || typeof sheet.rows !== 'number'
    || sheet.expectedFrames !== sheet.cols * sheet.rows
    || !Array.isArray(sheet.phrases));
  const frameCount = invalidSheet
    ? -1
    : jobSheets.reduce((sum, sheet) => sum + Number((sheet as Record<string, unknown>).expectedFrames), 0);
  if (job.schemaVersion !== LINE_STICKER_JOB_SCHEMA_VERSION
    || typeof job.id !== 'string'
    || (job.mode !== 'single' && job.mode !== 'set')
    || typeof job.stickerCount !== 'number'
    || !Array.isArray(job.sheets)
    || invalidSheet
    || frameCount !== job.stickerCount) {
    throw new Error('Unsupported or corrupt LINE sticker job.');
  }
  const run = value.run;
  const jobSheetIds = jobSheets
    .filter(isRecord)
    .map((sheet) => String(sheet.id));
  const runSheetIds = isRecord(run.sheets) ? Object.keys(run.sheets) : [];
  const invalidRunSheet = !isRecord(run.sheets) || Object.entries(run.sheets).some(([id, sheet]) =>
    !isRecord(sheet)
    || sheet.sheetId !== id
    || typeof sheet.stage !== 'string'
    || !PIPELINE_STAGES.has(sheet.stage as PipelineStage)
    || typeof sheet.progress !== 'number'
    || typeof sheet.attempts !== 'number');
  if (!Number.isSafeInteger(run.runId)
    || typeof run.stage !== 'string'
    || !PIPELINE_STAGES.has(run.stage as PipelineStage)
    || new Set(jobSheetIds).size !== jobSheetIds.length
    || runSheetIds.length !== jobSheetIds.length
    || jobSheetIds.some((id) => !runSheetIds.includes(id))
    || invalidRunSheet) {
    throw new Error('Unsupported or corrupt LINE sticker run state.');
  }
  if (typeof value.savedAt !== 'string') throw new Error('LINE sticker snapshot has no savedAt value.');
  return { job: job as LineStickerJob, run: run as unknown as LineStickerRunState, savedAt: value.savedAt };
}

export function toLineStickerJobSummary(snapshot: LineStickerJobSnapshot): LineStickerJobSummary {
  return {
    id: snapshot.job.id,
    mode: snapshot.job.mode,
    stickerCount: snapshot.job.stickerCount,
    updatedAt: snapshot.job.updatedAt,
    savedAt: snapshot.savedAt,
    stage: snapshot.run.stage,
  };
}

const clone = <T>(value: T): T => structuredClone(value);

/** Deterministic adapter for tests, SSR, and CLI experiments. */
export class InMemoryLineStickerJobRepository implements LineStickerJobRepository {
  private readonly jobs = new Map<string, LineStickerJobSnapshot>();
  private readonly assets = new Map<string, LineStickerStoredAsset>();

  async save(snapshot: LineStickerJobSnapshot): Promise<void> {
    const parsed = parseLineStickerJobSnapshot(snapshot);
    this.jobs.set(parsed.job.id, clone(parsed));
  }

  async load(jobId: string): Promise<LineStickerJobSnapshot | null> {
    const snapshot = this.jobs.get(jobId);
    return snapshot ? clone(snapshot) : null;
  }

  async list(): Promise<LineStickerJobSummary[]> {
    return [...this.jobs.values()]
      .map(toLineStickerJobSummary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async delete(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  async putAsset(asset: LineStickerStoredAsset): Promise<void> {
    this.assets.set(asset.id, clone(asset));
  }

  async getAsset(assetId: string): Promise<LineStickerStoredAsset | null> {
    const asset = this.assets.get(assetId);
    return asset ? clone(asset) : null;
  }

  async deleteAsset(assetId: string): Promise<void> {
    this.assets.delete(assetId);
  }
}
