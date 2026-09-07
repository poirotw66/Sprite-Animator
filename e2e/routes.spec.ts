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
