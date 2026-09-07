import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/sprite-animation',
  '/line-sticker',
  '/one-page-comic',
  '/rmbg',
  '/parting',
  '/daily-sticker-registry',
] as const;

for (const route of routes) {
  test(`${route} renders after direct navigation`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto(`/#${route}`);

    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page).toHaveURL(new RegExp(`#${route === '/' ? '/?$' : `${route}$`}`));
    expect(pageErrors).toEqual([]);
  });
}

test('parting uploads, slices, selects, and exports frames without Gemini', async ({ page }) => {
  await page.goto('/#/parting');
  // Fresh sessions prompt for an optional API key; this local flow does not need one.
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  // An inline SVG keeps this flow fully local while still exercising browser image decoding.
  await page.getByTestId('image-upload-input').setInputFiles({
    name: 'sprite-sheet.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#fff"/><circle cx="50" cy="50" r="30" fill="#f97316"/><circle cx="150" cy="50" r="30" fill="#14b8a6"/><circle cx="250" cy="50" r="30" fill="#3b82f6"/><rect x="20" y="120" width="60" height="60" fill="#f97316"/><rect x="120" y="120" width="60" height="60" fill="#14b8a6"/><rect x="220" y="120" width="60" height="60" fill="#3b82f6"/></svg>'
    ),
  });

  // The option appears after upload; disable it before asserting sliced output.
  await page.getByTestId('parting-remove-background').uncheck();
  const frames = page.getByTestId('frame-grid').locator('img[alt^="Frame "]');
  await expect(frames).toHaveCount(6);

  const firstFrame = page.getByTestId('frame-include-0');
  await firstFrame.uncheck();
  await expect(firstFrame).not.toBeChecked();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('parting-download-selected').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^line_stickers_\d+\.zip$/);
});
