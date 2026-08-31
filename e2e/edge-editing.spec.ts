import { callWebMcpTool, expect, loadResearchIntake, test } from './fixtures';

type GraphRead = {
  validation: { validForFreeze: boolean; issues: Array<{ code: string }> };
};

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
  await expect.poll(async () => (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).validation).toMatchObject({
    validForFreeze: false,
    issues: [expect.objectContaining({ code: 'COMMAND_LABEL_REQUIRED' })],
  });
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();
  await expect(app.locator('[aria-label="Command edge, invalid"]')).toHaveCount(1);

  await app.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).validation).toEqual({
    validForFreeze: true,
    issues: [],
  });
  await expect(app.locator('[aria-label="Command edge, route ready"]')).toHaveCount(1);
  await expect(app.locator('.workspace-freeze-button')).toBeEnabled();
});
