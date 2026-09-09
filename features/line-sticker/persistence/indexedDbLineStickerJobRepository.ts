import {
  collectLineStickerJobAssetIds,
  parseLineStickerJobSnapshot,
  toLineStickerJobSummary,
  tryParseLineStickerJobSnapshot,
  type LineStickerJobRepository,
  type LineStickerJobSnapshot,
  type LineStickerJobSummary,
  type LineStickerStoredAsset,
} from './lineStickerJobRepository';
import { logger } from '../../../utils/logger';

const DATABASE_NAME = 'sprite-animator-line-sticker';
const DATABASE_VERSION = 1;
const JOB_STORE = 'jobs';
const ASSET_STORE = 'assets';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

/** Browser adapter. Job JSON and binary assets live in separate object stores. */
export class IndexedDbLineStickerJobRepository implements LineStickerJobRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: IDBFactory = globalThis.indexedDB,
    private readonly databaseName = DATABASE_NAME,
  ) {}

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      if (!this.factory) {
        reject(new Error('IndexedDB is unavailable in this environment.'));
        return;
      }
      const request = this.factory.open(this.databaseName, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(JOB_STORE)) {
          database.createObjectStore(JOB_STORE, { keyPath: 'job.id' });
        }
        if (!database.objectStoreNames.contains(ASSET_STORE)) {
          database.createObjectStore(ASSET_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab.'));
    });
    return this.databasePromise;
  }

  async save(snapshot: LineStickerJobSnapshot): Promise<void> {
    const parsed = parseLineStickerJobSnapshot(snapshot);
    const database = await this.open();
    const transaction = database.transaction(JOB_STORE, 'readwrite');
    transaction.objectStore(JOB_STORE).put(parsed);
    await transactionDone(transaction);
  }

  async load(jobId: string): Promise<LineStickerJobSnapshot | null> {
    const database = await this.open();
    const transaction = database.transaction(JOB_STORE, 'readonly');
    const raw = await requestResult(transaction.objectStore(JOB_STORE).get(jobId) as IDBRequest<unknown>);
    await transactionDone(transaction);
    if (raw === undefined) return null;
    const parsed = tryParseLineStickerJobSnapshot(raw);
    if (!parsed) {
      logger.warn('Skipping corrupt LINE sticker job during load', { jobId });
      return null;
    }
    return parsed;
  }

  async list(): Promise<LineStickerJobSummary[]> {
    const database = await this.open();
    const transaction = database.transaction(JOB_STORE, 'readonly');
    const values = await requestResult(transaction.objectStore(JOB_STORE).getAll() as IDBRequest<unknown[]>);
    await transactionDone(transaction);
    const summaries: LineStickerJobSummary[] = [];
    for (const raw of values) {
      const parsed = tryParseLineStickerJobSnapshot(raw);
      if (!parsed) {
        logger.warn('Skipping corrupt LINE sticker job during list');
        continue;
      }
      summaries.push(toLineStickerJobSummary(parsed));
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async delete(jobId: string): Promise<void> {
    const database = await this.open();
    const readTransaction = database.transaction(JOB_STORE, 'readonly');
    const raw = await requestResult(readTransaction.objectStore(JOB_STORE).get(jobId) as IDBRequest<unknown>);
    await transactionDone(readTransaction);
    const parsed = raw === undefined ? null : tryParseLineStickerJobSnapshot(raw);
    const assetIds = parsed ? collectLineStickerJobAssetIds(parsed.job) : [];

    const writeTransaction = database.transaction([JOB_STORE, ASSET_STORE], 'readwrite');
    const assetStore = writeTransaction.objectStore(ASSET_STORE);
    for (const assetId of assetIds) assetStore.delete(assetId);
    writeTransaction.objectStore(JOB_STORE).delete(jobId);
    await transactionDone(writeTransaction);
  }

  async putAsset(asset: LineStickerStoredAsset): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(ASSET_STORE, 'readwrite');
    transaction.objectStore(ASSET_STORE).put(asset);
    await transactionDone(transaction);
  }

  async getAsset(assetId: string): Promise<LineStickerStoredAsset | null> {
    const database = await this.open();
    const transaction = database.transaction(ASSET_STORE, 'readonly');
    const value = await requestResult(
      transaction.objectStore(ASSET_STORE).get(assetId) as IDBRequest<LineStickerStoredAsset | undefined>,
    );
    await transactionDone(transaction);
    return value ?? null;
  }

  async deleteAsset(assetId: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(ASSET_STORE, 'readwrite');
    transaction.objectStore(ASSET_STORE).delete(assetId);
    await transactionDone(transaction);
  }
}
