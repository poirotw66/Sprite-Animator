/** Small, dependency-free CLI contract shared by LINE sticker entry points. */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export type CliArgs = Record<string, string | boolean>;

export function parseCliArgs(
  argv: string[],
  options: { values?: readonly string[]; booleans?: readonly string[] }
): CliArgs {
  const values = new Set(options.values ?? []);
  const booleans = new Set(options.booleans ?? []);
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new CliUsageError(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    if (!key || (!values.has(key) && !booleans.has(key))) {
      throw new CliUsageError(`Unknown option: ${token}`);
    }
    if (values.has(key)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new CliUsageError(`Option ${token} requires a value`);
      }
      args[key] = value;
      index++;
      continue;
    }

    const next = argv[index + 1];
    if (next === 'true' || next === 'false') {
      args[key] = next;
      index++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

/** Relative paths accepted by public CLIs are always rooted at the repository. */
export function cliBoolean(value: string | boolean | undefined): boolean {
  return value === true || value === 'true';
}

export function printCliHelp(usage: string): void {
  console.log(`${usage}\n\nPath contract: relative file paths are resolved from the repository root.`);
}

export function reportCliError(error: unknown, usage: string): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  if (error instanceof CliUsageError) {
    console.error(`\n${usage}`);
    process.exit(2);
  }
  process.exit(1);
}

export function requireCliValue(value: string | boolean | undefined, flag: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CliUsageError(`Missing ${flag} <value>`);
  }
  return value;
}
