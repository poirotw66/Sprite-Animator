/**
 * Backward-compatible wrapper. Prefer `organize-line-upload-input.mts`.
 */

export * from './organize-line-upload-input.mts';
import { main } from './organize-line-upload-input.mts';

const isCli = process.argv[1]?.includes('organize-line-s-input');
if (isCli) {
  main().catch((err) => {
    console.error('✗', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
