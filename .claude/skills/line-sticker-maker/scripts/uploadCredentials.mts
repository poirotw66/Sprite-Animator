/**
 * Load LINE / Google upload credentials from credentials.env or the local upload skill env.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(SCRIPT_DIR, '..');
const PROJECT_ROOT = resolve(SKILL_ROOT, '../../..');

const CREDENTIALS_ENV = resolve(SKILL_ROOT, 'credentials.env');
const LOCAL_UPLOAD_ENV = resolve(PROJECT_ROOT, '.claude/skills/line-sticker-upload/.env');

const CREDENTIAL_KEYS = [
  'LINE_EMAIL',
  'LINE_PASSWORD',
  'LINE_CREATOR_ID',
  'GOOGLE_EMAIL',
  'GOOGLE_PASSWORD',
  'GDRIVE_PARENT_FOLDER',
] as const;

const ENV_KEY_ORDER = [
  'LINE_EMAIL',
  'LINE_PASSWORD',
  'LINE_CREATOR_ID',
  'LINE_STICKER_ID',
  'GOOGLE_EMAIL',
  'GOOGLE_PASSWORD',
  'GDRIVE_PARENT_FOLDER',
  'GDRIVE_SET_FOLDER',
  'GDRIVE_STICKER_SUBFOLDER',
  'GDRIVE_FOLDER_ID',
  'GDRIVE_SHARE_URL',
  'STICKER_TITLE_ZH',
  'STICKER_DESC_ZH',
  'STICKER_TITLE_EN',
  'STICKER_DESC_EN',
  'COPYRIGHT',
  'USE_AI',
  'SALE_START',
  'STICKER_COUNT',
  'SALE_REGION',
  'JOIN_CAMPAIGNS',
  'SOURCE_ZIP',
  'UPLOAD_ZIP',
  'SPRITE_SHEETS_DIR',
] as const;

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

export function serializeEnv(vars: Record<string, string>, header: string): string {
  const lines = [header, ''];
  for (const key of ENV_KEY_ORDER) {
    if (key in vars) lines.push(`${key}=${vars[key]}`);
  }
  return lines.join('\n') + '\n';
}

export function envHeader(setName: string): string {
  return `# LINE Creators Market — ${setName}`;
}

export async function loadCredentials(): Promise<Record<string, string>> {
  const candidates: string[] = [];
  if (existsSync(CREDENTIALS_ENV)) candidates.push(CREDENTIALS_ENV);
  if (existsSync(LOCAL_UPLOAD_ENV)) candidates.push(LOCAL_UPLOAD_ENV);

  for (const credPath of candidates) {
    const cred = parseEnv(await readFile(credPath, 'utf8'));
    if (cred.LINE_EMAIL?.trim() && cred.LINE_CREATOR_ID?.trim()) {
      console.log(`▶ credentials: ${credPath}`);
      return cred;
    }
  }

  throw new Error(
    `No valid credentials (LINE_EMAIL + LINE_CREATOR_ID). ` +
      `Create ${CREDENTIALS_ENV} or restore ${LOCAL_UPLOAD_ENV}`
  );
}

/** Merge shared credentials into a per-job batch env (clears per-set upload IDs). */
export async function mergeCredentialsIntoBatch(
  batchPath: string,
  setName: string
): Promise<void> {
  const cred = await loadCredentials();
  const batch = parseEnv(await readFile(batchPath, 'utf8'));

  for (const key of CREDENTIAL_KEYS) {
    if (cred[key]) batch[key] = cred[key]!;
  }
  batch.LINE_STICKER_ID = '';
  batch.GDRIVE_FOLDER_ID = '';
  batch.GDRIVE_SHARE_URL = '';

  await writeFile(batchPath, serializeEnv(batch, envHeader(setName)));
}
