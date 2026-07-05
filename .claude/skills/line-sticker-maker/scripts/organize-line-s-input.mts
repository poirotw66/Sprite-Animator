/**
 * Package Sprite-Animator LINE output into line-s upload input layout.
 *
 *   npx tsx organize-line-s-input.mts \
 *     --source .claude/skills/line-sticker-maker/example/output/p1 \
 *     --dest "C:/Users/sora0/Desktop/line-s/input/706/Cute Otter Daily Chat" \
 *     --name "Cute Otter Daily Chat"
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface PackOptions {
  sourceDir: string;
  destDir: string;
  setName: string;
  titleZh: string;
  descZh: string;
  titleEn: string;
  descEn: string;
  sheetDirs: string[];
}

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

function buildMarkdown(options: PackOptions): string {
  return `# Traditional Chinese (Taiwan)

## Title

${options.titleZh}

## Description

${options.descZh}

---

# English

## Title

${options.titleEn}

## Description

${options.descEn}
`;
}

function buildEnvBatch(options: PackOptions): string {
  const envName = options.setName.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const relBase = `input/706/${options.setName}`;
  return `# LINE Creators Market — ${options.setName}
LINE_EMAIL=
LINE_PASSWORD=
LINE_CREATOR_ID=
LINE_STICKER_ID=

GOOGLE_EMAIL=
GOOGLE_PASSWORD=
GDRIVE_PARENT_FOLDER=LINE-sticker
GDRIVE_SET_FOLDER=${options.setName}
GDRIVE_STICKER_SUBFOLDER=sticker-pack
GDRIVE_FOLDER_ID=
GDRIVE_SHARE_URL=

STICKER_TITLE_ZH=${options.titleZh}
STICKER_DESC_ZH=${options.descZh}
STICKER_TITLE_EN=${options.titleEn}
STICKER_DESC_EN=${options.descEn}

COPYRIGHT=Copyright (c) Blo0m
USE_AI=true
SALE_START=auto
STICKER_COUNT=40
SALE_REGION=all
JOIN_CAMPAIGNS=false

SOURCE_ZIP=${relBase}/${options.setName}.zip
UPLOAD_ZIP=${relBase}/${options.setName}.zip
SPRITE_SHEETS_DIR=${relBase}/sprite_sheets
`;
}

export async function organizeLineSInput(options: PackOptions): Promise<void> {
  const sourceDir = resolve(options.sourceDir);
  const destDir = resolve(options.destDir);
  const spriteDir = resolve(destDir, 'sprite_sheets');
  await mkdir(spriteDir, { recursive: true });

  const uploadZip = resolve(sourceDir, 'line-upload.zip');
  const destZip = resolve(destDir, `${options.setName}.zip`);
  await copyFile(uploadZip, destZip);

  for (let i = 0; i < options.sheetDirs.length; i++) {
    const sheetDir = options.sheetDirs[i]!;
    const processed = resolve(sourceDir, sheetDir, '_processed-sheet.png');
    const destSprite = resolve(spriteDir, `sprite_sheet_${i + 1}_transparent.png`);
    await copyFile(processed, destSprite);
  }

  await writeFile(resolve(destDir, `${options.setName}.md`), buildMarkdown(options), 'utf8');

  const lineSRoot = resolve(destDir, '..', '..', '..');
  const envBatchDir = resolve(lineSRoot, '.env.batch');
  const envFileName = `${options.setName.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}.env`;
  await mkdir(envBatchDir, { recursive: true });
  await writeFile(resolve(envBatchDir, envFileName), buildEnvBatch(options), 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.source ?? '';
  const destDir = args.dest ?? '';
  const setName = args.name ?? '';
  if (!sourceDir || !destDir || !setName) {
    throw new Error(
      'Usage: organize-line-s-input.mts --source <p1-out> --dest <line-s/input/706/Set Name> --name "Set Name"'
    );
  }

  const sheetDirs = (args.sheets ?? 'sheet-1-flash,sheet-2').split(',').map((s) => s.trim());
  const options: PackOptions = {
    sourceDir,
    destDir,
    setName,
    titleZh: args['title-zh'] ?? '呆萌水獺：日常聊天篇',
    descZh:
      args['desc-zh'] ??
      '軟萌水獺陪你聊日常！從讚美加油、吃什麼到累爆哭哭，用超療癒表情回應每一句對話。',
    titleEn: args['title-en'] ?? 'Cute Otter: Daily Chat',
    descEn:
      args['desc-en'] ??
      'Cute Otter Daily Chat Sticker set. A fluffy otter buddy for everyday chats — cheers, snacks, meltdowns and silly moods in one adorable pack!',
    sheetDirs,
  };

  await organizeLineSInput(options);
  console.log(`✓ Packed → ${resolve(destDir)}`);
  console.log(`  ${setName}.md`);
  console.log(`  ${setName}.zip`);
  console.log(`  sprite_sheets/ (${sheetDirs.length} sheets)`);
}

main().catch((err) => {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
