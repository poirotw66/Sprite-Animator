import { expect, test, type Page, type Route } from '@playwright/test';
import sharp from 'sharp';

const FAKE_OPENROUTER_KEY = 'mock-openrouter-e2e-key';

const DEMO_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#38bdf8"/><circle cx="32" cy="28" r="14" fill="#0f172a"/></svg>',
);

async function mockOpenRouterApis(page: Page): Promise<string[]> {
  const hits: string[] = [];
  // Use a sheet large enough for the default 3-by-2 grid and real frame export.
  const sheet = await sharp({ create: { width: 300, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
  await page.route(/openrouter\.ai\/api\/v1\//, async (route: Route) => {
    const request = route.request();
    const url = request.url();
    hits.push(`${request.method()} ${url}`);

    if (request.method() === 'GET' && /\/models/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'google/gemini-2.5-flash-image' }] }),
      });
      return;
    }

    if (request.method() === 'POST' && /\/images(?:\?|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{ b64_json: sheet.toString('base64'), media_type: 'image/png' }],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: `Unhandled mock: ${url}` } }),
    });
  });
  return hits;
}

test('Settings can select OpenRouter and generate a sheet via mocked Image API', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const hits = await mockOpenRouterApis(page);

  await page.goto('/#/');
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByLabel(/Image provider|影像供應商/i).selectOption('openrouter');
  await page.getByLabel(/OpenRouter API Key/i).fill(FAKE_OPENROUTER_KEY);
  await page.getByRole('button', { name: /Save and apply|儲存並應用|Save & Apply/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 20_000 });

  await page.getByTestId('image-upload-input').setInputFiles({
    name: 'character.svg',
    mimeType: 'image/svg+xml',
    buffer: DEMO_SVG,
  });

  const prompt = page.locator('textarea').first();
  await prompt.fill('happy bounce walk cycle');

  const generateButton = page.getByRole('button', {
    name: /Generate Sprite Sheet|生成精靈圖/i,
  });
  await expect(generateButton).toBeEnabled({ timeout: 15_000 });
  await generateButton.click();

  await expect
    .poll(() => hits.some((hit) => /POST .*\/images/.test(hit)), { timeout: 30_000 })
    .toBe(true);

  expect(hits.some((hit) => /GET .*\/models/.test(hit))).toBe(true);

  const player = page.getByRole('button', { name: /Animation Preview Area|動畫預覽區域/i });
  await expect(player).toBeVisible();
  await player.scrollIntoViewIfNeeded();
  const playerBox = await player.boundingBox();
  for (const name of [/Download APNG|下載 APNG/i, /^GIF$/, /^ZIP$/, /^Aseprite JSON$/]) {
    const action = page.getByRole('button', { name });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(playerBox!.y + playerBox!.height);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await player.focus();
  await player.press('Space');
  await expect(player).toHaveAttribute('aria-pressed', 'false');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^ZIP$/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
});
