import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Grid, ChevronDown, ChevronUp, RotateCcw } from './Icons';
import {
  clearRenderProfilerEntries,
  getRenderProfilerSnapshot,
  subscribeRenderProfilerStore,
} from '../utils/renderProfilerStore';

export interface RenderProfilerDebugPanelProps {
  title?: string;
  filterIds?: string[];
}

export const RenderProfilerDebugPanel: React.FC<RenderProfilerDebugPanelProps> = ({
  title = 'Render Profiler',
  filterIds,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const entries = useSyncExternalStore(subscribeRenderProfilerStore, getRenderProfilerSnapshot, getRenderProfilerSnapshot);

  const filteredEntries = useMemo(() => {
    if (!filterIds || filterIds.length === 0) {
      return entries;
    }

    return entries.filter((entry) => filterIds.includes(entry.id));
  }, [entries, filterIds]);

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg hover:bg-slate-50"
      >
        <Grid className="h-4 w-4" />
        {title}
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {isOpen ? (
        <div className="w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">Dev only. Tracks recent profiler commits.</p>
            </div>
            <button
              type="button"
              onClick={clearRenderProfilerEntries}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto p-3">
            {filteredEntries.length > 0 ? (
              <div className="space-y-2">
                {filteredEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{entry.id}</p>
                        <p className="text-[11px] text-slate-500">{entry.phase} at {new Date(entry.lastUpdatedAt).toLocaleTimeString()}</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                        #{entry.renderCount}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-200">
                        <span className="block text-slate-400">Actual</span>
                        <span className="font-semibold text-slate-900">{entry.actualDuration} ms</span>
                      </div>
                      <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-200">
                        <span className="block text-slate-400">Base</span>
                        <span className="font-semibold text-slate-900">{entry.baseDuration} ms</span>
                      </div>
                      <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-200">
                        <span className="block text-slate-400">Average</span>
                        <span className="font-semibold text-slate-900">{entry.averageDuration} ms</span>
                      </div>
                      <div className="rounded-lg bg-white px-2 py-1.5 border border-slate-200">
                        <span className="block text-slate-400">Max</span>
                        <span className="font-semibold text-slate-900">{entry.maxDuration} ms</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                No profiler samples yet. Interact with the page to populate data.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};