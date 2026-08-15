import { expect, test } from '@playwright/test';

test('boots and shows the Scoundrel title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Scoundrel' })).toBeVisible();
});
