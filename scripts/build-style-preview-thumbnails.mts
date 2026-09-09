import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const projectRoot = process.cwd();
/** Source PNGs live outside public/ so Vite does not ship them in dist. */
const previewSourceDir = join(projectRoot, 'assets', 'style-preview-sources');
const previewOutputDir = join(projectRoot, 'public', 'style-preview-thumbnails');
const fontSourcePath = join(projectRoot, 'assets', 'font.png');
const checkOnly = process.argv.includes('--check');

interface OutputAsset {
  path: string;
  contents: Buffer;
}

async function buildAssets(): Promise<OutputAsset[]> {
  const previewFiles = (await readdir(previewSourceDir))
    .filter((file) => file.toLowerCase().endsWith('.png'))
    .sort();

  const previews = await Promise.all(previewFiles.map(async (file) => ({
    path: join(previewOutputDir, `${basename(file, '.png')}.webp`),
    contents: await sharp(join(previewSourceDir, file))
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78, effort: 5 })
      .toBuffer(),
  })));

  const font = {
    path: join(projectRoot, 'public', 'font.webp'),
    contents: await sharp(fontSourcePath)
      .resize({ width: 1024, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toBuffer(),
  };

  return [...previews, font];
}

const assets = await buildAssets();

if (checkOnly) {
  const stale: string[] = [];
  for (const asset of assets) {
    try {
      const current = await readFile(asset.path);
      if (!current.equals(asset.contents)) stale.push(asset.path);
    } catch {
      stale.push(asset.path);
    }
  }
  if (stale.length > 0) {
    for (const path of stale) console.error(`[previews] Missing or stale: ${path}`);
    console.error('[previews] Run npm run previews:build and commit the generated assets.');
    process.exit(1);
  }
  console.log(`[previews] ${assets.length} generated WebP assets are current.`);
} else {
  await mkdir(previewOutputDir, { recursive: true });
  await Promise.all(assets.map((asset) => writeFile(asset.path, asset.contents)));
  console.log(`[previews] Wrote ${assets.length} optimized WebP assets.`);
}
