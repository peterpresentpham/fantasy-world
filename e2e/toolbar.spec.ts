import { expect, test } from '@playwright/test';
import {
  advancedPanel,
  canvasFingerprint,
  openApp,
  settledFingerprint,
  watchErrors,
} from './lib/game';

test('toolbar is shown with seed, preset, view and overlay controls', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const toolbar = page.getByRole('toolbar', { name: 'Map tools' });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByLabel('Seed', { exact: true })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Randomize seed' })).toBeVisible();
  await expect(toolbar.getByRole('group', { name: 'View mode' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('randomize changes the seed and the rendered map', async ({ page }) => {
  await openApp(page);
  const toolbar = page.getByRole('toolbar', { name: 'Map tools' });
  const before = await settledFingerprint(page);
  const seedBefore = await toolbar.getByLabel('Seed', { exact: true }).inputValue();

  await toolbar.getByRole('button', { name: 'Randomize seed' }).click();
  await expect(toolbar.getByLabel('Seed', { exact: true })).not.toHaveValue(seedBefore);
  await expect.poll(() => canvasFingerprint(page)).not.toBe(before);
});

test('typing a seed in the toolbar applies it on Enter', async ({ page }) => {
  await openApp(page);
  const input = page
    .getByRole('toolbar', { name: 'Map tools' })
    .getByLabel('Seed', { exact: true });
  await input.fill('toolbar-seed');
  await input.press('Enter');
  await expect(input).toHaveValue('toolbar-seed');
  await page.reload();
  await expect(
    page.getByRole('toolbar', { name: 'Map tools' }).getByLabel('Seed', { exact: true })
  ).toHaveValue('toolbar-seed');
});

test('view presets switch exclusively and change the map', async ({ page }) => {
  await openApp(page);
  const toolbar = page.getByRole('toolbar', { name: 'Map tools' });
  const landform = toolbar.getByRole('button', { name: 'Landform' });
  const political = toolbar.getByRole('button', { name: 'Political' });

  await landform.click();
  await expect(landform).toHaveAttribute('aria-pressed', 'true');
  const landformShot = await settledFingerprint(page);

  await political.click();
  await expect(political).toHaveAttribute('aria-pressed', 'true');
  await expect(landform).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => canvasFingerprint(page)).not.toBe(landformShot);
});

test('view mode switch is exclusive', async ({ page }) => {
  await openApp(page);
  const group = page.getByRole('group', { name: 'View mode' });
  await group.getByRole('button', { name: 'Iso' }).click();
  await expect(group.getByRole('button', { name: 'Iso' })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'false');
  await group.getByRole('button', { name: '2D' }).click();
  await expect(group.getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true');
});

test('edit terrain shortcut opens the advanced settings on the Edit Terrain tab', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Edit terrain' }).click();
  await expect(advancedPanel(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Edit Terrain' })).toHaveAttribute(
    'data-state',
    'active'
  );
});

test('toolbar collapses to a small bar and expands again', async ({ page }) => {
  await openApp(page);
  const toolbar = page.getByRole('toolbar', { name: 'Map tools' });
  const before = await toolbar.boundingBox();

  await toolbar.getByRole('button', { name: 'Collapse toolbar' }).click();
  await expect(toolbar.getByLabel('Seed', { exact: true })).toHaveCount(0);
  const collapsed = await toolbar.boundingBox();
  expect(collapsed!.width).toBeLessThan(before!.width / 2);

  await page.reload();
  await expect(
    page.getByRole('toolbar', { name: 'Map tools' }).getByLabel('Seed', { exact: true })
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Expand toolbar' }).click();
  await expect(
    page.getByRole('toolbar', { name: 'Map tools' }).getByLabel('Seed', { exact: true })
  ).toBeVisible();
});

test('toolbar can be dragged while collapsed and stays inside the screen', async ({ page }) => {
  await openApp(page);
  const toolbar = page.getByRole('toolbar', { name: 'Map tools' });
  await toolbar.getByRole('button', { name: 'Collapse toolbar' }).click();

  const handle = toolbar.getByRole('button', { name: 'Move toolbar' });
  const start = (await handle.boundingBox())!;
  const viewport = page.viewportSize()!;
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y + 120, { steps: 5 });
  await page.mouse.up();
  const moved = (await toolbar.boundingBox())!;
  expect(moved.y).toBeGreaterThan(start.y + 80);
  expect(moved.x).toBeLessThan(start.x - 40);

  // dragging far off-screen is clamped to the map area
  await page.mouse.move(moved.x + 10, moved.y + 10);
  await page.mouse.down();
  await page.mouse.move(viewport.width + 500, viewport.height + 500, { steps: 5 });
  await page.mouse.up();
  const clamped = (await toolbar.boundingBox())!;
  expect(clamped.x + clamped.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(clamped.y + clamped.height).toBeLessThanOrEqual(viewport.height + 1);

  // position survives a reload
  await page.reload();
  const after = (await page.getByRole('toolbar', { name: 'Map tools' }).boundingBox())!;
  expect(Math.abs(after.x - clamped.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.y - clamped.y)).toBeLessThanOrEqual(2);
});

test('advanced settings expand under the toolbar and the map stays usable', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const toolbar = page.getByRole('toolbar', { name: 'Map tools' });
  const toggle = toolbar.getByRole('button', { name: 'Advanced settings', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  const panel = advancedPanel(page);
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const toolbarBox = (await toolbar.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.y).toBeGreaterThanOrEqual(toolbarBox.y + toolbarBox.height - 1);

  // not modal: the toolbar and the map can still be used while it is open
  await toolbar.getByRole('button', { name: 'Randomize seed' }).click();
  await panel.getByRole('tab', { name: 'Display' }).click();
  await expect(panel.getByRole('tab', { name: 'Display' })).toHaveAttribute('data-state', 'active');

  await panel.getByRole('button', { name: 'Close advanced settings' }).click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('collapsing the toolbar hides the advanced settings and expanding brings them back', async ({
  page,
}) => {
  await openApp(page);
  const toolbar = page.getByRole('toolbar', { name: 'Map tools' });
  await toolbar.getByRole('button', { name: 'Advanced settings', exact: true }).click();
  await expect(advancedPanel(page)).toBeVisible();

  await toolbar.getByRole('button', { name: 'Collapse toolbar' }).click();
  await expect(advancedPanel(page)).toHaveCount(0);

  await toolbar.getByRole('button', { name: 'Expand toolbar' }).click();
  await expect(advancedPanel(page)).toBeVisible();
});

test('the floating settings button and modal dialog are gone', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Map configuration' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Advanced settings', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
