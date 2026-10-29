import { expect, test } from '@playwright/test';
import {
  advancedPanel,
  applySeed,
  canvasFingerprint,
  openApp,
  openConfig,
  openTab,
  settledFingerprint,
  waitForMap,
  watchErrors,
} from './lib/game';

test('advanced settings open, switch tabs and close with Escape', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await openConfig(page);
  for (const tab of [
    'Generation',
    'Display',
    'Nations',
    'Ethnic',
    'Edit Terrain',
    'Export',
    'Palette',
  ]) {
    await openTab(page, tab);
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('data-state', 'active');
  }
  await page.keyboard.press('Escape');
  await expect(advancedPanel(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('same seed renders the same map, a different seed renders a different one', async ({
  page,
}) => {
  await openApp(page);
  await openConfig(page);

  await applySeed(page, 'e2e-seed-a');
  const first = await settledFingerprint(page);

  await applySeed(page, 'e2e-seed-b');
  await expect.poll(() => canvasFingerprint(page)).not.toBe(first);

  await applySeed(page, 'e2e-seed-a');
  await expect.poll(() => canvasFingerprint(page)).toBe(first);
});

test('seed survives a reload', async ({ page }) => {
  await openApp(page);
  await openConfig(page);
  await applySeed(page, 'e2e-persist');
  const before = await settledFingerprint(page);

  await page.reload();
  await waitForMap(page);
  await expect.poll(() => canvasFingerprint(page)).toBe(before);
});

test('clicking the map opens the cell detail side panel', async ({ page }) => {
  await openApp(page);
  const map = page.getByRole('img', { name: /Interactive fantasy world map/ });
  const box = await map.boundingBox();
  if (!box) throw new Error('map has no bounding box');
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByRole('complementary', { name: /details/ })).toBeVisible();
});
