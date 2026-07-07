/**
 * Compatibility wrapper around the repo-local upload-root sync.
 */

import { main } from './sync-upload-input.mts';

const isCli = process.argv[1]?.includes('sync-line-upload-input');
if (isCli) {
  main().catch((err) => {
    console.error('✗', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
