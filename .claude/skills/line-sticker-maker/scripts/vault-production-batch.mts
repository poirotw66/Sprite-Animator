/**
 * Batch: line-sticker-vault registry → output/vault-production/{set-id}/
 *
 *   npx tsx vault-production-batch.mts --resume
 *   npx tsx vault-production-batch.mts --only SET-20260712-005
 *   npx tsx vault-production-batch.mts --from 2
 */

import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { parseRegistryJson } from '../../../../utils/stickerRegistryFormat.ts';
import {
  resolveRegistryAssetPath,
  resolveVaultRoot,
  vaultRegistryPath,
  VAULT_PHRASE_SET_FILENAME,
} from '../../../../utils/stickerVault.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../../../..');
const RUN_FROM_INPUTS = resolve(SCRIPT_DIR, 'run-from-inputs.mts');
const DEFAULT_OUT_BASE = 'output/vault-production';

function parseArgs(argv: string[]): Record<string, string | boolean | number> {
  const args: Record<string, string | boolean | number> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = /^\d+$/.test(next) ? Number(next) : next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function runFromInputs(scriptArgs: string[]): void {
  const result = spawnSync('npx', ['tsx', RUN_FROM_INPUTS, ...scriptArgs], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`run-from-inputs failed: ${scriptArgs.join(' ')}`);
  }
}

function isCompleted(outDir: string): boolean {
  return (
    existsSync(resolve(outDir, 'stickers', 'sticker-01.png')) &&
    existsSync(resolve(outDir, 'manifest.json'))
  );
}

function slotIndexFromId(id: string): number {
  const match = /-(\d{3})$/.exec(id);
  return match ? Number(match[1]) : 0;
}

async function appendLog(logPath: string, line: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(line)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const resume = Boolean(args.resume);
  const only = typeof args.only === 'string' ? args.only : undefined;
  const fromSlot = typeof args.from === 'number' ? args.from : 1;
  const outBase = typeof args.out === 'string' ? args.out : DEFAULT_OUT_BASE;

  const vaultRoot = resolveVaultRoot(
    ROOT,
    typeof args.vault === 'string' ? args.vault : undefined
  );
  if (!vaultRoot) {
    throw new Error('Vault not found. Clone line-sticker-vault as sibling or pass --vault.');
  }

  const registry = parseRegistryJson(await readFile(vaultRegistryPath(vaultRoot), 'utf8'));
  const logPath = resolve(ROOT, outBase, 'batch-log.jsonl');
  const entries = registry.entries.filter((entry) => {
    if (only && entry.id !== only) return false;
    if (slotIndexFromId(entry.id) < fromSlot) return false;
    return true;
  });

  console.log(`Vault production: ${entries.length} set(s) → ${outBase}/`);
  console.log(`Vault: ${vaultRoot}`);
  if (resume) console.log('Resume: skip sets with stickers/sticker-01.png + manifest.json\n');

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const outDir = resolve(ROOT, outBase, entry.id);
    const label = `[${i + 1}/${entries.length}] ${entry.id} ${entry.characterName}`;

    if (resume && isCompleted(outDir)) {
      console.log(`${label} — skip (completed)`);
      skipped += 1;
      continue;
    }

    const refAbs = resolveRegistryAssetPath(entry.refImagePath, ROOT, vaultRoot);
    const phraseSetAbs = resolve(vaultRoot, 'sets', entry.id, VAULT_PHRASE_SET_FILENAME);
    if (!existsSync(refAbs)) {
      throw new Error(`Missing ref: ${refAbs}`);
    }
    if (!existsSync(phraseSetAbs)) {
      throw new Error(`Missing phrase-set: ${phraseSetAbs}`);
    }

    const startedAt = new Date().toISOString();
    console.log(`\n${label}`);
    await appendLog(logPath, { event: 'start', id: entry.id, startedAt });

    try {
      await mkdir(outDir, { recursive: true });
      runFromInputs([
        '--image',
        relative(ROOT, refAbs).replace(/\\/g, '/'),
        '--phrase-set',
        relative(ROOT, phraseSetAbs).replace(/\\/g, '/'),
        '--out',
        relative(ROOT, outDir).replace(/\\/g, '/'),
        '--character-concept',
        entry.characterConcept,
        '--theme',
        entry.theme,
        '--voice',
        entry.voice,
      ]);
      ok += 1;
      await appendLog(logPath, {
        event: 'done',
        id: entry.id,
        finishedAt: new Date().toISOString(),
      });
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${entry.id}: ${message}`);
      await appendLog(logPath, {
        event: 'failed',
        id: entry.id,
        error: message,
        finishedAt: new Date().toISOString(),
      });
    }
  }

  console.log(`\nBatch summary: ${ok} generated, ${skipped} skipped, ${failed} failed`);
  console.log(`Log: ${relative(ROOT, logPath).replace(/\\/g, '/')}`);
  if (failed > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
