/**
 * Skill wrapper — re-exports character ref generation as Uint8Array for CLI scripts.
 */

import {
  generateCharacterRefImage as generateCharacterRefImageDataUrl,
  type GenerateCharacterRefParams,
} from '../../../../services/gemini/characterRefImage.ts';

export type { GenerateCharacterRefParams };

export async function generateCharacterRefImage(
  params: GenerateCharacterRefParams
): Promise<Uint8Array> {
  const dataUrl = await generateCharacterRefImageDataUrl(params);
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}
