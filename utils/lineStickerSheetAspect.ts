/** Gemini imageConfig aspect ratios, closest to cols/rows for equal square cells. */
const SUPPORTED_ASPECT_RATIOS = [
  { str: '1:1', val: 1.0 },
  { str: '3:4', val: 0.75 },
  { str: '4:3', val: 1.333 },
  { str: '9:16', val: 0.5625 },
  { str: '16:9', val: 1.778 },
  { str: '1:4', val: 0.25 },
  { str: '4:1', val: 4.0 },
  { str: '1:8', val: 0.125 },
  { str: '8:1', val: 8.0 },
] as const;

const CANVAS_ASPECT_LABELS: Record<string, string> = {
  '1:1': 'Square image (1:1 aspect ratio)',
  '3:4': 'Portrait image (3:4 aspect ratio, width:height)',
  '4:3': 'Landscape image (4:3 aspect ratio, width:height)',
  '9:16': 'Portrait image (9:16 aspect ratio, width:height)',
  '16:9': 'Landscape image (16:9 aspect ratio, width:height)',
  '1:4': 'Tall image (1:4 aspect ratio, width:height)',
  '4:1': 'Wide image (4:1 aspect ratio, width:height)',
  '1:8': 'Tall image (1:8 aspect ratio, width:height)',
  '8:1': 'Wide image (8:1 aspect ratio, width:height)',
};

/** Pick the Gemini aspect ratio closest to cols/rows (equal square cells when matched). */
export function getBestAspectRatio(cols: number, rows: number): string {
  const targetRatio = cols / rows;
  return SUPPORTED_ASPECT_RATIOS.reduce((prev, curr) =>
    Math.abs(curr.val - targetRatio) < Math.abs(prev.val - targetRatio) ? curr : prev
  ).str;
}

/** Human-readable canvas aspect line for LINE sticker prompts (matches Gemini imageConfig). */
export function getLineStickerCanvasAspectPrompt(cols: number, rows: number): string {
  const ratio = getBestAspectRatio(cols, rows);
  return CANVAS_ASPECT_LABELS[ratio] ?? `Canvas (${ratio} aspect ratio, width:height)`;
}
