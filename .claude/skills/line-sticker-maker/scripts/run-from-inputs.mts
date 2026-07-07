/**
 * Run LINE sticker generation from a reference image + phrase-set JSON.
 *
 *   npx tsx run-from-inputs.mts \
 *     --image path/to/ref.png \
 *     --phrase-set path/to/phrases.json \
 *     --out path/to/output \
 *     [--set-name "My Set"] [--title-zh "標題"] [--dry-run]
 *
 * Writes <out>/job.config.json then calls generate.mts (or generate + upload).
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  parsePhraseSetJson,
} from '../../../../utils/lineStickerPhraseSetFormat.ts';
import { DEFAULT_SKILL_STICKER_MODEL } from '../../../../utils/constants.ts';
import {
  defaultTitleZhFromPhraseSet,
  suggestDescZh,
  suggestSetNameEn,
} from '../../../../utils/lineStickerSetNaming.ts';
import { DEFAULT_LINE_STICKER_SET_COUNT } from './sheetPlan.ts';
import { resolveUploadConfig } from './uploadConfig.mts';
import { loadCredentials } from './uploadCredentials.mts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../../../..');

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function run(cmd: string, cmdArgs: string[]): void {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(' ')} exited with ${result.status ?? 'unknown'}`);
  }
}

function slugSetName(name: string): string {
  return name.replace(/[^\w]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const imageArg = args.image;
  const image2Arg = args.image2;
  const phraseSetArg = args['phrase-set'];
  const outArg = args.out;
  const jobArg = args.job;
  const dryRun = Boolean(args['dry-run']);
  const upload = Boolean(args.upload);

  if (!outArg || typeof outArg !== 'string') {
    throw new Error('Missing --out <output-dir>');
  }
  if (!jobArg && (!imageArg || !phraseSetArg)) {
    throw new Error(
      'Provide --image <path> and --phrase-set <path>, or --job <existing-config.json>'
    );
  }

  const outDir = resolve(ROOT, outArg);
  await mkdir(outDir, { recursive: true });

  let configPath: string;
  if (jobArg && typeof jobArg === 'string') {
    configPath = resolve(ROOT, jobArg);
    if (!existsSync(configPath)) {
      throw new Error(`Job config not found: ${jobArg}`);
    }
  } else {
    const imagePath = resolve(ROOT, imageArg as string);
    const phraseSetPath = resolve(ROOT, phraseSetArg as string);
    if (!existsSync(imagePath)) {
      throw new Error(`Reference image not found: ${imageArg}`);
    }
    if (!existsSync(phraseSetPath)) {
      throw new Error(`Phrase set not found: ${phraseSetArg}`);
    }

    const phraseSetRaw = await readFile(phraseSetPath, 'utf8');
    const phraseSet = parsePhraseSetJson(phraseSetRaw);
    if (!phraseSet) {
      throw new Error(`Invalid phrase-set JSON (expected format line-sticker-phrase-set v1): ${phraseSetArg}`);
    }

    const phraseSetOut = resolve(outDir, 'phrase-set.json');
    await copyFile(phraseSetPath, phraseSetOut);

    const imageExt = imagePath.match(/\.(png|jpe?g|webp)$/i)?.[0] ?? '.png';
    const imageOut = resolve(outDir, `reference-image${imageExt}`);
    await copyFile(imagePath, imageOut);

    let referenceImage2: string | undefined;
    if (image2Arg && typeof image2Arg === 'string') {
      const image2Path = resolve(ROOT, image2Arg);
      if (!existsSync(image2Path)) {
        throw new Error(`Second reference image not found: ${image2Arg}`);
      }
      const image2Ext = image2Path.match(/\.(png|jpe?g|webp)$/i)?.[0] ?? '.png';
      const image2Out = resolve(outDir, `reference-image-2${image2Ext}`);
      await copyFile(image2Path, image2Out);
      referenceImage2 = basename(image2Out);
    }

    const titleZh =
      typeof args['title-zh'] === 'string' && args['title-zh'].trim()
        ? args['title-zh'].trim()
        : defaultTitleZhFromPhraseSet(phraseSet.name, phraseSet.phrases);
    const setName =
      typeof args['set-name'] === 'string' && args['set-name'].trim()
        ? args['set-name'].trim()
        : suggestSetNameEn({
            titleZh,
            themeKey: 'daily',
            voiceKey: 'nishimura',
          });
    const titleEn =
      typeof args['title-en'] === 'string' && args['title-en'].trim()
        ? args['title-en'].trim()
        : setName;
    const descZh =
      typeof args['desc-zh'] === 'string'
        ? args['desc-zh']
        : suggestDescZh(titleZh);
    const descEn =
      typeof args['desc-en'] === 'string'
        ? args['desc-en']
        : `${titleEn} sticker set`;

    const scope = phraseSet.mode === 'single' ? 'single' : 'set';
    const nonEmptyPhrases = phraseSet.phrases.filter((p) => p.trim().length > 0).length;
    const stickerCount =
      scope === 'set'
        ? nonEmptyPhrases <= 32
          ? 32
          : nonEmptyPhrases <= 40
            ? DEFAULT_LINE_STICKER_SET_COUNT
            : 48
        : undefined;

    const job = {
      referenceImage: basename(imageOut),
      ...(referenceImage2 ? { referenceImage2 } : {}),
      ...(referenceImage2
        ? {
            characterDescription:
              '雙角色情侶貼圖。第一張參考圖為慵懶柴犬，第二張為慵懶哈士奇。依各格 action description 決定出現哪一隻或兩隻同框。',
          }
        : {}),
      phraseSetFile: 'phrase-set.json',
      style: 'matchUploaded',
      language: 'zh-TW',
      chromaKeyColor: 'green',
      includeText: true,
      textRendering: 'model',
      scope,
      ...(scope === 'set' ? { stickerCount } : {}),
      ...(scope === 'single'
        ? { cols: phraseSet.gridCols ?? 4, rows: phraseSet.gridRows ?? 5 }
        : {}),
      model: DEFAULT_SKILL_STICKER_MODEL,
      resolution: '1K',
      lineUpload: scope === 'set',
      mainStickerIndex: 1,
      tabStickerIndex: 1,
      maxSheetRetries: 3,
      minGridAlignmentScore: 0.8,
      promptVersion: 'v3compact',
      upload: {
        syncToUploadRoot: true,
        creatorId: '706',
        setName,
        titleZh,
        descZh,
        titleEn,
        descEn,
        writeEnvBatch: true,
      },
    };

    configPath = resolve(outDir, 'job.config.json');
    await writeFile(configPath, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${relative(ROOT, configPath)}`);
    console.log(`  image: ${basename(imagePath)}`);
    if (referenceImage2) {
      console.log(`  image2: ${referenceImage2}`);
    }
    console.log(`  phrases: ${phraseSet.phrases.length} (${phraseSet.mode})`);
    console.log(`  set: ${setName}`);
    console.log(`  titleZh: ${titleZh}`);
  }

  const configRel = relative(ROOT, configPath);
  const outRel = relative(ROOT, outDir);
  const generateArgs = [
    'tsx',
    '.claude/skills/line-sticker-maker/scripts/generate.mts',
    '--config',
    configRel,
    '--out',
    outRel,
  ];
  if (dryRun) {
    generateArgs.push('--dry-run');
  }

  console.log(`\n▶ ${dryRun ? 'dry-run' : 'generate'}...`);
  run('npx', generateArgs);

  if (upload && !dryRun) {
    await loadCredentials();
    const job = JSON.parse(await readFile(configPath, 'utf8')) as {
      upload?: { setName?: string };
      lineS?: { setName?: string };
    };
    const uploadConfig = resolveUploadConfig(job);
    const setName = uploadConfig?.setName;
    if (!setName) {
      throw new Error('Upload requires upload.setName in job config');
    }
    const envBase = slugSetName(setName);
    const envRel = `${outRel.replace(/\\/g, '/')}/.env.batch/${envBase}.env`;
    console.log('\n▶ upload...');
    run('npx', [
      'tsx',
      '.claude/skills/line-sticker-maker/scripts/run-line-upload.mts',
      '--env',
      envRel,
    ]);
  }

  if (!dryRun) {
    console.log(`\n✓ Output: ${outRel}`);
    console.log(`  stickers/: flat PNGs`);
    console.log(`  manifest.json`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
