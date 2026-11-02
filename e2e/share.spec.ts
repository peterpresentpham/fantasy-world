import { expect, test } from '@playwright/test';
import { openApp, watchErrors, openTools } from './lib/game';

const toolbar = (page: import('@playwright/test').Page) =>
  page.getByRole('toolbar', { name: 'Map tools' });
const seedField = (page: import('@playwright/test').Page) =>
  toolbar(page).getByLabel('Seed', { exact: true });

test('a first-time visitor gets a random world, not the default one', async ({ page }) => {
  await openApp(page, { intro: true });
  await expect(page.getByRole('dialog', { name: 'Fantasy World' })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Fantasy World' })
    .getByRole('button', { name: 'Explore this world' })
    .click();
  await expect(seedField(page)).not.toHaveValue('world-001');
  await expect(seedField(page)).toHaveValue(/^world\d{6}$/);
});

test('a shared link opens that exact world and survives a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { path: '/?seed=shared-world&topo=archipelago' });
  await expect(seedField(page)).toHaveValue('shared-world');
  await expect(page).toHaveURL(/seed=shared-world/);
  await expect(page).toHaveURL(/topo=archipelago/);

  await page.reload();
  await expect(seedField(page)).toHaveValue('shared-world');
  expect(errors).toEqual([]);
});

test('the address bar follows the seed', async ({ page }) => {
  await openApp(page);
  await toolbar(page).getByRole('button', { name: 'Randomize seed' }).click();
  const seed = await seedField(page).inputValue();
  await expect(page).toHaveURL(new RegExp(`seed=${seed}`));
});

test('an invalid link falls back to the saved world', async ({ page }) => {
  await openApp(page, { path: '/?seed=&topo=nonsense&cells=1' });
  await expect(seedField(page)).toBeVisible();
  await expect(seedField(page)).not.toHaveValue('');
});

test('copy link puts the current address on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page, { path: '/?seed=copy-me' });
  await openTools(page);
  await page.getByRole('button', { name: 'Copy link to this world' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('seed=copy-me');
});

test('download image saves a PNG', async ({ page }) => {
  await openApp(page);
  const download = page.waitForEvent('download');
  await openTools(page);
  await page.getByRole('button', { name: 'Download map image' }).click();
  expect((await download).suggestedFilename()).toMatch(/^fantasy-world-.+\.png$/);
});

test('the legend explains the current view and can be collapsed', async ({ page }) => {
  await openApp(page);
  const legend = page.getByRole('region', { name: 'Map legend' });
  await expect(legend).toBeVisible();
  // the legend starts folded on a phone
  const toggle = legend.getByRole('button').first();
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  await expect(legend.getByText('Nations and their borders')).toBeVisible();

  await toolbar(page).getByRole('button', { name: 'Biome' }).click();
  await expect(legend.getByText('Forests, deserts and other climate zones')).toBeVisible();

  await toolbar(page).getByRole('button', { name: 'Climate' }).click();
  await expect(legend.getByText('Cold', { exact: true })).toBeVisible();
  await expect(legend.getByText('Hot', { exact: true })).toBeVisible();

  await legend.getByRole('button', { name: 'Climate' }).click();
  await expect(legend.getByText('Cold', { exact: true })).toHaveCount(0);
});

test('the welcome screen explains the app and keeps shortcuts out of the way', async ({ page }) => {
  await openApp(page, { intro: true });
  const hero = page.getByRole('dialog', { name: 'Fantasy World' });
  await expect(hero.getByText('Explore.', { exact: false })).toBeVisible();
  await expect(hero.getByText('Share it.', { exact: false })).toBeVisible();
  await hero.getByText('Keyboard shortcuts').click();
  await expect(hero.getByText('Zoom in, out, reset')).toBeVisible();
});

test('the sea level control is a slider', async ({ page }) => {
  await openApp(page);
  await openTools(page);
  await page.getByRole('button', { name: 'Advanced settings', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Sea level' })).toBeVisible();
});

test('the world summary lists nations and opens their details', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 640, 'the summary card is hidden on phones');
  await openApp(page);
  const summary = page.getByRole('region', { name: 'World summary' });
  await expect(summary).toBeVisible();
  await summary.getByRole('button').first().click();
  const list = summary.getByRole('list', { name: 'Nations by population' });
  await expect(list.getByRole('button').first()).toBeVisible();
  await list.getByRole('button').first().click();
  await expect(page.getByRole('complementary', { name: /details/ })).toBeVisible();
  // picking a nation also zooms the map to it
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeEnabled();
});

test('nations and climate are sliders with plain labels', async ({ page }) => {
  await openApp(page);
  await openTools(page);
  await page.getByRole('button', { name: 'Advanced settings', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Number of nations' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Warmth' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Wetness' })).toBeVisible();
});

test('route mode is one click away on the toolbar', async ({ page }) => {
  await openApp(page);
  await openTools(page);
  const route = page.getByRole('button', { name: 'Find a route' });
  await expect(route).toHaveAttribute('aria-pressed', 'false');
  await route.click();
  await expect(route).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Click a start point' })).toBeVisible();
  await route.click();
  await expect(page.getByText('Click a start point')).toHaveCount(0);
});

test('the T key turns route mode on and off', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones have no keyboard');
  await openApp(page);
  await page.keyboard.press('t');
  await expect(page.getByRole('status').filter({ hasText: 'Click a start point' })).toBeVisible();
  await page.keyboard.press('t');
  await expect(page.getByText('Click a start point')).toHaveCount(0);
});

test('picking a sample world loads its seed and topography into the link', async ({ page }) => {
  await openApp(page);
  await openTools(page);
  await page.getByRole('combobox', { name: 'Sample worlds' }).click();
  await page.getByRole('option', { name: 'Frozen Isles' }).click();
  await expect(seedField(page)).toHaveValue('sample-ranges-8');
  await expect(page).toHaveURL(/seed=sample-ranges-8/);
  await expect(page).toHaveURL(/topo=ranges/);
});
