/**
 * Load GEMINI_API_KEY: env > .env > .env.local (repo root).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = resolve(SCRIPT_DIR, '../../../..');

function readKeyFromFile(path: string): string {
  if (!existsSync(path)) return '';
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/);
    if (m) return m[1]!.replace(/^["']|["']$/g, '');
  }
  return '';
}

export function loadApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return (
    readKeyFromFile(resolve(ROOT_DIR, '.env')) ||
    readKeyFromFile(resolve(ROOT_DIR, '.env.local'))
  );
}
