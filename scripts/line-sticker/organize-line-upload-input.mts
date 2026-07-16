/**
 * Package Sprite-Animator LINE output into the upload-root input layout.
 *
 *   npx tsx organize-line-upload-input.mts \
 *     --source output/my-set \
 *     --dest ".line-upload/input/706/Cozy Cream Cat Daily Chat" \
 *     --name "Cozy Cream Cat Daily Chat" \
 *     --title-zh "..." --title-en "..."
 */

import { resolve } from 'node:path';
import {
  packUploadOutput,
  type UploadConfig,
  validateUploadConfig,
} from './uploadConfig.mts';

export type { UploadConfig } from './uploadConfig.mts';
export {
  isUploadEnabled,
  packUploadOutput,
  resolveUploadConfig,
  resolveUploadPackDir,
  validateUploadConfig,
} from './uploadConfig.mts';

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

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.source ?? '';
  const destDirArg = args.dest ?? '';
  const setName = args.name ?? '';
  if (!sourceDir || !destDirArg || !setName) {
    throw new Error(
      'Usage: organize-line-upload-input.mts --source <out> --dest <upload-root/input/706/Set Name> --name "Set Name" ' +
        '--title-zh "..." --desc-zh "..." --title-en "..." --desc-en "..." [--sheets sheet-1,sheet-2]'
    );
  }

  const titleZh = args['title-zh'] ?? '';
  const descZh = args['desc-zh'] ?? '';
  const titleEn = args['title-en'] ?? '';
  const descEn = args['desc-en'] ?? '';
  if (!titleZh || !descZh || !titleEn || !descEn) {
    throw new Error('organize-line-upload-input requires --title-zh, --desc-zh, --title-en, --desc-en');
  }

  const sheetDirs = (args.sheets ?? 'sheet-1,sheet-2').split(',').map((s) => s.trim()).filter(Boolean);
  const uploadRoot = resolve(destDirArg, '..', '..', '..');
  const upload: UploadConfig = {
    root: uploadRoot,
    creatorId: '706',
    setName,
    titleZh,
    descZh,
    titleEn,
    descEn,
  };
  validateUploadConfig(upload);

  const { readFile } = await import('node:fs/promises');
  const zipPath = resolve(sourceDir, 'line-upload.zip');
  let zipBytes: Uint8Array;
  try {
    zipBytes = new Uint8Array(await readFile(zipPath));
  } catch {
    throw new Error(
      `Missing ${zipPath}. Run finalize.mts or generate.mts first, or pass a job with upload enabled.`
    );
  }

  const { destDir, envFilePath } = await packUploadOutput({
    sourceDir: resolve(sourceDir),
    upload,
    sheetDirs,
    zipBytes,
  });

  console.log(`✓ Packed → ${destDir}`);
  console.log(`  ${setName}.md`);
  console.log(`  ${setName}.zip`);
  console.log(`  sprite_sheets/ (${sheetDirs.length} sheets)`);
  if (envFilePath) console.log(`  ${envFilePath}`);
}

const isCli = process.argv[1]?.includes('organize-line-upload-input');
if (isCli) {
  main().catch((err) => {
    console.error('✗', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
