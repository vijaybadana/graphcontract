import { callWebMcpTool, expect, test } from './fixtures';

type GraphRead = {
  ok: true;
  graph: {
    updatedAt: string;
    nodes: Array<{ id: string }>;
    edges: Array<{ id: string }>;
  };
};

type ScenarioRead = {
  ok: true;
  scenarios: Array<{ id: string }>;
};

test('summary bar reports authoritative counts and every contextual contract status', async ({ app }) => {
  const summary = app.getByLabel('Graph status');

  await expect(summary).toContainText('7 nodes');
  await expect(summary).toContainText('8 edges');
  await expect(summary).toContainText('0 scenarios');
  await expect(summary).toContainText('Ready to freeze');
  await expect(summary).not.toContainText('branches');
  await expect(summary).not.toContainText('paths');

  await app.getByRole('button', { name: 'Task', exact: true }).click();
  await expect(summary).toContainText(/\d+ issues?/);
  await app.getByRole('button', { name: 'Undo' }).click();
  await expect(summary).toContainText('Ready to freeze');

  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  await callWebMcpTool(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    operations: [
      {
        type: 'update_node',
        nodeId: 'classifier',
        patch: { label: 'Classifier Agent review candidate' },
      },
    ],
    rationale: 'Verify the contextual proposal status without mutating the accepted graph.',
  });
  await expect(summary).toContainText('Proposal pending');
  await app.getByRole('button', { name: 'Reject' }).click();
  await expect(summary).toContainText('Ready to freeze');

  await app.getByRole('button', { name: /confirm (?:and|&) freeze/i }).click();
  const generated = await callWebMcpTool<ScenarioRead>(app, 'get_branch_scenarios', {});
  await expect(summary).toContainText(`${generated.scenarios.length} scenarios`);
  await expect(summary).toContainText('Contract frozen');

  await app.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  const compactLayout = await summary.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(compactLayout.columns).toBe(2);
  expect(compactLayout.scrollWidth).toBeLessThanOrEqual(compactLayout.clientWidth);
});
