import { expect, freezeResearchIntake, callWebMcpTool, test } from './fixtures';
import { downloadText } from './helpers/downloads';

type Scenario = {
  id: string;
  traversedEdges: Array<{ id: string; mode: string; isLoop?: boolean }>;
};

test('frozen scenarios are exhaustive and every derived loop is bounded to one traversal', async ({ app }) => {
  await freezeResearchIntake(app);
  const result = await callWebMcpTool<{ ok: boolean; scenarios: Scenario[] }>(
    app,
    'get_branch_scenarios',
    {},
  );

  expect(result.ok).toBe(true);
  expect(result.scenarios).toHaveLength(5);
  for (const scenario of result.scenarios) {
    expect(
      scenario.traversedEdges.filter((edge) => edge.id === 'researcher-continue'),
      `${scenario.id} must traverse the derived loop at most once`,
    ).toHaveLength(scenario.traversedEdges.some((edge) => edge.isLoop) ? 1 : 0);
  }
});

test('all native downloads preserve graph, route, loop, and scenario truth', async ({ app }) => {
  await freezeResearchIntake(app);
  await app.getByRole('tab', { name: 'Scenarios (5)' }).click();
  await expect(app.getByText('5 paths', { exact: true })).toBeVisible();

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
});
