import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryOperation } from './retry';

describe('retryOperation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns result immediately when operation succeeds', async () => {
    const result = await retryOperation(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('retries on quota-like errors and then succeeds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onStatusUpdate = vi.fn();
    let calls = 0;

    const result = await retryOperation(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error('429 RESOURCE_EXHAUSTED');
        }
        return 'done';
      },
      onStatusUpdate,
      5,
      0
    );

    expect(result).toBe('done');
    expect(calls).toBe(3);
    expect(onStatusUpdate).toHaveBeenCalledTimes(2);
  });

  it('throws immediately for non-quota errors', async () => {
    const operation = vi.fn(async () => {
      throw new Error('Unexpected parse failure');
    });

    await expect(retryOperation(operation, undefined, 5, 0)).rejects.toThrow(
      'Unexpected parse failure'
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('throws last error after exhausting retries', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let calls = 0;

    await expect(
      retryOperation(
        async () => {
          calls += 1;
          throw new Error('503 Overloaded');
        },
        undefined,
        3,
        0
      )
    ).rejects.toThrow('503 Overloaded');

    expect(calls).toBe(3);
  });
});
