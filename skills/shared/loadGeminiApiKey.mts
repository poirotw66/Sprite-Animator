/**
 * Load GEMINI_API_KEY: env var > repo .env > repo .env.local
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED_DIR = dirname(fileURLToPath(import.meta.url));

function findRepoRoot(start: string): string {
  let current = resolve(start);
  const volumeRoot = parse(current).root;
  while (current !== volumeRoot) {
    if (existsSync(resolve(current, 'package.json'))) return current;
    current = dirname(current);
  }
  throw new Error(`Unable to locate repository root from ${start}`);
}

// The canonical file is at skills/shared, while generated runtime mirrors are
// nested below .agents/skills or .claude/skills. Discovering package.json keeps
// all three copies location-independent.
export const REPO_ROOT = findRepoRoot(SHARED_DIR);

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
