import { expect, loadResearchIntake, test } from './fixtures';
import { readGraph } from './helpers/graph';

test('demo replacement is confirmation-protected and exposes the routing inventory', async ({ app }) => {
  app.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Replace the current canvas with Research Intake Routing?');
    await dialog.dismiss();
  });
  await app.getByRole('button', { name: 'Load Research Intake Routing' }).click();
  await expect.poll(async () => (await readGraph(app)).id).toBe('customer-support-contract');
  await expect(app.getByTestId('rf__node-classifier')).toBeVisible();

  await loadResearchIntake(app);

  await expect(app.locator('[aria-label="Command edge, route ready"]')).toHaveCount(1);
  await expect(app.locator('[aria-label="Command edge, route needs clarification"]')).toHaveCount(1);
  await expect(app.locator('[aria-label="Conditional edge, route enough evidence"]')).toHaveCount(1);
  await expect(app.locator('[aria-label="Conditional edge, route more research"]')).toHaveCount(1);
  await expect(app.locator('[aria-label="Fallback edge, route fallback"]')).toHaveCount(1);
  await expect(app.locator('[aria-label="Loop normal edge, route continue"]')).toHaveCount(1);

  await app.getByTestId('rf__edge-clarify-write-brief').click();
  await app.getByRole('button', { name: 'Routing mode' }).click();
  await expect(app.getByRole('option', { name: 'Edge', exact: true })).toBeVisible();
  await expect(app.getByRole('option', { name: 'Conditional edge' })).toBeVisible();
  await expect(app.getByRole('option', { name: 'Command' })).toBeVisible();
  await expect(app.getByRole('option', { name: 'Fallback' })).toBeVisible();
});
