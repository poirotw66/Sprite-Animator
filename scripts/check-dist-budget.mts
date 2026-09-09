/**
 * Fail CI when production dist ships build-only preview PNG sources
 * or balloons past a tracked size budget.
 *
 * Usage:
 *   npm run build
 *   npm run dist:budget
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const distRoot = resolve(projectRoot, 'dist');

/** Soft ceiling for the whole dist tree (MiB). WASM alone is ~23 MiB. */
const MAX_DIST_MIB = 40;
/** Runtime preview WebPs should stay small; PNG sources must not land here. */
const MAX_RUNTIME_PREVIEW_MIB = 3;

function listFilesRecursively(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) files.push(...listFilesRecursively(path));
    else files.push(path);
  }
  return files;
}

function totalBytes(paths: string[]): number {
  return paths.reduce((sum, path) => sum + statSync(path).size, 0);
}

function mib(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

if (!existsSync(distRoot)) {
  console.error('[dist:budget] dist/ is missing. Run npm run build first.');
  process.exit(1);
}

const failures: string[] = [];
const allFiles = listFilesRecursively(distRoot);

const forbiddenPaths = [
  join(distRoot, 'style-previews'),
  join(distRoot, 'font.png'),
];
for (const path of forbiddenPaths) {
  if (existsSync(path)) {
    failures.push(`Forbidden production asset present: ${relative(projectRoot, path)}`);
  }
}

const leakedPngs = allFiles.filter((path) => {
  const rel = relative(distRoot, path).replaceAll('\\', '/');
  return (
    rel === 'font.png'
    || rel.startsWith('style-previews/')
    || /^style-previews[/\\]/i.test(rel)
  );
});
for (const path of leakedPngs) {
  failures.push(`Build-only PNG leaked into dist: ${relative(projectRoot, path)}`);
}

const runtimePreviewFiles = allFiles.filter((path) => {
  const rel = relative(distRoot, path).replaceAll('\\', '/');
  return rel === 'font.webp' || rel.startsWith('style-preview-thumbnails/');
});
const runtimePreviewBytes = totalBytes(runtimePreviewFiles);
if (runtimePreviewBytes > MAX_RUNTIME_PREVIEW_MIB * 1024 * 1024) {
  failures.push(
    `Runtime preview assets are ${mib(runtimePreviewBytes)} (budget ${MAX_RUNTIME_PREVIEW_MIB} MiB).`,
  );
}

const distBytes = totalBytes(allFiles);
if (distBytes > MAX_DIST_MIB * 1024 * 1024) {
  failures.push(`dist/ is ${mib(distBytes)} (budget ${MAX_DIST_MIB} MiB).`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[dist:budget] ${failure}`);
  process.exit(1);
}

console.log(
  `[dist:budget] OK — dist ${mib(distBytes)}; runtime previews ${mib(runtimePreviewBytes)} `
  + `(${runtimePreviewFiles.length} files); no style-preview PNG sources.`,
);
