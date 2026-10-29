import { useState, useCallback, useEffect, useRef } from 'react';
import type { SavedProject, SavedProjectMeta } from '../types';
import { useLanguage } from './useLanguage';
import { ProjectHistoryStorage } from '../utils/projectHistoryStorage';
import { logger } from '../utils/logger';

/** Async history operations report success only after their IndexedDB transaction commits. */
export function useProjectHistory() {
  const { t } = useLanguage();
  const [list, setList] = useState<SavedProjectMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasStorageError, setHasStorageError] = useState(false);
  const [hasMigrationWarning, setHasMigrationWarning] = useState(false);
  const storageRef = useRef<ProjectHistoryStorage | null>(null);
  const mountedRef = useRef(true);
  const pendingCountRef = useRef(0);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const run = useCallback(<T,>(operation: (storage: ProjectHistoryStorage) => Promise<T>, fallback: T): Promise<T> => {
    pendingCountRef.current++;
    if (mountedRef.current) setIsLoading(true);
    const task = queueRef.current.then(async () => {
      try {
        const storage = storageRef.current ??= new ProjectHistoryStorage();
        const value = await operation(storage);
        if (mountedRef.current) {
          setHasStorageError(false);
          setHasMigrationWarning(storage.migrationWarning);
        }
        return value;
      } catch (error) {
        logger.warn('Project history operation failed', error);
        if (mountedRef.current) setHasStorageError(true);
        return fallback;
      } finally {
        pendingCountRef.current--;
        if (mountedRef.current && pendingCountRef.current === 0) setIsLoading(false);
      }
    });
    queueRef.current = task;
    return task;
  }, []);

  const refreshList = useCallback(async (): Promise<void> => {
    await run(async (storage) => {
      const next = await storage.list();
      if (mountedRef.current) setList(next);
    }, undefined);
  }, [run]);

  useEffect(() => {
    mountedRef.current = true;
    void refreshList();
    return () => { mountedRef.current = false; };
  }, [refreshList]);

  const saveCurrent = useCallback(async (
    snapshot: Omit<SavedProject, 'id' | 'name' | 'createdAt'>,
    name?: string,
  ): Promise<string | null> => {
    const createdAt = Date.now();
    const id = `p_${createdAt}_${crypto.randomUUID()}`;
    const date = new Date(createdAt);
    const defaultName = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
    const project: SavedProject = { ...snapshot, id, name: name?.trim() || defaultName, createdAt };
    return run(async (storage) => {
      const next = await storage.save(project);
      if (mountedRef.current) setList(next);
      return id;
    }, null);
  }, [run]);

  const loadProjectById = useCallback(async (id: string): Promise<SavedProject | null> =>
    run(async (storage) => {
      const project = await storage.load(id);
      if (!project) throw new Error('Saved project was not found.');
      return project;
    }, null), [run]);

  const deleteProject = useCallback(async (id: string): Promise<boolean> =>
    run(async (storage) => {
      const next = await storage.delete(id);
      if (mountedRef.current) setList(next);
      return true;
    }, false), [run]);

  return {
    list, saveCurrent, loadProjectById, deleteProject, refreshList, isLoading,
    storageError: hasStorageError ? t.projectHistoryStorageError : null,
    migrationWarning: hasMigrationWarning ? t.projectHistoryMigrationWarning : null,
  };
}
