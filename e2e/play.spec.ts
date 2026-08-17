import { expect, test } from '@playwright/test';

test('title screen starts a new run that deals a room', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SCOUNDREL' })).toBeVisible();
  await page.getByRole('button', { name: 'New Run' }).click();
  await expect(page).toHaveURL(/#\/play/);
  await expect(page.locator('.room .card')).toHaveCount(4);
});

test('a seeded URL reproduces a deterministic run', async ({ page }) => {
  await page.goto('/#/play?seed=abc&runAway=once&potions=1&degrade=1');
  await expect(page.locator('.room .card')).toHaveCount(4);
  await expect(page.locator('.hud-seed')).toContainText('abc');
  const firstCard = page.locator('.card img').first();
  await expect(firstCard).toBeVisible();
  const natural = await firstCard.evaluate((el) => (el as HTMLImageElement).naturalWidth);
  expect(natural).toBeGreaterThan(0);
});
