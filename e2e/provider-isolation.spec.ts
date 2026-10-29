import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { defaultModelForProvider } from '../services/imageProviders/models';

const GEMINI_KEY = 'mock-provider-isolation-gemini';
const OPENROUTER_KEY = 'mock-provider-isolation-openrouter';

test.use({ locale: 'en-US' });

async function seedLegacyOpenRouterSettings(page: Page) {
  await page.addInitScript(({ geminiKey, openRouterKey }) => {
    if (localStorage.getItem('provider-isolation-seeded')) return;
    localStorage.setItem('provider-isolation-seeded', 'yes');
    localStorage.setItem('image_provider', 'openrouter');
    localStorage.setItem('gemini_model', 'google/gemini-3-pro-image');
    localStorage.setItem('gemini_output_resolution', '4K');
    localStorage.setItem('gemini_style_preview_resolution', '2K');
    sessionStorage.setItem('gemini_api_key', geminiKey);
    sessionStorage.setItem('openrouter_api_key', openRouterKey);
  }, { geminiKey: GEMINI_KEY, openRouterKey: OPENROUTER_KEY });
}

async function mockProviders(page: Page) {
  const image = await sharp({ create: { width: 300, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
  const geminiRequests: { url: string; key: string; body: string }[] = [];
  let openRouterImageRequests = 0;
  await page.route(/openrouter\.ai\/api\/v1\//, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { data: [] } });
    } else {
      openRouterImageRequests++;
      await route.fulfill({ status: 400, json: { error: { message: 'Unexpected OpenRouter image request' } } });
    }
  });
  await page.route(/generativelanguage\.googleapis\.com/, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({ json: { models: [] } });
      return;
    }
    const body = request.postData() ?? '';
    geminiRequests.push({
      url: request.url(),
      key: request.headers()['x-goog-api-key'] ?? new URL(request.url()).searchParams.get('key') ?? '',
      body,
    });
    const phraseRequest = /sticker slots|LINE sticker copywriter|\[無字\]|action description/i.test(body);
    const count = Number(body.match(/exactly \*\*(\d+)\*\*/i)?.[1] ?? 16);
    await route.fulfill({
      json: {
        candidates: [{ content: { parts: phraseRequest
          ? [{ text: Array.from({ length: count }, (_, index) => `- phrase-${index + 1}`).join('\n') }]
          : [{ inlineData: { mimeType: 'image/png', data: image.toString('base64') } }],
        }, finishReason: 'STOP' }],
      },
    });
  });
  return { image, geminiRequests, openRouterImageRequests: () => openRouterImageRequests };
}

async function openSettings(page: Page) {
  await page.locator('header').getByRole('button', { name: /settings/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('provider profiles survive switching, Gemini-only settings, and reload', async ({ page }) => {
  await seedLegacyOpenRouterSettings(page);
  await mockProviders(page);
  await page.goto('/#/');
  await openSettings(page);
  const provider = page.getByLabel('Image provider', { exact: true });
  const model = page.getByLabel('Model Selection', { exact: true });
  await expect(provider).toHaveValue('openrouter');
  await expect(model).toHaveValue('google/gemini-3-pro-image');
  await provider.selectOption('gemini');
  await expect(model).toHaveValue(defaultModelForProvider('gemini'));
  await model.selectOption('gemini-3-pro-image');
  await page.getByRole('button', { name: '2K', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save & Apply', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await openSettings(page);
  await provider.selectOption('openrouter');
  await expect(model).toHaveValue('google/gemini-3-pro-image');
  await page.getByRole('button', { name: 'Save & Apply', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  for (const route of ['/line-sticker', '/one-page-comic']) {
    await page.goto(`/#${route}`);
    await openSettings(page);
    await expect(provider).toHaveValue('gemini');
    await expect(provider).toBeDisabled();
    await expect(model).toHaveValue('gemini-3-pro-image');
    await expect(page.getByLabel('Gemini API Key', { exact: true })).toHaveValue(GEMINI_KEY);
    await page.getByRole('button', { name: 'Save & Apply', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('image_provider'))).toBe('openrouter');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('image_provider_settings_v1_gemini')!).outputResolution)).toBe('2K');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('image_provider_settings_v1_openrouter')!).outputResolution)).toBe('4K');
  }

  await page.goto('/#/');
  await page.reload();
  await openSettings(page);
  await expect(provider).toHaveValue('openrouter');
  await expect(model).toHaveValue('google/gemini-3-pro-image');
  await expect(page.getByLabel('OpenRouter API Key', { exact: true })).toHaveValue(OPENROUTER_KEY);
});

for (const tool of ['line-sticker', 'one-page-comic']) {
  test(`${tool} requests Gemini credentials when only OpenRouter is configured`, async ({ page }) => {
    await seedLegacyOpenRouterSettings(page);
    await page.addInitScript(() => sessionStorage.removeItem('gemini_api_key'));
    await page.goto(`/#/${tool}`);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Image provider', { exact: true })).toHaveValue('gemini');
    await expect(page.getByLabel('Image provider', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Gemini API Key', { exact: true })).toHaveValue('');
    expect(await page.evaluate(() => localStorage.getItem('image_provider'))).toBe('openrouter');
  });

  test(`${tool} uses a Gemini key and model after animation selected OpenRouter`, async ({ page }) => {
    await seedLegacyOpenRouterSettings(page);
    const mocks = await mockProviders(page);
    await page.goto(`/#/${tool}`);
    await expect(page.locator('header h1')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
    if (tool === 'line-sticker') {
      await page.getByTestId('line-sticker-character-upload').setInputFiles({ name: 'character.png', mimeType: 'image/png', buffer: mocks.image });
      await page.getByTestId('line-sticker-generate-phrases').click();
      await expect(page.getByLabel('Cell 1 phrase')).not.toHaveValue('');
      await page.getByRole('button', { name: /Generate prompt/i }).first().click();
      await page.getByTestId('line-sticker-generate').click();
      await expect(page.locator('#line-sticker-result img').first()).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'Text concept', exact: true }).click();
      await page.getByLabel('Character concept', { exact: true }).fill('A friendly blue otter wearing a small apron.');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('button', { name: 'Generate character sheet', exact: true }).click();
      await expect(page.getByAltText('Generated character sheet preview')).toBeVisible();
    }
    expect(mocks.geminiRequests.length).toBeGreaterThan(0);
    for (const request of mocks.geminiRequests) {
      expect(request.key).toBe(GEMINI_KEY);
      expect(request.body).not.toContain(OPENROUTER_KEY);
      expect(request.url).not.toContain('models/google/');
    }
    expect(mocks.geminiRequests.some((request) => request.url.includes(`models/${defaultModelForProvider('gemini')}:`))).toBe(true);
    expect(mocks.openRouterImageRequests()).toBe(0);
  });
}
