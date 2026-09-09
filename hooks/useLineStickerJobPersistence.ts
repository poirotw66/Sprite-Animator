import { useCallback, useEffect, useRef, useState } from 'react';
import { IndexedDbLineStickerJobRepository } from '../features/line-sticker/persistence/indexedDbLineStickerJobRepository';
import type { LineStickerJobRepository } from '../features/line-sticker/persistence/lineStickerJobRepository';
import {
  deleteLineStickerJobWithAssets,
  hasPersistableWorkspaceArtifacts,
  loadLineStickerWorkspaceSnapshot,
  saveLineStickerWorkspaceSnapshot,
  type LineStickerWorkspaceArtifacts,
} from '../features/line-sticker/persistence/lineStickerJobWorkspaceMapper';
import type { LineStickerJobTextState } from '../features/line-sticker/domain/lineStickerJobText';
import type { LineStickerJobSheet } from '../features/line-sticker/domain/lineStickerJob';
import type { LineStickerRunController } from './useLineStickerRunState';
import { logger } from '../utils/logger';

const ACTIVE_JOB_STORAGE_KEY = 'line-sticker.activeJobId';
const AUTOSAVE_DEBOUNCE_MS = 750;

export interface UseLineStickerJobPersistenceOptions {
  isGenerating: boolean;
  run: LineStickerRunController;
  sourceImage: string | null;
  setSourceImage: (value: string | null) => void;
  stickerSetMode: boolean;
  setStickerSetMode: (value: boolean) => void;
  setPhrasesList: string[];
  setSetPhrasesList: (value: string[]) => void;
  actionDescsList: string[];
  setActionDescsList: (value: string[]) => void;
  jobTextState?: LineStickerJobTextState;
  replaceFromJobSheets?: (sheets: readonly LineStickerJobSheet[]) => void;
  sheetImages: (string | null)[];
  setSheetImages: (value: (string | null)[]) => void;
  processedSheetImages: (string | null)[];
  setProcessedSheetImages: (value: (string | null)[]) => void;
  sheetFrames: string[][];
  setSheetFrames: (value: string[][]) => void;
  setSpriteSheetImage: (value: string | null) => void;
  setProcessedSpriteSheet: (value: string | null) => void;
  repository?: LineStickerJobRepository;
}

function readActiveJobId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeActiveJobId(jobId: string | null): void {
  try {
    if (jobId) localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId);
    else localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
  } catch {
    // Ignore private-mode / disabled storage failures.
  }
}

/** Restores the last LINE sticker job after refresh and autosaves durable artifacts. */
export function useLineStickerJobPersistence({
  isGenerating,
  run,
  sourceImage,
  setSourceImage,
  stickerSetMode,
  setStickerSetMode,
  setPhrasesList,
  setSetPhrasesList,
  actionDescsList,
  setActionDescsList,
  jobTextState,
  replaceFromJobSheets,
  sheetImages,
  setSheetImages,
  processedSheetImages,
  setProcessedSheetImages,
  sheetFrames,
  setSheetFrames,
  setSpriteSheetImage,
  setProcessedSpriteSheet,
  repository: repositoryOverride,
}: UseLineStickerJobPersistenceOptions) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [wasInterruptedOnResume, setWasInterruptedOnResume] = useState(false);
  const repositoryRef = useRef<LineStickerJobRepository | null>(repositoryOverride ?? null);
  const createdAtRef = useRef<string>(new Date().toISOString());
  const skipNextSaveRef = useRef(false);
  const hydrateRun = run.hydrateRun;

  useEffect(() => {
    if (repositoryOverride) {
      repositoryRef.current = repositoryOverride;
      return;
    }
    if (typeof indexedDB === 'undefined') {
      repositoryRef.current = null;
      setIsHydrating(false);
      return;
    }
    repositoryRef.current = new IndexedDbLineStickerJobRepository();
  }, [repositoryOverride]);

  useEffect(() => {
    let cancelled = false;
    const repository = repositoryRef.current;
    if (!repository) {
      setIsHydrating(false);
      return;
    }

    const hydrate = async () => {
      try {
        const storedId = readActiveJobId();
        const summaries = await repository.list();
        const jobToLoad = storedId ?? summaries[0]?.id ?? null;
        if (!jobToLoad) return;

        const loaded = await loadLineStickerWorkspaceSnapshot({ repository, jobId: jobToLoad });
        if (!loaded || cancelled) return;

        skipNextSaveRef.current = true;
        createdAtRef.current = loaded.snapshot.job.createdAt;
        setJobId(loaded.snapshot.job.id);
        writeActiveJobId(loaded.snapshot.job.id);
        setStickerSetMode(loaded.artifacts.mode === 'set');
        setSourceImage(loaded.artifacts.sourceImage);
        if (replaceFromJobSheets) {
          replaceFromJobSheets(loaded.snapshot.job.sheets);
        } else {
          setSetPhrasesList(loaded.artifacts.setPhrasesList);
          setActionDescsList(loaded.artifacts.actionDescsList);
        }
        setSheetImages([...loaded.artifacts.sheetImages]);
        setProcessedSheetImages([...loaded.artifacts.processedSheetImages]);
        setSheetFrames(loaded.artifacts.sheetFrames.map((frames) => [...frames]));
        const firstReadyIndex = loaded.artifacts.sheetImages.findIndex(Boolean);
        if (firstReadyIndex >= 0) {
          setSpriteSheetImage(loaded.artifacts.sheetImages[firstReadyIndex]);
          setProcessedSpriteSheet(loaded.artifacts.processedSheetImages[firstReadyIndex]);
        }
        hydrateRun(loaded.snapshot.run);
        setShowRestoredNotice(true);
        setWasInterruptedOnResume(loaded.wasInterrupted);
      } catch (error) {
        logger.warn('Failed to restore LINE sticker job from IndexedDB', error);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    hydrateRun,
    replaceFromJobSheets,
    setActionDescsList,
    setProcessedSheetImages,
    setProcessedSpriteSheet,
    setSetPhrasesList,
    setSheetFrames,
    setSheetImages,
    setSourceImage,
    setSpriteSheetImage,
    setStickerSetMode,
  ]);

  const clearPersistedJob = useCallback(async () => {
    const repository = repositoryRef.current;
    const activeId = jobId ?? readActiveJobId();
    setJobId(null);
    writeActiveJobId(null);
    createdAtRef.current = new Date().toISOString();
    setShowRestoredNotice(false);
    setWasInterruptedOnResume(false);
    if (repository && activeId) {
      try {
        await deleteLineStickerJobWithAssets(repository, activeId);
      } catch (error) {
        logger.warn('Failed to clear persisted LINE sticker job', error);
      }
    }
  }, [jobId]);

  const dismissRestoredNotice = useCallback(() => {
    setShowRestoredNotice(false);
  }, []);

  useEffect(() => {
    if (isHydrating || isGenerating || skipNextSaveRef.current) {
      if (skipNextSaveRef.current && !isHydrating) skipNextSaveRef.current = false;
      return;
    }

    const artifacts: LineStickerWorkspaceArtifacts = {
      mode: stickerSetMode ? 'set' : 'single',
      sourceImage,
      setPhrasesList,
      actionDescsList,
      ...(jobTextState ? { jobTextState } : {}),
      sheetImages,
      processedSheetImages,
      sheetFrames,
    };
    if (!hasPersistableWorkspaceArtifacts(artifacts)) return;

    const repository = repositoryRef.current;
    if (!repository) return;

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const nextJobId = jobId ?? crypto.randomUUID();
          if (!jobId) {
            setJobId(nextJobId);
            writeActiveJobId(nextJobId);
          }
          await saveLineStickerWorkspaceSnapshot({
            repository,
            jobId: nextJobId,
            createdAt: createdAtRef.current,
            artifacts,
            run: run.state,
          });
          writeActiveJobId(nextJobId);
        } catch (error) {
          logger.warn('Failed to persist LINE sticker job', error);
        }
      })();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [
    actionDescsList,
    isGenerating,
    isHydrating,
    jobId,
    jobTextState,
    processedSheetImages,
    run.state,
    setPhrasesList,
    sheetFrames,
    sheetImages,
    sourceImage,
    stickerSetMode,
  ]);

  return {
    isHydrating,
    jobId,
    showRestoredNotice,
    wasInterruptedOnResume,
    dismissRestoredNotice,
    clearPersistedJob,
  };
}
