import { expect, test, type Page, type Route } from '@playwright/test';
import sharp from 'sharp';
import { en } from '../i18n/en';

test.use({ locale: 'en-US' });

const SOURCE_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="20" fill="#38bdf8"/></svg>');

async function prepareGeneration(page: Page) {
  const requests: Route[] = [];
  const sheet = await sharp({ create: { width: 300, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
  const image = `data:image/png;base64,${sheet.toString('base64')}`;
  await page.addInitScript(() => {
    sessionStorage.setItem('gemini_api_key', 'mock-animation-cancellation-key');
    localStorage.setItem('sprite_animator_language', 'en');
  });
  // This deliberately non-cooperative service ignores AbortSignal. The UI must
  // still reject its late result, progress, error, and finally callbacks.
  await page.route(/\/services\/gemini\/spriteSheet\.ts(?:\?.*)?$/, (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function generateSpriteSheet(...args) {
      try {
        const response = await fetch('/__animation_fixture');
        const payload = await response.json();
        args[6]?.('Late fixture progress');
        if (payload.error) throw new Error(payload.error);
        return payload.image;
      } finally {
        window.animationFixtureCompletions = (window.animationFixtureCompletions || 0) + 1;
      }
    }`,
  }));
  await page.route('**/__animation_fixture', (route) => { requests.push(route); });
  await page.route(/googleapis\.com|openrouter\.ai/, (route) => route.abort());
  await page.goto('/#/');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByTestId('image-upload-input').setInputFiles({ name: 'character.svg', mimeType: 'image/svg+xml', buffer: SOURCE_SVG });
  await expect(page.getByAltText('Uploaded character')).toBeVisible();
  await page.getByLabel(en.promptLabel).fill('happy bounce');

  const start = async (count: number) => {
    await page.getByRole('button', { name: en.generateSpriteSheet, exact: true }).click();
    await expect.poll(() => requests.length).toBe(count);
    await expect(page.getByTestId('cancel-animation-generation')).toBeVisible();
  };
  const finish = async (index: number, error?: string) => {
    await requests[index]!.fulfill({ contentType: 'application/json', body: JSON.stringify(error ? { error } : { image }) });
    await page.waitForFunction((count) => (window as Window & { animationFixtureCompletions?: number }).animationFixtureCompletions === count, index + 1);
  };
  return { requests, start, finish, image };
}

for (const action of ['cancel', 'reset', 'replace', 'mode', 'prompt'] as const) {
  test(`late animation result stays discarded after ${action}`, async ({ page }) => {
    const { start, finish } = await prepareGeneration(page);
    await start(1);
    if (action === 'cancel') await page.getByTestId('cancel-animation-generation').click();
    if (action === 'reset') await page.getByRole('button', { name: en.reset, exact: true }).first().click();
    if (action === 'replace') {
      await page.getByTestId('image-upload-input').setInputFiles({ name: 'replacement.svg', mimeType: 'image/svg+xml', buffer: SOURCE_SVG });
    }
    if (action === 'mode') await page.getByRole('button', { name: en.frameByFrameMode, exact: true }).click();
    if (action === 'prompt') await page.getByLabel(en.promptLabel).fill('new animation prompt');
    await expect(page.getByTestId('cancel-animation-generation')).toBeHidden();
    await finish(0);
    await expect(page.getByAltText('Sprite Sheet', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: en.previewArea, exact: true })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('late failure from an old request cannot stop or fail a newer generation', async ({ page }) => {
  const { start, finish } = await prepareGeneration(page);
  await start(1);
  await page.getByTestId('cancel-animation-generation').click();
  await start(2);
  await finish(0, 'Old request failed');
  await expect(page.getByTestId('cancel-animation-generation')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await finish(1);
  await expect(page.getByTestId('cancel-animation-generation')).toBeHidden();
  await expect(page.getByAltText('Sprite Sheet', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: en.previewArea, exact: true })).toBeVisible();
});

test('navigation discards an old generation before the workspace is reopened', async ({ page }) => {
  const { start, finish } = await prepareGeneration(page);
  await start(1);
  await page.getByRole('link', { name: en.backToHome, exact: true }).click();
  await expect(page).toHaveURL(/#\/studio$/);
  await finish(0);
  await page.getByRole('link', { name: new RegExp(en.openSpriteAnimator) }).click();
  await expect(page.getByTestId('cancel-animation-generation')).toBeHidden();
  await expect(page.getByAltText('Sprite Sheet', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('reset rejects a late local chroma result after the remote image has completed', async ({ page }) => {
  let chromaRequest: Route | undefined;
  await page.route(/\/utils\/chromaKeyProcessor\.ts(?:\?.*)?$/, (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function removeChromaKeyWithWorker() {
      const response = await fetch('/__chroma_fixture');
      const payload = await response.json();
      window.chromaFixtureCompleted = true;
      return payload.image;
    }`,
  }));
  await page.route('**/__chroma_fixture', (route) => { chromaRequest = route; });
  const { start, finish, image } = await prepareGeneration(page);
  await start(1);
  await finish(0);
  await expect.poll(() => Boolean(chromaRequest)).toBe(true);
  await page.getByRole('button', { name: en.reset, exact: true }).first().click();
  await chromaRequest!.fulfill({ contentType: 'application/json', body: JSON.stringify({ image }) });
  await page.waitForFunction(() => (window as Window & { chromaFixtureCompleted?: boolean }).chromaFixtureCompleted);
  await expect(page.getByAltText('Sprite Sheet', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: en.previewArea, exact: true })).toHaveCount(0);
});
