import { expect, test } from '@playwright/test';
import { openTitle, projectLane, readStorage } from './support/game';

const SETTINGS_KEY = 'scoundrel:settings';

test.beforeEach(({}, testInfo) => {
  test.skip(!['full', 'visual'].includes(projectLane(testInfo)), 'Preferences lane.');
});

test('remembers the selected language across reloads', async ({ page }) => {
  await openTitle(page);
  await page.getByRole('button', { name: '简体中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.getByRole('button', { name: '开始新游戏' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.getByRole('button', { name: '开始新游戏' })).toBeVisible();

  const stored = await readStorage(page, SETTINGS_KEY);
  expect(stored).not.toBeNull();
  expect(JSON.parse(stored ?? '{}').data.locale).toBe('zh-Hans');
});

test('remembers the reduce-motion preference across reloads', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const reduceMotion = page.getByLabel('Reduce motion', { exact: true });
  await expect(reduceMotion).not.toBeChecked();
  await reduceMotion.check();
  await expect(reduceMotion).toBeChecked();

  const stored = await readStorage(page, SETTINGS_KEY);
  expect(stored).not.toBeNull();
  expect(JSON.parse(stored ?? '{}').data.reducedMotion).toBe(true);

  await page.reload();
  await expect(page.getByLabel('Reduce motion', { exact: true })).toBeChecked();
});

test('falls back to English for an unsupported browser language', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      get: () => ['fr-FR', 'fr'],
    });
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      get: () => 'fr-FR',
    });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'New run' })).toBeVisible();
});
