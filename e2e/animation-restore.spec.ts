import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { en } from '../i18n/en';
import { DEFAULT_CONFIG, DEFAULT_SLICE_SETTINGS } from '../utils/constants';
import type { SavedProject } from '../types';

test.use({ locale: 'en-US' });

async function sheetImage(color: string): Promise<string> {
  const cells = Array.from({ length: 6 }, (_, index) => {
    const x = (index % 3) * 100 + 30;
    const y = Math.floor(index / 3) * 100 + 20;
    return `<rect x="${x}" y="${y}" width="40" height="60" fill="${color}"/>`;
  }).join('');
  const image = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#00ff00"/>${cells}</svg>`)).png().toBuffer();
  return `data:image/png;base64,${image.toString('base64')}`;
}

function project(id: string, image: string): SavedProject {
  return {
    id, name: id, createdAt: Date.now(),
    config: { ...DEFAULT_CONFIG, prompt: id },
    sliceSettings: {
      ...DEFAULT_SLICE_SETTINGS,
      ...{ autoOptimized: { paddingX: true, paddingY: true, shiftX: true, shiftY: true } },
    },
    removeBackground: true,
    sourceImage: image,
    spriteSheetImage: image,
    frameModeFrames: [],
    frameOverrides: [],
    frameIncluded: Array(6).fill(true),
  };
}

async function seed(page: Page, projects: SavedProject[]) {
  await page.addInitScript((values) => {
    sessionStorage.setItem('gemini_api_key', 'mock-animation-restore-key');
    localStorage.setItem('sprite_animator_language', 'en');
    if (localStorage.getItem('animation-restore-seeded')) return;
    for (const value of values) localStorage.setItem(`sprite_animator_project_${value.id}`, JSON.stringify(value));
    localStorage.setItem('animation-restore-seeded', 'yes');
  }, projects);
  await page.route(/googleapis\.com|openrouter\.ai/, (route) => route.abort());
  await page.goto('/#/');
}

async function load(page: Page, name: string) {
  await page.getByRole('button', { name: en.projectHistory, exact: true }).click();
  const row = page.locator('header').getByText(name, { exact: true });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByTestId('frame-grid')).toBeVisible();
  await expect(page.getByLabel(en.projectNamePlaceholder)).toBeVisible();
  await expect(page.locator('main').getByRole('button', { name: en.saveProject, exact: true })).toBeEnabled();
}

async function openCropEditor(page: Page) {
  await page.getByRole('button', { name: '編輯第 1 幀', exact: true }).click();
  const editor = page.locator('div.fixed').filter({ has: page.getByRole('button', { name: '關閉', exact: true }) });
  await expect(editor).toBeVisible();
  return editor;
}

test('saved crop and exclusions survive reload, same-project restore, and a different sheet restore', async ({ page }) => {
  const first = project('sheet-original', await sheetImage('#e23d2f'));
  const second = project('sheet-alternative', await sheetImage('#2873c9'));
  second.createdAt -= 1;
  second.frameOverrides = [{ offsetX: -11, offsetY: 5, scale: 0.75 }];
  second.frameIncluded = [false, true]; // Missing entries must normalize to included.
  await seed(page, [first, second]);
  await load(page, first.name);
  const firstFrame = page.getByTestId('frame-grid').getByAltText('Frame 1', { exact: true });
  const originalFrame = await firstFrame.getAttribute('src');
  let editor = await openCropEditor(page);
  await editor.getByRole('spinbutton').nth(0).fill('13');
  await editor.getByRole('spinbutton').nth(1).fill('-7');
  await editor.getByRole('button', { name: '關閉', exact: true }).click();
  await expect(firstFrame).not.toHaveAttribute('src', originalFrame!);
  const editedFrame = await firstFrame.getAttribute('src');
  await page.getByTestId('frame-include-1').uncheck();
  await page.getByTestId('frame-include-4').uncheck();
  await page.getByLabel(en.projectNamePlaceholder).fill('saved-crop');
  await page.locator('main').getByRole('button', { name: en.saveProject, exact: true }).click();
  await expect(page.getByLabel(en.projectNamePlaceholder)).toHaveValue('');

  await page.reload();
  await load(page, 'saved-crop');
  await expect(firstFrame).toHaveAttribute('src', editedFrame!);
  await expect(page.getByTestId('frame-include-1')).not.toBeChecked();
  await expect(page.getByTestId('frame-include-4')).not.toBeChecked();
  editor = await openCropEditor(page);
  await expect(editor.getByRole('spinbutton').nth(0)).toHaveValue('13');
  await expect(editor.getByRole('spinbutton').nth(1)).toHaveValue('-7');
  await editor.getByRole('spinbutton').nth(0).fill('22');
  await editor.getByRole('button', { name: '關閉', exact: true }).click();
  await page.getByTestId('frame-include-1').check();
  await load(page, 'saved-crop');
  await expect(firstFrame).toHaveAttribute('src', editedFrame!);
  await expect(page.getByTestId('frame-include-1')).not.toBeChecked();
  editor = await openCropEditor(page);
  await expect(editor.getByRole('spinbutton').nth(0)).toHaveValue('13');
  await editor.getByRole('button', { name: '關閉', exact: true }).click();

  await load(page, second.name);
  await expect(firstFrame).not.toHaveAttribute('src', editedFrame!);
  await expect(page.getByTestId('frame-include-0')).not.toBeChecked();
  await expect(page.getByTestId('frame-include-5')).toBeChecked();
  editor = await openCropEditor(page);
  await expect(editor.getByRole('spinbutton').nth(0)).toHaveValue('-11');
  await expect(editor.getByRole('spinbutton').nth(1)).toHaveValue('5');
});

test('same-count frame-mode projects restore their own inclusion masks every time', async ({ page }) => {
  const red = await sheetImage('#e23d2f');
  const blue = await sheetImage('#2873c9');
  const first = project('frames-first', red);
  const second = project('frames-second', blue);
  first.config.mode = second.config.mode = 'frame';
  first.spriteSheetImage = second.spriteSheetImage = null;
  first.frameModeFrames = [red, blue];
  second.frameModeFrames = [blue, red];
  first.frameIncluded = [false, true];
  second.frameIncluded = [true, false];
  await seed(page, [first, second]);
  await load(page, first.name);
  await expect(page.getByTestId('frame-include-0')).not.toBeChecked();
  await expect(page.getByTestId('frame-include-1')).toBeChecked();
  await load(page, second.name);
  await expect(page.getByTestId('frame-include-0')).toBeChecked();
  await expect(page.getByTestId('frame-include-1')).not.toBeChecked();
  await load(page, first.name);
  await expect(page.getByTestId('frame-include-0')).not.toBeChecked();
  await expect(page.getByTestId('frame-include-1')).toBeChecked();
});

test('restoration retains the saved slicing grid instead of the original generation grid', async ({ page }) => {
  const saved = project('edited-grid', await sheetImage('#e23d2f'));
  saved.config.gridCols = 4;
  saved.config.gridRows = 3;
  saved.sliceSettings.cols = 2;
  saved.sliceSettings.rows = 1;
  saved.frameIncluded = [true, false];
  saved.frameOverrides = [{ offsetX: 7, offsetY: 3 }];
  await seed(page, [saved]);
  await load(page, saved.name);
  await expect(page.getByTestId('frame-grid').locator('img')).toHaveCount(2);
  await expect(page.getByTestId('frame-include-1')).not.toBeChecked();
  const editor = await openCropEditor(page);
  await expect(editor.getByRole('spinbutton').nth(0)).toHaveValue('7');
  await expect(editor.getByRole('spinbutton').nth(1)).toHaveValue('3');
});
