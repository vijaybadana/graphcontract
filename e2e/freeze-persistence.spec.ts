import { expect, freezeResearchIntake, test } from './fixtures';

test('freeze locks editing, survives reload, and unfreeze restores authoring', async ({ app }) => {
  await freezeResearchIntake(app);

  await expect(app.getByRole('button', { name: 'Agent' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Load Research Intake Routing' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await app.reload();
  await expect(app.getByText('Research Intake Routing', { exact: true })).toBeVisible();
  await expect(
    app
      .locator('header[aria-label="GraphContract workspace controls"]')
      .getByText('Frozen contract', { exact: true }),
  ).toBeVisible();
  await expect(app.getByRole('button', { name: 'Unfreeze' })).toBeVisible();

  await app.getByRole('button', { name: 'Unfreeze' }).click();
  await expect(app.getByText('Valid draft', { exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Agent' })).toBeEnabled();
  await expect(app.locator('.workspace-freeze-button')).toBeEnabled();
});
