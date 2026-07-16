/**
 * Encode character reference images as WebP for line-sticker-vault storage.
 */

import { existsSync } from 'node:fs';
import { copyFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

/** ponytail: quality 90 — lossy but fine for archive; pipeline reads vault copy in output/. */
export const VAULT_CHARACTER_REF_WEBP_QUALITY = 90;

const LEGACY_VAULT_REF_FILENAMES = ['character-ref.png', 'character-ref.jpg', 'character-ref.jpeg'];

export async function removeLegacyVaultCharacterRefs(charDir: string): Promise<void> {
  for (const name of LEGACY_VAULT_REF_FILENAMES) {
    const legacyPath = join(charDir, name);
    if (existsSync(legacyPath)) {
      await unlink(legacyPath);
    }
  }
}

export async function writeVaultCharacterRef(sourceAbs: string, destWebpAbs: string): Promise<void> {
  if (sourceAbs.toLowerCase().endsWith('.webp')) {
    await copyFile(sourceAbs, destWebpAbs);
  } else {
    const sharp = (await import('sharp')).default;
    await sharp(sourceAbs).webp({ quality: VAULT_CHARACTER_REF_WEBP_QUALITY }).toFile(destWebpAbs);
  }
  await removeLegacyVaultCharacterRefs(join(destWebpAbs, '..'));
}
