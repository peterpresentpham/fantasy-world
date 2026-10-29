import { expect, test } from '@playwright/test';
import { horizontalOverflow, openApp, watchErrors } from './lib/game';

test('page loads, renders the map and has no runtime errors', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await expect(page.getByRole('img', { name: /Interactive fantasy world map/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('page does not overflow horizontally', async ({ page }) => {
  await openApp(page);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});
