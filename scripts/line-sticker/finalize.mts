/**
 * Rebuild upload pack from active sheet folders and pack to the repo-local upload root.
 *
 *   npx tsx finalize.mts --out output/my-set [--config examples/demo-job.config.json]
 *   npx tsx finalize.mts --out output/my-set --sheets sheet-1-v2,sheet-2-v3
 */

import { resolve, relative } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeFromJob } from './finalizeJob.mts';
import { CliUsageError, cliBoolean, parseCliArgs, printCliHelp, reportCliError } from './cli.mts';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = 'Usage: finalize.mts --out <output-dir> [--config <job.config.json>] [--sheets sheet-1,sheet-2]';

function parseSheetList(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2), {
    values: ['out', 'config', 'sheets'],
    booleans: ['help'],
  });
  if (cliBoolean(args.help)) {
    printCliHelp(USAGE);
    return;
  }
  const outDir = typeof args.out === 'string' ? args.out : '';
  if (!outDir) throw new CliUsageError('Missing --out <output-dir>');

  const result = await finalizeFromJob({
    outDir: resolve(ROOT_DIR, outDir),
    configPath: typeof args.config === 'string' ? resolve(ROOT_DIR, args.config) : undefined,
    sheetDirs: parseSheetList(typeof args.sheets === 'string' ? args.sheets : undefined),
  });

  console.log(`\n✓ Finalized ${result.stickerCount} stickers`);
  console.log(`  activeSheets: ${result.activeSheets.join(', ')}`);
  if (result.uploadPackPath) console.log(`  local pack: ${result.uploadPackPath}`);
  if (result.uploadSyncPath) console.log(`  upload root sync: ${result.uploadSyncPath}`);
  if (result.uploadEnvFile) {
    const envRel = relative(ROOT_DIR, result.uploadEnvFile).replace(/\\/g, '/');
    console.log(`  upload env: ${envRel}`);
  }
}

main().catch((error) => reportCliError(error, USAGE));
