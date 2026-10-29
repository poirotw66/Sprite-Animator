/** Read-only checks for canonical skill links and importable phrase examples. */
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePhraseSetJson } from '../../utils/lineStickerPhraseSetFormat.ts';
import { cliBoolean, parseCliArgs, printCliHelp, reportCliError } from './cli.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = 'Usage: check-skill-contracts.mts [--help]';
const WORKFLOW_DOCUMENTS = [
  'docs/workflows/line-sticker-pipeline.md',
  'docs/workflows/line-sticker-daily-factory.md',
  'docs/workflows/sheet-converter-v2.md',
] as const;
const PHRASE_EXAMPLE = 'skills/line-sticker-phrase-design/example/daily-set-40.json';

export interface SkillContractOptions {
  root?: string;
  markdownPaths?: string[];
  phraseExamplePaths?: string[];
  importDocumentPaths?: string[];
}

export interface SkillContractReport {
  markdownFiles: number;
  phraseExamples: number;
  errors: string[];
}

interface MarkdownParts {
  prose: string;
  jsonBlocks: string[];
}

/** Ignore links in code examples, while retaining explicit JSON example blocks. */
function splitMarkdown(markdown: string): MarkdownParts {
  const prose: string[] = [];
  const jsonBlocks: string[] = [];
  let fence: { marker: string; length: number; json: boolean } | undefined;
  let block: string[] = [];
  for (const line of markdown.split(/\r?\n/u)) {
    const match = /^\s{0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    if (!fence && match) {
      fence = { marker: match[1][0], length: match[1].length, json: match[2].trim() === 'json' };
      block = [];
    } else if (fence) {
      if (match && match[1][0] === fence.marker && match[1].length >= fence.length && !match[2].trim()) {
        if (fence.json) jsonBlocks.push(block.join('\n'));
        fence = undefined;
      } else {
        block.push(line);
      }
    } else {
      prose.push(line.replace(/`+[^`]*`+/gu, ''));
    }
  }
  return { prose: prose.join('\n'), jsonBlocks };
}

function markdownTargets(prose: string): string[] {
  const targets: string[] = [];
  // Support inline/image links and reference definitions; external URLs are filtered below.
  const inline = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+['"][^\n]*['"])?\s*\)/gu;
  const definitions = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gmu;
  for (const pattern of [inline, definitions]) {
    for (const match of prose.matchAll(pattern)) targets.push(match[1] ?? match[2]);
  }
  return targets;
}

function undefinedReferences(prose: string): string[] {
  const normalize = (label: string) => label.trim().replace(/\s+/gu, ' ').toLowerCase();
  const definitions = new Set(
    [...prose.matchAll(/^\s{0,3}\[([^\]]+)\]:/gmu)].map((match) => normalize(match[1])),
  );
  const missing = new Set<string>();
  // Explicit [label][id] and collapsed [label][] links have a clear target.
  // Standalone [words] can be ordinary prose and are not treated as broken links.
  for (const match of prose.matchAll(/!?\[([^\]]+)\]\[([^\]]*)\]/gu)) {
    const label = match[2] || match[1];
    if (!definitions.has(normalize(label))) missing.add(label);
  }
  return [...missing];
}

async function listMarkdown(directory: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await listMarkdown(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) paths.push(path);
  }
  return paths.sort();
}

/** No network requests or image-generation scripts are executed by this check. */
export async function checkSkillContracts(options: SkillContractOptions = {}): Promise<SkillContractReport> {
  const root = resolve(options.root ?? ROOT);
  const markdownPaths = options.markdownPaths?.map((path) => resolve(root, path)) ?? [
    ...await listMarkdown(resolve(root, 'skills')),
    ...WORKFLOW_DOCUMENTS.map((path) => resolve(root, path)),
  ];
  const importDocuments = new Set(
    (options.importDocumentPaths ?? ['docs/workflows/line-sticker-pipeline.md'])
      .map((path) => resolve(root, path)),
  );
  const phraseExamples = new Set(
    (options.phraseExamplePaths ?? [PHRASE_EXAMPLE]).map((path) => resolve(root, path)),
  );
  const report: SkillContractReport = { markdownFiles: markdownPaths.length, phraseExamples: 0, errors: [] };

  for (const path of markdownPaths) {
    let markdown: string;
    try {
      markdown = await readFile(path, 'utf8');
    } catch {
      report.errors.push(`Cannot read Markdown: ${path}`);
      continue;
    }
    const { prose, jsonBlocks } = splitMarkdown(markdown);
    for (const label of undefinedReferences(prose)) {
      report.errors.push(`Undefined Markdown reference in ${path}: ${label}`);
    }
    for (const target of markdownTargets(prose)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu.test(target)) continue;
      const localTarget = target.split(/[?#]/u)[0];
      if (!localTarget) continue;
      try {
        const linkedPath = resolve(dirname(path), decodeURIComponent(localTarget));
        await stat(linkedPath);
      } catch {
        report.errors.push(`Missing local link in ${path}: ${target}`);
        continue;
      }
    }

    // Only importer docs promise full production inputs. Conversational 20-cell
    // plans in specialized skills intentionally use a different handoff contract.
    if (importDocuments.has(path)) {
      for (const [index, json] of jsonBlocks.entries()) {
        let data: unknown;
        try {
          data = JSON.parse(json);
        } catch {
          report.errors.push(`Invalid JSON example in ${path}, block ${index + 1}`);
          continue;
        }
        if (data && typeof data === 'object' && 'format' in data && data.format === 'line-sticker-phrase-set') {
          report.phraseExamples++;
          if (!parsePhraseSetJson(json)) {
            report.errors.push(`Phrase example rejected by the importer in ${path}, block ${index + 1}`);
          }
        }
      }
    }
  }

  for (const path of phraseExamples) {
    report.phraseExamples++;
    try {
      if (!parsePhraseSetJson(await readFile(path, 'utf8'))) {
        report.errors.push(`Phrase example rejected by the importer: ${path}`);
      }
    } catch {
      report.errors.push(`Cannot read phrase example: ${path}`);
    }
  }
  return report;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2), { booleans: ['help'] });
  if (cliBoolean(args.help)) {
    printCliHelp(USAGE);
    return;
  }
  const report = await checkSkillContracts();
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  console.log(`Skill contracts passed: ${report.markdownFiles} Markdown files, ${report.phraseExamples} importable phrase examples.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => reportCliError(error, USAGE));
}
