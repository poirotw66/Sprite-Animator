import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '', '.css', '.env', '.html', '.js', '.json', '.jsx', '.md', '.mts',
  '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);

const SECRET_PATTERNS = [
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Hugging Face token', pattern: /hf_[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI API key', pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/ },
] as const;

function listRepositoryFiles(): string[] {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Unable to list repository files.');
  }
  return result.stdout.split('\0').filter(Boolean);
}

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

function scanFile(path: string): string[] {
  if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) return [];
  const source = readFileSync(path, 'utf8');
  return SECRET_PATTERNS
    .filter(({ pattern }) => pattern.test(source))
    .map(({ name }) => name);
}

const projectRoot = process.cwd();
const includeDist = process.argv.includes('--include-dist');
const candidates = listRepositoryFiles().map((path) => resolve(projectRoot, path));
if (includeDist) candidates.push(...listFilesRecursively(resolve(projectRoot, 'dist')));

const findings = candidates.flatMap((path) =>
  scanFile(path).map((secretType) => ({
    path: relative(projectRoot, path),
    secretType,
  })),
);

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`[secrets] ${finding.secretType} detected in ${finding.path}`);
  }
  process.exit(1);
}

console.log(
  `[secrets] No recognized API credentials found in repository files${
    includeDist ? ' or production output' : ''
  }.`,
);
