import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './lib/game';

test('welcome screen shows on the first visit and not on the next', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { intro: true });
  const hero = page.getByRole('dialog', { name: 'Fantasy World' });
  await expect(hero).toBeVisible();

  await hero.getByRole('button', { name: 'Generate world' }).click();
  await expect(hero).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('toolbar', { name: 'Map tools' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Fantasy World' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('random seed on the welcome screen changes the seed', async ({ page }) => {
  await openApp(page, { intro: true });
  const hero = page.getByRole('dialog', { name: 'Fantasy World' });
  await hero.getByRole('button', { name: 'Random seed' }).click();
  await expect(hero).toHaveCount(0);
  const seed = await page
    .getByRole('toolbar', { name: 'Map tools' })
    .getByLabel('Seed', { exact: true })
    .inputValue();
  expect(seed).toMatch(/^world\d{6}$/);
});

test('the help button reopens the welcome screen and Escape closes it', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'About this map' }).click();
  const hero = page.getByRole('dialog', { name: 'Fantasy World' });
  await expect(hero).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hero).toHaveCount(0);
});

test('generation shows the stage list while the map is being built', async ({ page }) => {
  await page.goto('/');
  const status = page.getByRole('status').filter({ hasText: 'Generating map' });
  // the overlay lists every stage; whichever is current is marked as the active step
  await expect(status.getByText('Drawing nations and borders')).toBeVisible();
  await expect(status.locator('[aria-current="step"]')).toHaveCount(1);
});
