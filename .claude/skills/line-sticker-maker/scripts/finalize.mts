/**
 * Rebuild upload pack from active sheet folders and pack to line-s (or legacy line-upload).
 *
 *   npx tsx finalize.mts --out example/output/p3 [--config example/p3-job.config.json]
 *   npx tsx finalize.mts --out example/output/p3 --sheets sheet-1-v2,sheet-2-v3
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
if (result.lineSDest) {
  console.log(`  local pack: ${result.lineSDest}`);
}
if (result.lineSSyncDest) {
  console.log(`  line-s sync: ${result.lineSSyncDest}`);
}
if (result.lineSEnvFile) {
  const envRel = relative(resolve(process.cwd()), result.lineSEnvFile).replace(/\\/g, '/');
  console.log(`  upload env: ${envRel}`);
}
