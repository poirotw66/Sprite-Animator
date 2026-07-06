/**
 * Load LINE / Google upload credentials from credentials.env or line-s/.env.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(SCRIPT_DIR, '..');
const PROJECT_ROOT = resolve(SKILL_ROOT, '../../..');

const CREDENTIALS_ENV = resolve(SKILL_ROOT, 'credentials.env');
const LINE_S_ENV = resolve(PROJECT_ROOT, 'line-s/.env');

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
  for (const line of text.split('\n')) {
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

export function resolveCredentialsPath(): string {
  if (existsSync(CREDENTIALS_ENV)) return CREDENTIALS_ENV;
  if (existsSync(LINE_S_ENV)) return LINE_S_ENV;
  throw new Error(
    `No credentials file found. Create ${CREDENTIALS_ENV} or ${LINE_S_ENV}`
  );
}

export async function loadCredentials(): Promise<Record<string, string>> {
  const credPath = resolveCredentialsPath();
  const cred = parseEnv(await readFile(credPath, 'utf8'));
  console.log(`▶ credentials: ${credPath}`);
  return cred;
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
