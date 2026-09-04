import { expect, freezeResearchIntake, test } from './fixtures';
import { downloadText } from './helpers/downloads';

type Scenario = {
  id: string;
  name: string;
  orderedPath: string[];
  expectedTerminalOutcome: { kind: string; detail?: string };
  traversedEdges: Array<{ id: string; mode: string; isLoop?: boolean }>;
};

test('all native downloads preserve graph, route, loop, and scenario truth', async ({ app }) => {
  await freezeResearchIntake(app);
  await app.getByRole('radio', { name: 'Scenario', exact: true }).click();
  await expect(app.getByText('5 total', { exact: true })).toBeVisible();
  await expect(app.getByText('Showing 1–5 · Page 1 of 1', { exact: true })).toBeVisible();

  const graph = JSON.parse(await downloadText(app, 'graph-contract.json')) as {
    status: string;
    nodes: unknown[];
    edges: Array<{ id: string; mode: string }>;
  };
  expect(graph.status).toBe('frozen');
  expect(graph.nodes).toHaveLength(9);
  expect(graph.edges).toHaveLength(9);
  expect(new Set(graph.edges.map((edge) => edge.mode))).toEqual(
    new Set(['normal', 'conditional', 'command', 'fallback']),
  );

  const scenarioArtifact = JSON.parse(
    await downloadText(app, 'graph-test-scenarios.json'),
  ) as { scenarios: Scenario[] };
  expect(scenarioArtifact.scenarios).toHaveLength(5);
  expect(
    scenarioArtifact.scenarios.flatMap((scenario) =>
      scenario.traversedEdges.filter((edge) => edge.id === 'researcher-continue'),
    ),
  ).toHaveLength(2);
  for (const scenario of scenarioArtifact.scenarios) {
    expect(
      scenario.traversedEdges.filter((edge) => edge.id === 'researcher-continue').length,
    ).toBeLessThanOrEqual(1);
  }

  const python = await downloadText(app, 'test_graph_paths.py');
  expect(python).toContain('SCENARIOS = [');
  expect(python).toContain('"id": "scenario-5"');
  expect(python).toContain('def test_graph_path_contract(scenario):');

  const selected = scenarioArtifact.scenarios[0];
  const scenarioRow = app.locator(`button[data-scenario-id="${selected.id}"]`);
  await scenarioRow.click();
  await expect(scenarioRow).toHaveAttribute('aria-pressed', 'true');
  await expect(scenarioRow).toHaveAttribute('aria-expanded', 'true');
  await expect(scenarioRow.locator('.mode-path-strip__node')).toHaveCount(selected.orderedPath.length);
  await expect(scenarioRow.locator('.mode-path-strip__overflow')).toHaveCount(0);
  await expect(app.locator('.scenario-row__expanded')).toHaveCount(1);
  await expect(app.locator('.scenario-state--active').first()).toHaveCSS('opacity', '1');
  await expect(app.locator('.scenario-state--dimmed').first()).toHaveCSS('opacity', '0.18');
  await expect(app.getByRole('link', { name: 'Download graph-contract.json' })).toContainText('JSON');
  await expect(app.getByRole('link', { name: 'Download graph-test-scenarios.json' })).toBeVisible();
  await expect(app.getByRole('link', { name: 'Download graph-test-scenarios.json' })).toContainText('Tests');
  await expect(app.getByRole('link', { name: 'Download test_graph_paths.py' })).toBeVisible();
  await expect(app.getByRole('link', { name: 'Download test_graph_paths.py' })).toContainText('Python');
});
