import { expect, test } from '@playwright/test';
import { DEFAULT_CONFIG, DEFAULT_SLICE_SETTINGS } from '../utils/constants';
import type { SavedProject } from '../types';

function snapshot(id: string, createdAt = 1): SavedProject {
  return {
    id, name: id, createdAt, config: { ...DEFAULT_CONFIG, prompt: `Prompt for ${id}` },
    sliceSettings: { ...DEFAULT_SLICE_SETTINGS }, removeBackground: true,
    sourceImage: null, spriteSheetImage: null, frameModeFrames: [], frameOverrides: [], frameIncluded: [],
  };
}

test.use({ locale: 'en-US' });

test('legacy history migrates and restores through the editor after reload', async ({ page }) => {
  const project = snapshot('legacy-project');
  await page.addInitScript((value) => {
    if (localStorage.getItem('history-test-seeded')) return;
    localStorage.setItem('sprite_animator_project_list', JSON.stringify([{ id: value.id, name: value.name, createdAt: value.createdAt }]));
    localStorage.setItem(`sprite_animator_project_${value.id}`, JSON.stringify(value));
    localStorage.setItem('history-test-seeded', 'yes');
  }, project);
  await page.goto('/#/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Project History', exact: true }).click();
  await expect(page.getByText('legacy-project', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Project History', exact: true }).click();
  await page.getByRole('button', { name: 'Load', exact: true }).last().click();
  await expect(page.getByRole('textbox', { name: 'Action Prompt' })).toHaveValue(project.config.prompt);
  expect(await page.evaluate(() => localStorage.getItem('sprite_animator_project_legacy-project'))).toBeNull();
});

test('reset wins over a pending asynchronous project restore', async ({ page }) => {
  await page.addInitScript((project) => {
    sessionStorage.setItem('gemini_api_key', 'mock-history-restore-key');
    localStorage.setItem(`sprite_animator_project_${project.id}`, JSON.stringify(project));
  }, snapshot('delayed-project'));
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Project History', exact: true }).click();
  await expect(page.getByText('delayed-project', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const modulePath = '/utils/projectHistoryStorage.ts';
    const { ProjectHistoryStorage } = await import(modulePath);
    const original = ProjectHistoryStorage.prototype.load;
    const control = window as Window & {
      releaseHistoryLoad?: () => void;
      historyLoadStarted?: boolean;
      historyLoadFinished?: boolean;
    };
    ProjectHistoryStorage.prototype.load = async function (this: unknown, id: string) {
      control.historyLoadStarted = true;
      await new Promise<void>((resolve) => { control.releaseHistoryLoad = resolve; });
      try { return await original.call(this, id); }
      finally { control.historyLoadFinished = true; }
    };
  });
  await page.getByRole('button', { name: 'Load', exact: true }).last().click();
  await page.waitForFunction(() => (window as Window & { historyLoadStarted?: boolean }).historyLoadStarted);
  await page.locator('header').getByRole('button', { name: 'Reset', exact: true }).click();
  await page.evaluate(() => (window as Window & { releaseHistoryLoad?: () => void }).releaseHistoryLoad?.());
  await page.waitForFunction(() => (window as Window & { historyLoadFinished?: boolean }).historyLoadFinished);
  await expect(page.getByRole('textbox', { name: 'Action Prompt' })).toHaveValue('');
  await expect(page.getByAltText('Uploaded character')).toHaveCount(0);
});

test('native history save and pruning commit atomically and persist after reopening', async ({ page }) => {
  await page.goto('/#/studio');
  const snapshots = Array.from({ length: 11 }, (_, i) => snapshot(`project-${i}`, i));
  const result = await page.evaluate(async (projects) => {
    const modulePath = '/utils/projectHistoryStorage.ts';
    const { ProjectHistoryStorage } = await import(modulePath);
    const storage = new ProjectHistoryStorage(indexedDB, localStorage, 'history-retention-test');
    for (const project of projects.slice(0, 10)) await storage.save(project);
    const originalDelete = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (key) {
      if (this.name === 'projects') throw new DOMException('Synthetic prune failure', 'QuotaExceededError');
      return originalDelete.call(this, key);
    };
    let failed = false;
    try { await storage.save(projects[10]); } catch { failed = true; }
    finally { IDBObjectStore.prototype.delete = originalDelete; }
    const afterFailure = (await storage.list()).map((item: SavedProject) => item.id);
    await storage.save(projects[10]);
    const reopened = new ProjectHistoryStorage(indexedDB, localStorage, 'history-retention-test');
    return { failed, afterFailure, afterSave: (await reopened.list()).map((item: SavedProject) => item.id), oldest: await reopened.load('project-0') };
  }, snapshots);
  expect(result.failed).toBe(true);
  expect(result.afterFailure).toHaveLength(10);
  expect(result.afterFailure).toContain('project-0');
  expect(result.afterFailure).not.toContain('project-10');
  expect(result.afterSave).toHaveLength(10);
  expect(result.afterSave[0]).toBe('project-10');
  expect(result.oldest).toBeNull();
});

test('failed native migration preserves legacy snapshots and can retry', async ({ page }) => {
  await page.goto('/#/studio');
  const result = await page.evaluate(async (project) => {
    const modulePath = '/utils/projectHistoryStorage.ts';
    const { ProjectHistoryStorage } = await import(modulePath);
    const key = `sprite_animator_project_${project.id}`;
    const raw = JSON.stringify(project);
    localStorage.setItem(key, raw);
    localStorage.setItem('sprite_animator_project_list', JSON.stringify([{ id: project.id, name: project.name, createdAt: project.createdAt }]));
    const storage = new ProjectHistoryStorage(indexedDB, localStorage, 'history-migration-failure-test');
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'projects') throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      return originalPut.apply(this, args);
    };
    let failed = false;
    try { await storage.list(); } catch { failed = true; }
    finally { IDBObjectStore.prototype.put = originalPut; }
    const retained = localStorage.getItem(key) === raw;
    const retried = await storage.list();
    return { failed, retained, retried, cleaned: localStorage.getItem(key) === null };
  }, snapshot('retry-migration'));
  expect(result.failed).toBe(true);
  expect(result.retained).toBe(true);
  expect(result.retried.map((item: SavedProject) => item.id)).toEqual(['retry-migration']);
  expect(result.cleaned).toBe(true);
});

test('migration recovers orphaned snapshots, preserves corrupt records and current IndexedDB data', async ({ page }) => {
  await page.goto('/#/studio');
  const projects = [snapshot('existing', 1), snapshot('orphan', 2)];
  const result = await page.evaluate(async ([existing, orphan]) => {
    const modulePath = '/utils/projectHistoryStorage.ts';
    const { ProjectHistoryStorage } = await import(modulePath);
    const storage = new ProjectHistoryStorage(indexedDB, localStorage, 'history-partial-migration-test');
    await storage.save(existing);
    localStorage.setItem('sprite_animator_project_existing', JSON.stringify({ ...existing, config: { ...existing.config, prompt: 'Stale legacy prompt' } }));
    localStorage.setItem('sprite_animator_project_orphan', JSON.stringify(orphan));
    localStorage.setItem('sprite_animator_project_corrupt', '{bad-json');
    localStorage.setItem('sprite_animator_project_list', JSON.stringify([{ id: 'missing', name: 'Missing', createdAt: 3 }]));
    const list = await storage.list();
    return { list, warning: storage.migrationWarning, corrupt: localStorage.getItem('sprite_animator_project_corrupt'), missing: localStorage.getItem('sprite_animator_project_list'), current: await storage.load('existing') };
  }, projects);
  expect(result.list.map((item: SavedProject) => item.id)).toEqual(['orphan', 'existing']);
  expect(result.warning).toBe(true);
  expect(result.corrupt).toBe('{bad-json');
  expect(result.missing).toContain('missing');
  expect(result.current.config.prompt).toBe('Prompt for existing');
});

test('cleanup failure cannot resurrect a deliberately deleted project', async ({ page }) => {
  await page.goto('/#/studio');
  const result = await page.evaluate(async (project) => {
    const modulePath = '/utils/projectHistoryStorage.ts';
    const { ProjectHistoryStorage } = await import(modulePath);
    const key = `sprite_animator_project_${project.id}`;
    localStorage.setItem(key, JSON.stringify(project));
    const originalRemove = localStorage.removeItem.bind(localStorage);
    const legacy = {
      clear: () => { throw new Error('Unsupported test storage clear'); },
      get length() { return localStorage.length; },
      key: (index: number) => localStorage.key(index),
      getItem: (name: string) => localStorage.getItem(name),
      setItem: (name: string, value: string) => localStorage.setItem(name, value),
      removeItem: (name: string) => { if (name === key) throw new Error('Synthetic cleanup failure'); originalRemove(name); },
    };
    const storage = new ProjectHistoryStorage(indexedDB, legacy, 'history-cleanup-failure-test');
    await storage.list();
    const warning = storage.migrationWarning;
    await storage.delete(project.id);
    const list = await storage.list();
    return { warning, list, retained: localStorage.getItem(key) !== null };
  }, snapshot('deleted-project'));
  expect(result.warning).toBe(true);
  expect(result.retained).toBe(true);
  expect(result.list).toEqual([]);
});

test('unavailable IndexedDB shows a retryable error and retains legacy data', async ({ page }) => {
  const project = snapshot('unavailable-history');
  await page.addInitScript((value) => {
    localStorage.setItem(`sprite_animator_project_${value.id}`, JSON.stringify(value));
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
  }, project);
  await page.goto('/#/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Project History', exact: true }).click();
  await expect(page.locator('header').getByRole('alert')).toContainText('Saved projects are unavailable');
  await expect(page.locator('header').getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('sprite_animator_project_unavailable-history'))).not.toBeNull();
});

test('ordinary history operations read lightweight metadata instead of image snapshots', async ({ page }) => {
  await page.goto('/#/studio');
  const projects = Array.from({ length: 11 }, (_, index) => ({ ...snapshot(`light-${index}`, index), sourceImage: `data:image/png;base64,${'A'.repeat(128_000)}` }));
  const result = await page.evaluate(async (values) => {
    const modulePath = '/utils/projectHistoryStorage.ts';
    const { ProjectHistoryStorage } = await import(modulePath);
    const storage = new ProjectHistoryStorage(indexedDB, localStorage, 'history-lightweight-test');
    for (const project of values.slice(0, 10)) await storage.save(project);
    const originalGet = IDBObjectStore.prototype.get;
    const originalGetAll = IDBObjectStore.prototype.getAll;
    const originalCursor = IDBObjectStore.prototype.openCursor;
    let snapshotReads = 0;
    IDBObjectStore.prototype.get = function (...args) {
      if (this.name === 'projects') { snapshotReads++; throw new Error('Unexpected image snapshot read'); }
      return originalGet.apply(this, args);
    };
    IDBObjectStore.prototype.getAll = function (...args) {
      if (this.name === 'projects') { snapshotReads++; throw new Error('Unexpected image snapshot read'); }
      return originalGetAll.apply(this, args);
    };
    IDBObjectStore.prototype.openCursor = function (...args) {
      if (this.name === 'projects') { snapshotReads++; throw new Error('Unexpected image snapshot cursor'); }
      return originalCursor.apply(this, args);
    };
    let listed;
    let saved;
    let deleted;
    try {
      const reopened = new ProjectHistoryStorage(indexedDB, localStorage, 'history-lightweight-test');
      listed = await reopened.list();
      saved = await reopened.save(values[10]);
      deleted = await reopened.delete('light-5');
    } finally {
      IDBObjectStore.prototype.get = originalGet;
      IDBObjectStore.prototype.getAll = originalGetAll;
      IDBObjectStore.prototype.openCursor = originalCursor;
    }
    return { listed, saved, deleted, snapshotReads, evicted: await storage.load('light-0') };
  }, projects);
  expect(result.snapshotReads).toBe(0);
  expect(result.listed).toHaveLength(10);
  expect(result.saved).toHaveLength(10);
  expect(result.deleted).toHaveLength(9);
  expect(result.evicted).toBeNull();
  expect(Object.keys(result.listed[0]).sort()).toEqual(['createdAt', 'id', 'name']);
});

test('v1 database upgrades preserve full snapshots and backfill lightweight metadata', async ({ page }) => {
  await page.goto('/#/studio');
  const projects = [snapshot('upgrade-old', 1), { ...snapshot('upgrade-new', 2), sourceImage: 'data:image/png;base64,retained-image-data' }];
  const result = await page.evaluate(async (values) => {
    const databaseName = 'history-v1-upgrade-test';
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const projects = request.result.createObjectStore('projects', { keyPath: 'id' });
        request.result.createObjectStore('processedLegacyIds', { keyPath: 'id' });
        for (const value of values) projects.put(value);
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
    const modulePath = '/utils/projectHistoryStorage.ts';
    const { ProjectHistoryStorage } = await import(modulePath);
    const storage = new ProjectHistoryStorage(indexedDB, localStorage, databaseName);
    return { list: await storage.list(), older: await storage.load(values[0].id), newer: await storage.load(values[1].id) };
  }, projects);
  expect(result.list.map((item: SavedProject) => item.id)).toEqual(['upgrade-new', 'upgrade-old']);
  expect(result.older).toEqual(projects[0]);
  expect(result.newer).toEqual(projects[1]);
  expect(Object.keys(result.list[0]).sort()).toEqual(['createdAt', 'id', 'name']);
});

test('failed metadata upgrade leaves the v1 database and snapshots intact', async ({ page }) => {
  await page.goto('/#/studio');
  const result = await page.evaluate(async (value) => {
    const databaseName = 'history-v1-upgrade-failure-test';
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('projects', { keyPath: 'id' }).put(value);
        request.result.createObjectStore('processedLegacyIds', { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
    const modulePath = '/utils/projectHistoryStorage.ts';
    const { ProjectHistoryStorage } = await import(modulePath);
    const storage = new ProjectHistoryStorage(indexedDB, localStorage, databaseName);
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'projectMetadata') throw new DOMException('Synthetic metadata quota failure', 'QuotaExceededError');
      return originalPut.apply(this, args);
    };
    let failed = false;
    try { await storage.list(); } catch { failed = true; }
    finally { IDBObjectStore.prototype.put = originalPut; }
    const preserved = await new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('projects', 'readonly');
        const get = transaction.objectStore('projects').get(value.id);
        transaction.oncomplete = () => { database.close(); resolve(get.result); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
    const retried = await storage.list();
    return { failed, preserved, retried };
  }, snapshot('upgrade-preserved'));
  expect(result.failed).toBe(true);
  expect(result.preserved).toEqual(snapshot('upgrade-preserved'));
  expect(result.retried.map((item: SavedProject) => item.id)).toEqual(['upgrade-preserved']);
});
