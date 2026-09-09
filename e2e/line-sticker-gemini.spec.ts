import { expect, test, type Page, type Route } from '@playwright/test';

/** 1×1 PNG used as mocked Gemini sprite-sheet output. */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const FAKE_API_KEY = 'AIzaSyE2E_MOCK_LINE_STICKER_E2E_00000000';

function phraseLines(count: number): string {
  return Array.from({ length: count }, (_, index) => `- phrase-${index + 1}`).join('\n');
}

async function mockGeminiApis(page: Page): Promise<void> {
  await page.route(/generativelanguage\.googleapis\.com|\.googleapis\.com\/v1beta/, async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (method === 'GET' && /models/i.test(url) && !/generateContent|streamGenerateContent/i.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [{ name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' }],
        }),
      });
      return;
    }

    if (method === 'POST' && /generateContent|streamGenerateContent/i.test(url)) {
      const postData = request.postData() ?? '';
      const isPhraseRequest = /sticker slots|LINE sticker copywriter|\[無字\]|action description/i.test(postData);

      if (isPhraseRequest) {
        const countMatch = postData.match(/exactly \*\*(\d+)\*\*/i);
        const count = countMatch ? Number(countMatch[1]) : 16;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            candidates: [{
              content: { parts: [{ text: phraseLines(count) }] },
              finishReason: 'STOP',
            }],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: TINY_PNG_BASE64 } }],
            },
            finishReason: 'STOP',
          }],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [] }),
    });
  });
}

async function saveApiKey(page: Page): Promise<void> {
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox').first().fill(FAKE_API_KEY);
  await page.getByRole('button', { name: /Save and apply|儲存並套用|Save|儲存|Apply/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 20_000 });
}

test.setTimeout(90_000);

test('line sticker mocked Gemini phrase then generate updates the workspace', async ({ page }) => {
  const apiHits: string[] = [];
  page.on('request', (request) => {
    if (/generativelanguage\.googleapis\.com|googleapis\.com\/v1beta/i.test(request.url())) {
      apiHits.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on('pageerror', (error) => {
    console.log('PAGEERROR', error.message);
  });

  await mockGeminiApis(page);
  await page.goto('/#/line-sticker');
  await saveApiKey(page);

  await page.getByTestId('line-sticker-character-upload').setInputFiles({
    name: 'character.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
  });

  await page.getByTestId('line-sticker-generate-phrases').click();
  await expect(page.getByLabel('Cell 1 phrase')).not.toHaveValue('', { timeout: 30_000 });
  expect(apiHits.some((hit) => /generateContent/i.test(hit))).toBe(true);

  await page.getByRole('button', { name: /產生提示詞|Generate prompt|prompt/i }).first().click();

  const generateButton = page.getByTestId('line-sticker-generate');
  await expect(generateButton).toBeEnabled({ timeout: 20_000 });
  await generateButton.click();

  await expect(
    page.locator('#line-sticker-result img').first(),
  ).toBeVisible({ timeout: 90_000 });
});
