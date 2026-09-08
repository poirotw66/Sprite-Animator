import { describe, expect, it } from 'vitest';
import { CliUsageError, cliBoolean, parseCliArgs } from './cli.mts';

describe('LINE sticker CLI contract', () => {
  const options = { values: ['out'], booleans: ['dry-run'] } as const;

  it('parses supported value and boolean flags', () => {
    expect(parseCliArgs(['--out', 'output/set', '--dry-run'], options)).toEqual({
      out: 'output/set',
      'dry-run': true,
    });
  });

  it('rejects unknown options and values that are missing', () => {
    expect(() => parseCliArgs(['--unknown'], options)).toThrow(CliUsageError);
    expect(() => parseCliArgs(['--out'], options)).toThrow(CliUsageError);
  });

  it('accepts explicit boolean strings without treating false as enabled', () => {
    const args = parseCliArgs(['--dry-run', 'false'], options);
    expect(cliBoolean(args['dry-run'])).toBe(false);
  });
});
