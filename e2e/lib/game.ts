// Drive the UI like a real user. Selectors use roles, labels and visible text only.
import { expect, type Page } from '@playwright/test';

/** Collect uncaught page errors and console errors so tests can assert none happened. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/** Wait until generation has finished (the "Generating map" status overlay is gone). */
export async function waitForMap(page: Page) {
  await expect(page.locator('#map-base-canvas')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Generating map' })).toHaveCount(0);
}

/** Pre-dismiss the welcome screen (only when nothing is stored yet, so reloads keep UI state). */
export async function skipIntro(page: Page) {
  await page.addInitScript(() => {
    try {
      if (localStorage.getItem('ui-state') === null) {
        localStorage.setItem(
          'ui-state',
          JSON.stringify({ state: { introSeen: true }, version: 3 })
        );
      }
    } catch {
      /* storage blocked */
    }
  });
}

export async function openApp(page: Page, options: { intro?: boolean } = {}) {
  if (!options.intro) await skipIntro(page);
  await page.goto('/');
  await waitForMap(page);
}

export const advancedPanel = (page: Page) =>
  page.getByRole('region', { name: 'Advanced settings', exact: true });

export async function openConfig(page: Page) {
  await page.getByRole('button', { name: 'Advanced settings', exact: true }).click();
  await expect(advancedPanel(page)).toBeVisible();
}

export async function openTab(page: Page, name: string) {
  await page.getByRole('tab', { name }).click();
}

/**
 * Type a seed in the Generation tab, apply it and wait for the new map. The seed must differ from
 * the current one: we return once the canvas no longer shows the previous map (watching the
 * progress overlay would miss a cached, near-instant regeneration).
 */
export async function applySeed(page: Page, seed: string) {
  await openTab(page, 'Generation');
  const before = await canvasFingerprint(page);
  await page.getByPlaceholder('world000').fill(seed);
  await page.getByRole('button', { name: 'Apply seed' }).click();
  await expect.poll(() => canvasFingerprint(page)).not.toBe(before);
  await waitForMap(page);
}

/** Pixel fingerprint of the base canvas; equal strings mean an identical rendered map. */
export async function canvasFingerprint(page: Page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('map-base-canvas') as HTMLCanvasElement;
    return canvas.toDataURL('image/png');
  });
}

export async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
}

/** Fingerprint once the canvas has stopped changing (drawing happens after the status overlay goes away). */
export async function settledFingerprint(page: Page) {
  let last = await canvasFingerprint(page);
  await expect
    .poll(async () => {
      const next = await canvasFingerprint(page);
      const stable = next === last;
      last = next;
      return stable;
    })
    .toBe(true);
  return last;
}
