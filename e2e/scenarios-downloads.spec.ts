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

  const selected = scenarioArtifact.scenarios[0];
  const scenarioRow = app.locator(`button[data-scenario-id="${selected.id}"]`);
  await scenarioRow.click();
  await expect(scenarioRow).toHaveAttribute('aria-pressed', 'true');
  await expect(app.locator('.scenario-state--active').first()).toHaveCSS('opacity', '1');
  await expect(app.locator('.scenario-state--dimmed').first()).toHaveCSS('opacity', '0.22');

  const selectedDownloads = app.getByLabel(`Downloads for ${selected.name}`);
  const jsonFilename = `graph-test-${selected.id}.json`;
  const pythonFilename = `test_graph_path_${selected.id.replaceAll('-', '_')}.py`;
  await expect(selectedDownloads.getByRole('link', { name: `Download ${jsonFilename}` })).toBeVisible();
  await expect(selectedDownloads.getByRole('link', { name: `Download ${pythonFilename}` })).toBeVisible();

  const oneCaseJson = JSON.parse(await downloadText(app, jsonFilename)) as {
    scenarios: Scenario[];
  };
  expect(oneCaseJson.scenarios).toHaveLength(1);
  expect(oneCaseJson.scenarios[0]).toMatchObject({
    id: selected.id,
    orderedPath: selected.orderedPath,
    expectedTerminalOutcome: selected.expectedTerminalOutcome,
  });

  const oneCasePython = await downloadText(app, pythonFilename);
  expect(oneCasePython).toContain(`"id": "${selected.id}"`);
  expect(oneCasePython).not.toContain(`"id": "${scenarioArtifact.scenarios[1].id}"`);
  await expect(app.getByRole('link', { name: 'Download graph-test-scenarios.json' })).toBeVisible();
  await expect(app.getByRole('link', { name: 'Download test_graph_paths.py' })).toBeVisible();
});
