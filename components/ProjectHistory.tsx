import React, { useState, useCallback, useRef, useEffect } from 'react';
import { History, Save, Trash2, ChevronDown, ChevronUp } from './Icons';
import { useLanguage } from '../hooks/useLanguage';
import type { SavedProjectMeta, SavedProject } from '../types';

interface ProjectHistoryProps {
  list: SavedProjectMeta[];
  onSaveCurrent: (name?: string) => Promise<boolean>;
  loadProjectById: (id: string) => Promise<SavedProject | null>;
  onLoad: (project: SavedProject) => void;
  onDelete: (id: string) => Promise<boolean>;
  canSave: boolean;
  isSaving?: boolean;
  isLoading?: boolean;
  storageError?: string | null;
  migrationWarning?: string | null;
  onRetry?: () => Promise<void>;
  /** Shown when save failed. User can dismiss. */
  saveError?: string | null;
  onClearSaveError?: () => void;
  /** When 'header', renders as a compact button + dropdown in the header bar */
  variant?: 'header' | 'sidebar';
}

export const ProjectHistory: React.FC<ProjectHistoryProps> = React.memo(({
  list,
  onSaveCurrent,
  loadProjectById,
  onLoad,
  onDelete,
  canSave,
  isSaving = false,
  isLoading = false,
  storageError = null,
  migrationWarning = null,
  onRetry,
  saveError = null,
  onClearSaveError,
  variant = 'sidebar',
}) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const pendingRef = useRef(false);

  const handleSave = useCallback(async () => {
    if (!canSave || isLoading || pendingRef.current || storageError) return;
    pendingRef.current = true;
    setIsActing(true);
    setActionError(null);
    try {
      if (await onSaveCurrent(saveName.trim() || undefined)) {
        setSaveName('');
        setShowSaveInput(false);
      } else setActionError(t.errorSaveProject);
    } catch { setActionError(t.errorSaveProject); }
    finally { pendingRef.current = false; setIsActing(false); }
  }, [canSave, isLoading, storageError, saveName, onSaveCurrent, t.errorSaveProject]);

  const handleLoad = async (id: string) => {
    if (isLoading || pendingRef.current || storageError) return;
    pendingRef.current = true;
    setIsActing(true);
    setActionError(null);
    try {
      const project = await loadProjectById(id);
      if (!project) { setActionError(t.projectHistoryLoadError); return; }
      onLoad(project);
      setExpanded(false);
    } catch { setActionError(t.projectHistoryLoadError); }
    finally { pendingRef.current = false; setIsActing(false); }
  };

  const handleDelete = async (id: string) => {
    if (isLoading || pendingRef.current || storageError) return;
    pendingRef.current = true;
    setIsActing(true);
    setActionError(null);
    try {
      if (!await onDelete(id)) setActionError(t.projectHistoryStorageError);
    } catch { setActionError(t.projectHistoryStorageError); }
    finally { pendingRef.current = false; setIsActing(false); }
  };
  const busy = isLoading || isActing || isSaving;

  useEffect(() => {
    if (variant !== 'header' || !expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [variant, expanded]);

  const isHeader = variant === 'header';

  const triggerButton = (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      className={
        isHeader
          ? 'ui-btn-ghost min-w-11 px-0 relative'
          : 'w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors touch-manipulation'
      }
      aria-expanded={expanded}
      aria-label={t.projectHistory}
      title={t.projectHistory}
    >
      <History className={isHeader ? 'w-5 h-5 text-slate-600' : 'w-5 h-5 text-slate-500 flex-shrink-0'} />
      {!isHeader && (
        <>
          <span className="font-semibold text-slate-700 truncate">{t.projectHistory}</span>
          {list.length > 0 && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {list.length}
            </span>
          )}
          {expanded ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
        </>
      )}
      {isHeader && list.length > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-signal text-white text-[10px] font-bold flex items-center justify-center">
          {list.length}
        </span>
      )}
    </button>
  );

  const panelContent = (
    <div className={isHeader ? 'p-3 space-y-3 w-full' : 'border-t border-slate-200 p-4 space-y-4'}>
          {storageError && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              <p>{storageError}</p>
              {onRetry && <button type="button" className="ui-btn-secondary w-full" disabled={busy} onClick={() => { setActionError(null); void onRetry(); }}>{t.projectHistoryRetry}</button>}
            </div>
          )}
          {migrationWarning && <p className="text-sm text-warn" role="status">{migrationWarning}</p>}
          {actionError && <p className="text-sm text-red-700" role="alert">{actionError}</p>}
          {saveError && (
            <div className="flex items-center justify-between gap-2 text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200" role="alert">
              <span>{saveError}</span>
              {onClearSaveError && (
                <button
                  type="button"
                  onClick={onClearSaveError}
                  className="flex-shrink-0 px-2 py-1 rounded hover:bg-red-100 text-red-600 font-medium touch-manipulation"
                  aria-label={t.reset}
                >
                  ×
                </button>
              )}
            </div>
          )}
          {/* Save current */}
          <div className="space-y-2">
            {showSaveInput ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={t.projectNamePlaceholder}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus-visible:ring-signal focus:border-signal outline-none"
                  aria-label={t.projectNamePlaceholder}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave || busy || !!storageError}
                    className="min-h-[40px] px-3 py-2 rounded-lg text-sm font-semibold bg-signal text-white hover:bg-signal-hover disabled:opacity-50 flex items-center gap-2 touch-manipulation"
                  >
                    {isSaving ? <span className="animate-pulse">…</span> : <Save className="w-4 h-4" />}
                    {t.saveProject}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSaveInput(false); setSaveName(''); }}
                    className="min-h-[40px] px-3 py-2 rounded-lg text-sm border border-slate-200 hover:bg-slate-50 touch-manipulation"
                  >
                    {t.reset}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveInput(true)}
                disabled={!canSave || busy || !!storageError}
                className="w-full min-h-[40px] flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                <Save className="w-4 h-4" />
                {t.saveProject}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar space-y-1">
            {isLoading ? (
              <p className="text-sm text-slate-500 py-2" role="status">{t.projectHistoryLoading}</p>
            ) : list.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">{t.noProjectsYet}</p>
            ) : (
              list.map((meta) => (
                <ProjectHistoryItem
                  key={meta.id}
                  meta={meta}
                  disabled={busy || !!storageError}
                  onLoad={() => { void handleLoad(meta.id); }}
                  onDelete={() => { void handleDelete(meta.id); }}
                />
              ))
            )}
          </div>
        </div>
  );

  return (
    <div
      ref={containerRef}
      className={
        isHeader
          ? 'shrink-0 md:relative'
          : 'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden'
      }
    >
      {isHeader ? (
        <>
          {triggerButton}
          {expanded && (
            <div className="absolute right-0 top-full mt-2 z-30 w-[min(320px,calc(100vw-58px))] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              {panelContent}
            </div>
          )}
        </>
      ) : (
        <>
          {triggerButton}
          {expanded && panelContent}
        </>
      )}
    </div>
  );
});

ProjectHistory.displayName = 'ProjectHistory';

interface ProjectHistoryItemProps {
  meta: SavedProjectMeta;
  disabled: boolean;
  onLoad: () => void;
  onDelete: () => void;
}

const ProjectHistoryItem: React.FC<ProjectHistoryItemProps> = React.memo(({
  meta,
  disabled,
  onLoad,
  onDelete,
}) => {
  const { t } = useLanguage();
  const dateStr = new Date(meta.createdAt).toLocaleString();
  const handleLoad = () => { if (!disabled) onLoad(); };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={handleLoad}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLoad(); } }}
      className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 group cursor-pointer"
      aria-label={t.loadProject}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{meta.name}</p>
        <p className="text-xs text-slate-500">{dateStr}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); handleLoad(); }}
          className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-slate-600 hover:bg-signal-soft hover:text-signal-hover flex items-center justify-center touch-manipulation"
          title={t.loadProject}
          aria-label={t.loadProject}
        >
          <History className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center touch-manipulation"
          title={t.deleteProject}
          aria-label={t.deleteProject}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

ProjectHistoryItem.displayName = 'ProjectHistoryItem';
