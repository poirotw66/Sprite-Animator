import type { ComicProject } from './comicPanelSchema';

export type ComicDownloadKind = 'character-sheet' | 'page';

const FORBIDDEN_FILENAME_CHARS = /[\\/:*?"<>|]/g;

/** Pick a short human-readable label from project text fields. */
export function pickComicCharacterLabel(project: ComicProject): string {
  const concept = project.characterConcept.trim();
  if (concept) {
    return concept.split(/\r?\n/)[0]!.trim();
  }
  const synopsis = project.synopsis?.trim();
  if (synopsis) {
    return synopsis.split(/\r?\n/)[0]!.trim();
  }
  return '';
}

export function sanitizeComicFilenameSegment(value: string, maxLen = 24): string {
  const cleaned = value
    .replace(FORBIDDEN_FILENAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return '';
  }
  if (cleaned.length <= maxLen) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLen).trim()}…`;
}

export function formatComicDownloadTimestamp(ms: number): string {
  const date = new Date(ms);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

export function buildComicDownloadFilename(
  project: ComicProject,
  kind: ComicDownloadKind,
  nowMs: number = Date.now()
): string {
  const stamp = formatComicDownloadTimestamp(nowMs);
  const label = sanitizeComicFilenameSegment(pickComicCharacterLabel(project));
  const kindLabel = kind === 'character-sheet' ? '設定圖' : '四格漫畫頁';

  if (label) {
    return `一頁式漫畫_${label}_${kindLabel}_${stamp}.png`;
  }
  return `一頁式漫畫_${kindLabel}_${stamp}.png`;
}
