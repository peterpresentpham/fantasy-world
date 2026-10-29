import { expect, type Page, test } from '@playwright/test';
import {
  advancedPanel,
  openApp,
  openConfig,
  openTab,
  settledFingerprint,
  watchErrors,
} from './lib/game';

const mapImage = (page: Page) => page.getByRole('img', { name: /Interactive fantasy world map/ });
const resetZoom = (page: Page) => page.getByRole('button', { name: 'Reset zoom' });
const layerTransform = (page: Page) =>
  page.evaluate(
    () => getComputedStyle(document.getElementById('map-base-canvas')!.parentElement!).transform
  );

async function centerOfMap(page: Page) {
  const box = await mapImage(page).boundingBox();
  if (!box) throw new Error('map has no bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('wheel zoom, zoom buttons and reset', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await expect(resetZoom(page)).toBeDisabled();

  const center = await centerOfMap(page);
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, -400);
  await expect(resetZoom(page)).toBeEnabled();
  await expect(page.getByRole('img', { name: /Map overview/ })).toBeVisible();

  await resetZoom(page).click();
  await expect(resetZoom(page)).toBeDisabled();
  await expect(page.getByRole('img', { name: /Map overview/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(resetZoom(page)).toBeEnabled();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(resetZoom(page)).toBeDisabled();
  expect(errors).toEqual([]);
});

test('dragging a zoomed map pans it without opening the side panel', async ({ page }) => {
  await openApp(page);
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Zoom in' }).click();
  const before = await layerTransform(page);

  const center = await centerOfMap(page);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 120, center.y + 60, { steps: 6 });
  await page.mouse.up();

  expect(await layerTransform(page)).not.toBe(before);
  await expect(page.getByRole('complementary', { name: /details/ })).toHaveCount(0);
});

test('side panel opens on click, stays beside the map and Escape closes it', async ({ page }) => {
  await openApp(page);
  const center = await centerOfMap(page);
  await page.mouse.click(center.x, center.y);
  const panel = page.getByRole('complementary', { name: /details/ });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Map tools' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  await page.mouse.click(center.x, center.y);
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Close details' }).click();
  await expect(panel).toHaveCount(0);
});

test('keyboard shortcuts: R randomizes, digits switch view, +/0 zoom', async ({ page }) => {
  await openApp(page);
  const toolbar = page.getByRole('toolbar', { name: 'Map tools' });
  const seed = toolbar.getByLabel('Seed', { exact: true });
  const seedBefore = await seed.inputValue();

  await page.keyboard.press('r');
  await expect(seed).not.toHaveValue(seedBefore);

  await page.keyboard.press('3');
  await expect(toolbar.getByRole('button', { name: 'Political' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.keyboard.press('+');
  await expect(resetZoom(page)).toBeEnabled();
  await page.keyboard.press('0');
  await expect(resetZoom(page)).toBeDisabled();
});

test('shortcuts are ignored while typing in a field', async ({ page }) => {
  await openApp(page);
  const seed = page.getByRole('toolbar', { name: 'Map tools' }).getByLabel('Seed', { exact: true });
  await seed.fill('');
  await seed.pressSequentially('rr1');
  await expect(seed).toHaveValue('rr1');
});

test('hover tooltip is compact and expands while Shift is held', async ({ page }) => {
  await openApp(page);
  await openConfig(page);
  await openTab(page, 'Display');
  await page.getByLabel('Cell Data').check();
  await page.keyboard.press('Escape');
  await expect(advancedPanel(page)).toHaveCount(0);

  const center = await centerOfMap(page);
  await page.mouse.move(center.x - 20, center.y);
  await page.mouse.move(center.x, center.y, { steps: 4 });
  await expect(page.getByText('Hold Shift for details')).toBeVisible();
  await expect(page.getByText('Rain Shadow')).toHaveCount(0);

  await page.keyboard.down('Shift');
  await expect(page.getByText('Rain Shadow')).toBeVisible();
  await page.keyboard.up('Shift');
  await expect(page.getByText('Rain Shadow')).toHaveCount(0);
});

test('zoom is CSS only, the rendered bitmap is untouched', async ({ page }) => {
  await openApp(page);
  const before = await settledFingerprint(page);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Reset zoom' }).click();
  // zoom is CSS only: the rendered bitmap is untouched
  expect(await settledFingerprint(page)).toBe(before);
});
