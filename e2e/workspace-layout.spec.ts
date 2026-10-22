import { expect, test } from '@playwright/test';
import { zhTW } from '../i18n/zh-TW';

const toolRoutes = ['/', '/line-sticker', '/parting', '/rmbg', '/one-page-comic', '/daily-sticker-registry'];
test.use({ locale: 'zh-TW' });

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const language of ['zh-TW', 'en']) {
    test(`workspace layout at ${width}px in ${language}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of toolRoutes) {
        await page.goto(`/#${route}`);
        await expect(page.locator('header h1')).toBeVisible();
        if (await page.getByRole('dialog').isVisible()) {
          await page.keyboard.press('Escape');
        }
        await page.locator('header select').selectOption(language);
        const header = page.locator('header');
        const bounds = await header.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        if (width >= 1024) expect(bounds!.height).toBeLessThanOrEqual(80);

        const controls = await header.locator('button:visible, select:visible, a:visible').all();
        for (const control of controls) {
          const box = await control.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
        const contentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(contentWidth).toBeLessThanOrEqual(width);
        if (language === 'zh-TW' && [390, 1440].includes(width) && route === '/') {
          await page.screenshot({ path: testInfo.outputPath('workspace.png') });
        }
      }

      await page.goto('/#/studio');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (language === 'zh-TW' && width === 1440) {
        await page.screenshot({ path: testInfo.outputPath('studio.png') });
      }
    });
  }
}

for (const width of [320, 390]) {
  test(`mobile result navigation preserves the active tool at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const [route, target, label] of [['/', 'animation-results', zhTW.previewTitle], ['/line-sticker', 'line-sticker-result', zhTW.lineStickerJumpToResult]]) {
      await page.goto(`/#${route}`);
      await expect(page.locator('header h1')).toBeVisible();
      if (await page.getByRole('dialog').isVisible()) await page.keyboard.press('Escape');
      const url = page.url();
      await page.locator('header').getByRole('button', { name: label, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(page.locator(`#${target}`)).toBeFocused();
      const resultBox = await page.locator(`#${target}`).boundingBox();
      const headerBox = await page.locator('header').boundingBox();
      expect(resultBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
      expect(resultBox!.y).toBeLessThan(844);
    }
  });
}

test('settings keeps close and save actions visible on a short mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (const name of ['設定', '儲存並應用']) {
    const box = await dialog.getByRole('button', { name, exact: true }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(568);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
