import { describe, expect, it } from 'vitest';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { removeLegacyVaultCharacterRefs, VAULT_CHARACTER_REF_WEBP_QUALITY } from './vaultCharacterRef';
import { VAULT_CHARACTER_REF_FILENAME, characterRefVaultPath } from './stickerVault';

describe('vaultCharacterRef', () => {
  it('uses webp filename in vault paths', () => {
    expect(VAULT_CHARACTER_REF_FILENAME).toBe('character-ref.webp');
    expect(characterRefVaultPath('bloom-calico')).toBe('characters/bloom-calico/character-ref.webp');
  });

  it('uses a fixed webp quality constant', () => {
    expect(VAULT_CHARACTER_REF_WEBP_QUALITY).toBeGreaterThanOrEqual(85);
    expect(VAULT_CHARACTER_REF_WEBP_QUALITY).toBeLessThanOrEqual(100);
  });

  it('removes legacy png after writing webp copy', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vault-ref-'));
    const legacy = join(dir, 'character-ref.png');
    const webp = join(dir, VAULT_CHARACTER_REF_FILENAME);
    await writeFile(legacy, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await writeFile(webp, Buffer.from('RIFF'));
    await removeLegacyVaultCharacterRefs(dir);
    await expect(readFile(legacy)).rejects.toThrow();
    await expect(readFile(webp)).resolves.toBeDefined();
  });
});
