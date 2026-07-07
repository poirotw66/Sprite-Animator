/**
 * Rebuild upload pack from active sheet folders and pack to the repo-local upload root.
 *
 *   npx tsx finalize.mts --out output/my-set [--config examples/demo-job.config.json]
 *   npx tsx finalize.mts --out output/my-set --sheets sheet-1-v2,sheet-2-v3
 */

import { resolve, relative } from 'node:path';
import { finalizeFromJob } from './finalizeJob.mts';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function parseSheetList(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
const outDir = args.out ?? '';
if (!outDir) {
  console.error(
    'Usage: finalize.mts --out <output-dir> [--config job.json] [--sheets sheet-1,sheet-2]'
  );
  process.exit(1);
}

const result = await finalizeFromJob({
  outDir: resolve(process.cwd(), outDir),
  configPath: args.config ? resolve(process.cwd(), args.config) : undefined,
  sheetDirs: parseSheetList(args.sheets),
});

console.log(`\n✓ Finalized ${result.stickerCount} stickers`);
console.log(`  activeSheets: ${result.activeSheets.join(', ')}`);
if (result.uploadPackPath) {
  console.log(`  local pack: ${result.uploadPackPath}`);
}
if (result.uploadSyncPath) {
  console.log(`  upload root sync: ${result.uploadSyncPath}`);
}
if (result.uploadEnvFile) {
  const envRel = relative(resolve(process.cwd()), result.uploadEnvFile).replace(/\\/g, '/');
  console.log(`  upload env: ${envRel}`);
}
