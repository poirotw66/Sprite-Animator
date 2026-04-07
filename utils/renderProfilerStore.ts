export interface RenderProfilerEntry {
  id: string;
  profilerId: string;
  phase: 'mount' | 'update' | 'nested-update';
  renderCount: number;
  actualDuration: number;
  baseDuration: number;
  averageDuration: number;
  maxDuration: number;
  lastUpdatedAt: number;
}

type Listener = () => void;

const profilerMap = new Map<string, RenderProfilerEntry>();
const listeners = new Set<Listener>();
let snapshotCache: RenderProfilerEntry[] = [];

const rebuildSnapshotCache = () => {
  snapshotCache = Array.from(profilerMap.values()).sort(
    (left, right) => right.lastUpdatedAt - left.lastUpdatedAt
  );
};

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const updateRenderProfilerEntry = (entry: RenderProfilerEntry) => {
  profilerMap.set(entry.id, entry);
  rebuildSnapshotCache();
  emit();
};

export const clearRenderProfilerEntries = () => {
  profilerMap.clear();
  rebuildSnapshotCache();
  emit();
};

export const subscribeRenderProfilerStore = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getRenderProfilerSnapshot = (): RenderProfilerEntry[] => (
  snapshotCache
);