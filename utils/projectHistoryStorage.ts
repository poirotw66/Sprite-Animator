import type { SavedProject, SavedProjectMeta } from '../types';

export const PROJECT_HISTORY_DATABASE = 'sprite-animator-project-history';
export const PROJECT_HISTORY_STORE = 'projects';
export const PROJECT_HISTORY_METADATA_STORE = 'projectMetadata';
const PROCESSED_STORE = 'processedLegacyIds';
export const LEGACY_PROJECT_LIST_KEY = 'sprite_animator_project_list';
export const LEGACY_PROJECT_PREFIX = 'sprite_animator_project_';
export const MAX_SAVED_PROJECTS = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Reject malformed snapshots before they can replace the current editor state. */
export function parseSavedProject(value: unknown): SavedProject | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
      typeof value.name !== 'string' || !finite(value.createdAt) ||
      !isRecord(value.config) || !isRecord(value.sliceSettings)) return null;
  const config = value.config;
  const slice = value.sliceSettings;
  if (typeof config.prompt !== 'string' || !['frame', 'sheet'].includes(String(config.mode)) ||
      !['green', 'magenta'].includes(String(config.chromaKeyColor)) ||
      typeof config.enableInterpolation !== 'boolean' ||
      !['frameCount', 'speed', 'scale', 'gridCols', 'gridRows'].every((key) => finite(config[key]) && Number(config[key]) > 0) ||
      !['cols', 'rows'].every((key) => finite(slice[key]) && Number.isInteger(slice[key]) && Number(slice[key]) > 0) ||
      !['paddingX', 'paddingY', 'shiftX', 'shiftY'].every((key) => finite(slice[key])) ||
      typeof value.removeBackground !== 'boolean' ||
      ![value.sourceImage, value.spriteSheetImage].every((image) => image === null || typeof image === 'string') ||
      !Array.isArray(value.frameModeFrames) || !value.frameModeFrames.every((frame) => typeof frame === 'string') ||
      !Array.isArray(value.frameIncluded) || !value.frameIncluded.every((included) => typeof included === 'boolean') ||
      !Array.isArray(value.frameOverrides) || !value.frameOverrides.every((override) =>
        isRecord(override) && ['offsetX', 'offsetY', 'scale'].every((key) => override[key] === undefined || finite(override[key])))) return null;
  if (config.bgRemovalMethod !== undefined && !['chroma', 'ai'].includes(String(config.bgRemovalMethod))) return null;
  if (slice.sliceMode !== undefined && !['equal', 'inferred', 'ownership', 'manual', 'rects'].includes(String(slice.sliceMode))) return null;
  for (const key of ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom']) {
    if (slice[key] !== undefined && !finite(slice[key])) return null;
  }
  for (const key of ['manualXBounds', 'manualYBounds']) {
    const bounds = slice[key];
    if (bounds !== undefined && (!Array.isArray(bounds) || bounds.length < 2 ||
        !bounds.every((bound, index) => finite(bound) && bound >= 0 && (index === 0 || bound > Number(bounds[index - 1]))))) return null;
  }
  if (slice.inferredCellRects !== undefined && (!Array.isArray(slice.inferredCellRects) ||
      !slice.inferredCellRects.every((rect) => isRecord(rect) &&
        ['x', 'y', 'width', 'height'].every((key) => finite(rect[key])) &&
        Number(rect.x) >= 0 && Number(rect.y) >= 0 && Number(rect.width) > 0 && Number(rect.height) > 0))) return null;
  return value as unknown as SavedProject;
}

export function sortSavedProjects<T extends SavedProjectMeta>(projects: T[]): T[] {
  return [...projects].sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}

function toMeta(project: SavedProject): SavedProjectMeta {
  return { id: project.id, name: project.name, createdAt: project.createdAt };
}

function parseMetadata(values: unknown[]): SavedProjectMeta[] {
  return values.map((value) => {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
        typeof value.name !== 'string' || !finite(value.createdAt)) {
      throw new Error('Saved project metadata is corrupt.');
    }
    return { id: value.id, name: value.name, createdAt: value.createdAt };
  });
}

function runTransaction<T>(
  database: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction, result: (value: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode);
    let value: T;
    let hasResult = false;
    transaction.oncomplete = () => hasResult ? resolve(value) : reject(new Error('History operation did not complete.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('History transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('History transaction failed.'));
    try {
      work(transaction, (result) => { value = result; hasResult = true; });
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

interface LegacyEntry {
  key: string;
  raw: string;
  project: SavedProject | null;
}

interface LegacyData {
  entries: LegacyEntry[];
  listRaw: string | null;
  list: unknown[] | null;
}

/** Project snapshots and retention changes commit together in one native IndexedDB transaction. */
export class ProjectHistoryStorage {
  private databasePromise: Promise<IDBDatabase> | null = null;
  migrationWarning = false;

  constructor(
    private readonly factory: IDBFactory | undefined = globalThis.indexedDB,
    private readonly legacy: Storage = globalThis.localStorage,
    private readonly databaseName = PROJECT_HISTORY_DATABASE,
  ) {}

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (!this.factory) return reject(new Error('IndexedDB is unavailable.'));
      const request = this.factory.open(this.databaseName, 2);
      let failed = false;
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROJECT_HISTORY_STORE)) {
          database.createObjectStore(PROJECT_HISTORY_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(PROCESSED_STORE)) {
          database.createObjectStore(PROCESSED_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(PROJECT_HISTORY_METADATA_STORE)) {
          const metadata = database.createObjectStore(PROJECT_HISTORY_METADATA_STORE, { keyPath: 'id' });
          const transaction = request.transaction!;
          // Only the one-time v1 upgrade reads all images. Abort preserves the old database on corruption.
          const cursor = transaction.objectStore(PROJECT_HISTORY_STORE).openCursor();
          cursor.onsuccess = () => {
            if (!cursor.result) return;
            try {
              const project = parseSavedProject(cursor.result.value);
              if (!project || cursor.result.primaryKey !== project.id) throw new Error('Saved project data is corrupt.');
              metadata.put(toMeta(project));
              cursor.result.continue();
            } catch { transaction.abort(); }
          };
        }
      };
      request.onsuccess = () => {
        if (failed) { request.result.close(); return; }
        request.result.onclose = () => { this.databasePromise = null; };
        request.result.onversionchange = () => {
          request.result.close();
          this.databasePromise = null;
        };
        resolve(request.result);
      };
      request.onerror = () => { failed = true; reject(request.error ?? new Error('Cannot open project history.')); };
      request.onblocked = () => { failed = true; reject(new Error('Project history is blocked by another tab.')); };
    });
    this.databasePromise = opening.catch((error) => { this.databasePromise = null; throw error; });
    return this.databasePromise;
  }

  private readLegacy(): LegacyData {
    const entries: LegacyEntry[] = [];
    for (let index = 0; index < this.legacy.length; index++) {
      const key = this.legacy.key(index);
      if (!key || key === LEGACY_PROJECT_LIST_KEY || !key.startsWith(LEGACY_PROJECT_PREFIX)) continue;
      const raw = this.legacy.getItem(key);
      if (raw === null) continue;
      let project: SavedProject | null = null;
      try {
        project = parseSavedProject(JSON.parse(raw));
        if (project && key !== LEGACY_PROJECT_PREFIX + project.id) project = null;
      } catch { /* Retain malformed legacy data for recovery. */ }
      entries.push({ key, raw, project });
    }
    const listRaw = this.legacy.getItem(LEGACY_PROJECT_LIST_KEY);
    let list: unknown[] | null = null;
    if (listRaw !== null) {
      try {
        const parsed: unknown = JSON.parse(listRaw);
        if (Array.isArray(parsed)) list = parsed;
      } catch { /* Retain malformed legacy indexes for recovery. */ }
    }
    return { entries, listRaw, list };
  }

  private async migrate(): Promise<void> {
    const legacy = this.readLegacy();
    this.migrationWarning = legacy.entries.some((entry) => !entry.project) || (legacy.listRaw !== null && !legacy.list);
    if (!legacy.entries.length && legacy.listRaw === null) return;
    const database = await this.open();
    const processed = await runTransaction<Set<string>>(database,
      [PROJECT_HISTORY_STORE, PROJECT_HISTORY_METADATA_STORE, PROCESSED_STORE], 'readwrite', (transaction, result) => {
        const store = transaction.objectStore(PROJECT_HISTORY_STORE);
        const metadata = transaction.objectStore(PROJECT_HISTORY_METADATA_STORE);
        const processedStore = transaction.objectStore(PROCESSED_STORE);
        const metadataRequest = metadata.getAll();
        const processedRequest = processedStore.getAllKeys();
        let ready = 0;
        const finish = () => {
          if (++ready !== 2) return;
          try {
            const merged = new Map(parseMetadata(metadataRequest.result).map((project) => [project.id, project]));
            const processedIds = new Set<string>(processedRequest.result.map(String));
            let pendingValidation = 0;
            const commitMigration = () => {
              if (pendingValidation !== 0) return;
              try {
                for (const project of sortSavedProjects([...merged.values()]).slice(MAX_SAVED_PROJECTS)) {
                  store.delete(project.id);
                  metadata.delete(project.id);
                  processedStore.put({ id: project.id });
                  processedIds.add(project.id);
                }
                result(processedIds);
              } catch { transaction.abort(); }
            };
            for (const entry of legacy.entries) {
              if (!entry.project) continue;
              const project = entry.project;
              if (!processedIds.has(project.id) && merged.has(project.id)) {
                // Preserve current snapshots and verify a matching record before retiring its legacy backup.
                pendingValidation++;
                const current = store.get(project.id);
                current.onsuccess = () => {
                  if (!parseSavedProject(current.result)) { transaction.abort(); return; }
                  pendingValidation--;
                  commitMigration();
                };
              } else if (!processedIds.has(project.id)) {
                store.put(project);
                metadata.put(toMeta(project));
                merged.set(project.id, toMeta(project));
              }
              processedStore.put({ id: project.id });
              processedIds.add(project.id);
            }
            commitMigration();
          } catch { transaction.abort(); }
        };
        metadataRequest.onsuccess = finish;
        processedRequest.onsuccess = finish;
      });

    // Commit is confirmed before deleting any legacy source. Markers prevent reimport if cleanup fails.
    for (const entry of legacy.entries) {
      if (!entry.project || !processed.has(entry.project.id)) continue;
      try {
        if (this.legacy.getItem(entry.key) === entry.raw) this.legacy.removeItem(entry.key);
      } catch { this.migrationWarning = true; }
    }
    if (legacy.list && legacy.listRaw !== null) {
      const remaining = legacy.list.filter((entry) => !isRecord(entry) || typeof entry.id !== 'string' || !processed.has(entry.id));
      if (remaining.length) this.migrationWarning = true;
      try {
        if (this.legacy.getItem(LEGACY_PROJECT_LIST_KEY) === legacy.listRaw) {
          if (remaining.length) this.legacy.setItem(LEGACY_PROJECT_LIST_KEY, JSON.stringify(remaining));
          else this.legacy.removeItem(LEGACY_PROJECT_LIST_KEY);
        }
      } catch { this.migrationWarning = true; }
    }
  }

  async list(): Promise<SavedProjectMeta[]> {
    await this.migrate();
    return runTransaction(await this.open(), [PROJECT_HISTORY_METADATA_STORE], 'readonly', (transaction, result) => {
      const request = transaction.objectStore(PROJECT_HISTORY_METADATA_STORE).getAll();
      request.onsuccess = () => {
        try { result(sortSavedProjects(parseMetadata(request.result))); }
        catch { transaction.abort(); }
      };
    });
  }

  async load(id: string): Promise<SavedProject | null> {
    await this.migrate();
    return runTransaction(await this.open(), [PROJECT_HISTORY_STORE], 'readonly', (transaction, result) => {
      const request = transaction.objectStore(PROJECT_HISTORY_STORE).get(id);
      request.onsuccess = () => {
        if (request.result === undefined) { result(null); return; }
        const parsed = parseSavedProject(request.result);
        if (!parsed) { transaction.abort(); return; }
        result(parsed);
      };
    });
  }

  async save(project: SavedProject): Promise<SavedProjectMeta[]> {
    if (!parseSavedProject(project)) throw new Error('Invalid project snapshot.');
    await this.migrate();
    return runTransaction(await this.open(), [PROJECT_HISTORY_STORE, PROJECT_HISTORY_METADATA_STORE, PROCESSED_STORE], 'readwrite', (transaction, result) => {
      const store = transaction.objectStore(PROJECT_HISTORY_STORE);
      const metadata = transaction.objectStore(PROJECT_HISTORY_METADATA_STORE);
      store.put(project);
      metadata.put(toMeta(project));
      const request = metadata.getAll();
      request.onsuccess = () => {
        try {
          const sorted = sortSavedProjects(parseMetadata(request.result));
          for (const evicted of sorted.slice(MAX_SAVED_PROJECTS)) {
            store.delete(evicted.id);
            metadata.delete(evicted.id);
            transaction.objectStore(PROCESSED_STORE).put({ id: evicted.id });
          }
          result(sorted.slice(0, MAX_SAVED_PROJECTS));
        } catch { transaction.abort(); }
      };
    });
  }

  async delete(id: string): Promise<SavedProjectMeta[]> {
    await this.migrate();
    return runTransaction(await this.open(), [PROJECT_HISTORY_STORE, PROJECT_HISTORY_METADATA_STORE, PROCESSED_STORE], 'readwrite', (transaction, result) => {
      transaction.objectStore(PROJECT_HISTORY_STORE).delete(id);
      transaction.objectStore(PROJECT_HISTORY_METADATA_STORE).delete(id);
      transaction.objectStore(PROCESSED_STORE).put({ id });
      const request = transaction.objectStore(PROJECT_HISTORY_METADATA_STORE).getAll();
      request.onsuccess = () => {
        try { result(sortSavedProjects(parseMetadata(request.result))); }
        catch { transaction.abort(); }
      };
    });
  }
}
