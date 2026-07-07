/**
 * Load GEMINI_API_KEY: env var > repo .env > repo .env.local
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SHARED_DIR, '../../..');

function readKeyFromFile(path: string): string {
  if (!existsSync(path)) return '';
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/);
    if (match) return match[1]!.replace(/^["']|["']$/g, '');
  }
  return '';
}

export function loadGeminiApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return (
    readKeyFromFile(resolve(REPO_ROOT, '.env')) ||
    readKeyFromFile(resolve(REPO_ROOT, '.env.local'))
  );
}
