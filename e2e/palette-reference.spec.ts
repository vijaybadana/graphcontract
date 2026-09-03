import { expect, test } from './fixtures';

test('connection taxonomy stays a focusable reference instead of a graph mutation control', async ({ app }) => {
  const references = app.getByRole('region', { name: 'Connections reference' }).locator('li');
  await expect(references).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    const reference = references.nth(index);
    await expect(reference).toHaveAttribute('tabindex', '0');
    await expect(reference).not.toHaveAttribute('draggable', 'true');
    await expect(reference.locator('.node-palette__item-icon')).toHaveCount(1);
  }

  const edge = references.filter({ hasText: /^Edge/ });
  await expect(edge).not.toHaveAttribute('title');
  await edge.hover();
  const tooltip = app.getByRole('tooltip', {
    name: 'A standard directed connection between two nodes.',
    exact: true,
  });
  await expect(tooltip).toBeVisible({ timeout: 500 });
  const edgeBox = await edge.boundingBox();
  const tooltipBox = await tooltip.boundingBox();
  expect(edgeBox).not.toBeNull();
  expect(tooltipBox).not.toBeNull();
  expect(tooltipBox!.x).toBeGreaterThan(edgeBox!.x + edgeBox!.width);

  const send = references.filter({ hasText: /^Send ×N/ });
  await send.focus();
  await expect(send).toBeFocused();
  await expect(app.getByRole('tooltip', {
    name: 'Dynamically fans work out to one template and rejoins at Merge.',
    exact: true,
  })).toBeVisible();

  await expect(app.getByText('Reference', { exact: true })).toHaveCount(0);
  await expect(app.getByText('Derived', { exact: true })).toHaveCount(0);
  await expect(app.getByRole('button', { name: 'Action', exact: true })).toHaveCount(0);
});
