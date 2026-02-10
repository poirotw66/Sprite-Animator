import { useState, useCallback, useEffect } from 'react';
import type { SavedProject, SavedProjectMeta } from '../types';
import { logger } from '../utils/logger';

const STORAGE_LIST_KEY = 'sprite_animator_project_list';
const STORAGE_ITEM_PREFIX = 'sprite_animator_project_';
const MAX_PROJECTS = 10;

function loadList(): SavedProjectMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_LIST_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedProjectMeta[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveList(list: SavedProjectMeta[]): void {
  try {
    localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(list));
  } catch (e) {
    logger.warn('Failed to save project list', e);
  }
}

function loadProject(id: string): SavedProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_ITEM_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as SavedProject;
  } catch {
    return null;
  }
}

/** Returns true if saved successfully; false if localStorage threw (e.g. quota exceeded). */
function saveProjectItem(project: SavedProject): boolean {
  try {
    localStorage.setItem(STORAGE_ITEM_PREFIX + project.id, JSON.stringify(project));
    return true;
  } catch (e) {
    logger.warn('Failed to save project', e);
    return false;
  }
}

function deleteProjectItem(id: string): void {
  try {
    localStorage.removeItem(STORAGE_ITEM_PREFIX + id);
  } catch {
    // ignore
  }
}

/**
 * Hook for project history: list, save current, load, delete.
 * Stores up to MAX_PROJECTS in localStorage (list + full snapshot per id).
 */
export function useProjectHistory() {
  const [list, setList] = useState<SavedProjectMeta[]>(() => loadList());

  const refreshList = useCallback(() => {
    setList(loadList());
  }, []);

  const saveCurrent = useCallback(
    (snapshot: Omit<SavedProject, 'id' | 'name' | 'createdAt'>, name?: string): string | null => {
      const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const defaultName = (() => {
        const d = new Date();
        const Y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        return `${Y}-${M}-${D}_${h}-${min}-${s}`;
      })();
      const meta: SavedProjectMeta = {
        id,
        name: name?.trim() || defaultName,
        createdAt: Date.now(),
      };
      const project: SavedProject = {
        ...snapshot,
        id: meta.id,
        name: meta.name,
        createdAt: meta.createdAt,
      };
      const ok = saveProjectItem(project);
      if (!ok) return null;
      const currentList = loadList();
      const nextList = [meta, ...currentList].slice(0, MAX_PROJECTS);
      saveList(nextList);
      setList(nextList);
      return id;
    },
    []
  );

  const loadProjectById = useCallback((id: string): SavedProject | null => {
    return loadProject(id);
  }, []);

  const deleteProject = useCallback((id: string) => {
    const currentList = loadList().filter((m) => m.id !== id);
    saveList(currentList);
    deleteProjectItem(id);
    setList(currentList);
  }, []);

  return { list, saveCurrent, loadProjectById, deleteProject, refreshList };
}
