import { expect, test } from './fixtures';

test.use({ viewport: { width: 390, height: 844 } });

test('compact viewport keeps canvas and mutually exclusive side panels reachable', async ({ app }) => {
  const collapsePalette = app.getByRole('button', { name: 'Collapse node palette' });
  if (await collapsePalette.isVisible()) await collapsePalette.click();

  await expect(app.getByRole('button', { name: 'Open Palette' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Open Inspector' })).toBeVisible();
  await app.getByRole('button', { name: 'Open Inspector' }).click();

  await expect(app.getByRole('tab', { name: 'Edit & review' })).toBeVisible();
  await expect(app.getByRole('tab', { name: 'Scenarios' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Collapse inspector' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Open Palette' })).toBeVisible();
  expect(
    await app.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});
