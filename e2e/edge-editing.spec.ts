import { expect, loadResearchIntake, test } from './fixtures';

test('edge edits surface validation immediately and undo restores the accepted route', async ({ app }) => {
  await loadResearchIntake(app);
  await app.getByTestId('rf__edge-clarify-write-brief').click();

  await expect(app.getByRole('button', { name: 'Routing mode' })).toContainText('Command');
  await expect(app.getByText('Canonical target: Write Research Brief · write-research-brief')).toBeVisible();
  const routeLabel = app.getByRole('textbox', { name: 'Route label' });
  await expect(routeLabel).toHaveValue('ready');

  await routeLabel.fill('');
  await routeLabel.blur();
  await expect(app.getByText('Every command edge from “Clarify Request” needs a label.')).toBeVisible();
  await expect(app.getByText('1 issue', { exact: true }).first()).toBeVisible();
  await expect(app.getByRole('button', { name: 'Confirm & freeze' })).toBeDisabled();
  await expect(app.locator('[aria-label="Command edge, invalid"]')).toHaveCount(1);

  await app.getByRole('button', { name: 'Undo' }).click();
  await expect(app.getByText('Valid draft', { exact: true })).toBeVisible();
  await expect(app.locator('[aria-label="Command edge, route ready"]')).toHaveCount(1);
  await expect(app.getByRole('button', { name: 'Confirm & freeze' })).toBeEnabled();
});
