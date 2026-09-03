import { expect, freezeResearchIntake, test, webMcpToolNames } from './fixtures';
import { readGraph } from './helpers/graph';

test('freeze locks editing, survives reload, and unfreeze restores authoring', async ({ app }) => {
  await freezeResearchIntake(app);

  await expect(app.getByRole('button', { name: 'Agent' })).toBeDisabled();
  await app.getByRole('button', { name: 'Workflow library, 14 templates' }).click();
  await expect(app.getByRole('button', { name: /Open Research Intake Routing unavailable/ })).toBeDisabled();
  await app.getByRole('button', { name: 'Close graph library' }).click();
  await expect(app.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await app.reload();
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  await expect.poll(async () => await readGraph(app)).toMatchObject({
    id: 'research-intake-routing-demo',
    name: 'Research Intake Routing',
    status: 'frozen',
  });
  await expect(app.getByRole('button', { name: 'Unfreeze' })).toBeVisible();

  await app.getByRole('button', { name: 'Unfreeze' }).click();
  await expect.poll(async () => (await readGraph(app)).status).toBe('draft');
  await expect(app.getByRole('button', { name: 'Agent' })).toBeEnabled();
  await expect(app.locator('.workspace-freeze-button')).toBeEnabled();
});
