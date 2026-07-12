/**
 * JSON format for LINE sticker phrase set export/import.
 * Allows saving and loading phrase lists + optional action descriptions and grid settings.
 *
 * Example (single mode, 4×4 grid):
 * {
 *   "format": "line-sticker-phrase-set",
 *   "version": 1,
 *   "mode": "single",
 *   "gridCols": 4,
 *   "gridRows": 4,
 *   "phrases": ["早安", "晚安", ...],
 *   "actionDescs": ["wave hand", "sleepy expression", ...],
 *   "name": "My set"
 * }
 *
 * Example (set mode, one full sticker set):
 * { "format": "line-sticker-phrase-set", "version": 1, "mode": "set", "phrases": [...set items], "actionDescs": [...] }
 */

export const PHRASE_SET_FORMAT = 'line-sticker-phrase-set' as const;
export const PHRASE_SET_VERSION = 1;

/** Standard LINE sticker pack size (40 stickers per set). */
export const LINE_STICKER_PHRASE_SET_SIZE = 40;

/** Exported/imported phrase set (single sheet or one full sticker set). */
export interface LineStickerPhraseSetJson {
  format: typeof PHRASE_SET_FORMAT;
  version: typeof PHRASE_SET_VERSION;
  /** 'single' = one sheet with custom grid; 'set' = one full configured sticker set. */
  mode: 'single' | 'set';
  /** Grid columns (required when mode is 'single'). */
  gridCols?: number;
  /** Grid rows (required when mode is 'single'). */
  gridRows?: number;
  /** Phrase text per cell. Length = gridCols*gridRows (single) or full set size (set). */
  phrases: string[];
  /** Optional action description per cell, same length as phrases. */
  actionDescs?: string[];
  /** Optional display name for the set. */
  name?: string;
}

function isNonNegativeInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

function isStringArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every((x) => typeof x === 'string');
}

/**
 * Validates and parses JSON into a phrase set. Returns null if invalid.
 */
export function parsePhraseSetJson(json: string): LineStickerPhraseSetJson | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (data == null || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (o.format !== PHRASE_SET_FORMAT || o.version !== PHRASE_SET_VERSION) return null;
  const mode = o.mode;
  if (mode !== 'single' && mode !== 'set') return null;
  const phrases = o.phrases;
  if (!isStringArray(phrases)) return null;
  if (mode === 'single') {
    const cols = o.gridCols;
    const rows = o.gridRows;
    if (!isNonNegativeInteger(cols) || cols < 1 || cols > 8) return null;
    if (!isNonNegativeInteger(rows) || rows < 1 || rows > 8) return null;
    if (phrases.length !== cols * rows) return null;
  } else {
    if (phrases.length !== LINE_STICKER_PHRASE_SET_SIZE) return null;
  }
  const actionDescs = o.actionDescs;
  if (actionDescs !== undefined) {
    if (!isStringArray(actionDescs)) return null;
    if (mode === 'set' && actionDescs.length !== LINE_STICKER_PHRASE_SET_SIZE) return null;
    if (mode === 'single' && actionDescs.length !== phrases.length) return null;
  }
  const name = o.name;
  if (mode === 'set') {
    return {
      format: PHRASE_SET_FORMAT,
      version: PHRASE_SET_VERSION,
      mode,
      phrases,
      actionDescs: actionDescs as string[] | undefined,
      name: typeof name === 'string' ? name : undefined,
    };
  }
  return {
    format: PHRASE_SET_FORMAT,
    version: PHRASE_SET_VERSION,
    mode,
    gridCols: mode === 'single' ? (o.gridCols as number) : undefined,
    gridRows: mode === 'single' ? (o.gridRows as number) : undefined,
    phrases,
    actionDescs: actionDescs as string[] | undefined,
    name: typeof name === 'string' ? name : undefined,
  };
}

/**
 * Builds export object from current state. Caller can JSON.stringify and save to file.
 */
export function buildPhraseSetExport(params: {
  mode: 'single' | 'set';
  gridCols: number;
  gridRows: number;
  phrases: string[];
  actionDescs: string[];
  name?: string;
}): LineStickerPhraseSetJson {
  const { mode, gridCols, gridRows, phrases, actionDescs, name } = params;
  if (mode === 'set') {
    const p = phrases.slice(0, LINE_STICKER_PHRASE_SET_SIZE);
    const a = actionDescs.slice(0, LINE_STICKER_PHRASE_SET_SIZE);
    if (p.length !== LINE_STICKER_PHRASE_SET_SIZE || a.length !== LINE_STICKER_PHRASE_SET_SIZE) {
      throw new Error(
        `Set mode requires exactly ${LINE_STICKER_PHRASE_SET_SIZE} phrases and actionDescs`
      );
    }
    return {
      format: PHRASE_SET_FORMAT,
      version: PHRASE_SET_VERSION,
      mode: 'set',
      phrases: p,
      actionDescs: a,
      name,
    };
  }
  const total = gridCols * gridRows;
  const p = phrases.slice(0, total);
  const a = actionDescs.slice(0, total);
  return {
    format: PHRASE_SET_FORMAT,
    version: PHRASE_SET_VERSION,
    mode: 'single',
    gridCols,
    gridRows,
    phrases: p.length < total ? [...p, ...Array(total - p.length).fill('')] : p,
    actionDescs: a.length < total ? [...a, ...Array(total - a.length).fill('')] : a,
    name,
  };
}
