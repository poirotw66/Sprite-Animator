import { describe, expect, it } from 'vitest';
import viteConfig from './vite.config';

async function resolveConfig(command: 'serve' | 'build') {
  if (typeof viteConfig === 'function') {
    return viteConfig({
      command,
      mode: 'production',
      isSsrBuild: false,
      isPreview: false,
    });
  }

  return viteConfig;
}

describe('Vite security defaults', () => {
  it('does not configure a Gemini key fallback for browser builds', async () => {
    const config = await resolveConfig('build');

    expect(
      config.define?.['import.meta.env.LOCAL_DEV_GEMINI_API_KEY'],
    ).toBe('""');
  });

  it('binds the development server to localhost by default', async () => {
    const config = await resolveConfig('serve');

    expect(config.server?.host).toBe('localhost');
  });
});
