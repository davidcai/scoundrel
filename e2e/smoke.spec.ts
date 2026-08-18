import { expect, test } from '@playwright/test'

// Scaffold smoke: app boots and renders. The QA lane replaces/extends this
// with the full spec Seam 3 suite.
test('app boots', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Scoundrel/)
  await expect(page.locator('h1')).toContainText('Scoundrel')
})
