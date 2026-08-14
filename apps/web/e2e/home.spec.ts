import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home loads accessibly', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /da forma a las ideas/i })).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
