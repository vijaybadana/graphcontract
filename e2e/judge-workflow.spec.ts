import type { Page } from '@playwright/test';

import {
  callWebMcpTool,
  expect,
  test,
  webMcpToolNames,
} from './fixtures';
import { downloadText } from './helpers/downloads';

type GraphNode = {
  id: string;
  label: string;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

type AcceptedGraph = {
  id: string;
  name: string;
  status: 'draft' | 'frozen';
  updatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  subgraphs: Array<{ id: string }>;
  relationships: Array<{ id: string }>;
};

type GraphRead = {
  ok: true;
  graph: AcceptedGraph;
  validation: { validForFreeze: boolean; issues: unknown[] };
  pendingProposal?: {
    id: string;
    status: string;
    rationale: string;
  };
};

type ProposalResult = {
  ok: boolean;
  proposal?: { status: string };
  error?: { code: string; message: string };
};

type Scenario = {
  id: string;
  name: string;
  orderedPath: string[];
  traversedEdges: Array<{ id: string; source: string; target: string }>;
  expectedTerminalOutcome: { kind: string; detail?: string };
};

type ScenarioRead = {
  ok: boolean;
  graphId?: string;
  scenarios?: Scenario[];
  error?: { code: string; message: string };
};

type ScenarioArtifact = {
  graphId: string;
  graphName: string;
  graphUpdatedAt: string;
  graphSchemaVersion: string;
  generatedAt: string;
  scenarios: Scenario[];
};

const flagship = {
  title: 'Hierarchical Deep Research',
  graphId: 'library-hierarchical-deep-research',
  nodeId: 'frame-question',
  acceptedLabel: 'Frame research question',
} as const;

async function readAcceptedGraph(page: Page) {
  const result = await callWebMcpTool<GraphRead>(page, 'get_graph', {});
  expect(result.ok).toBe(true);
  return result;
}

async function loadFlagshipGraph(page: Page) {
  await page.getByRole('button', { name: 'Graph library, 10 templates' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain(`Replace the current canvas with “${flagship.title}”?`);
    await dialog.accept();
  });
  await page.getByRole('button', { name: `Open ${flagship.title}` }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(async () => (await readAcceptedGraph(page)).graph.id)
    .toBe(flagship.graphId);
  await expect(page.getByTestId(`rf__node-${flagship.nodeId}`)).toBeVisible();
}

async function proposeFlagshipLabel(page: Page, label: string, rationale: string) {
  const accepted = await readAcceptedGraph(page);
  const result = await callWebMcpTool<ProposalResult>(page, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    rationale,
    operations: [
      {
        type: 'update_node',
        nodeId: flagship.nodeId,
        patch: { label },
      },
    ],
  });
  expect(result).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  return accepted;
}

async function approveAndFreezeFlagship(page: Page, label: string) {
  await loadFlagshipGraph(page);
  const before = await proposeFlagshipLabel(
    page,
    label,
    `Judge workflow approval for ${label}.`,
  );
  await page.getByRole('button', { name: 'Approve' }).click();
  const approved = await readAcceptedGraph(page);
  expect(approved.pendingProposal).toBeUndefined();
  expect(approved.graph.nodes.find((node) => node.id === flagship.nodeId)?.label).toBe(label);
  expect(approved.graph.nodes.filter((node) => node.id === flagship.nodeId)).toHaveLength(1);
  expect(approved.graph.updatedAt).not.toBe(before.graph.updatedAt);

  await page.getByRole('button', {
    name: 'Confirm and freeze contract; currently draft',
  }).click();
  const frozen = await readAcceptedGraph(page);
  expect(frozen.graph.status).toBe('frozen');
  expect(frozen.validation).toEqual({ validForFreeze: true, issues: [] });

  const scenarios = await callWebMcpTool<ScenarioRead>(page, 'get_branch_scenarios', {});
  expect(scenarios).toMatchObject({ ok: true, graphId: flagship.graphId });
  expect(scenarios.scenarios?.length).toBeGreaterThan(1);
  return { frozen, scenarios: scenarios.scenarios! };
}

async function selectScenario(page: Page, scenario: Scenario) {
  const row = page.locator(`button[data-scenario-id="${scenario.id}"]`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  return row;
}

async function expectExactScenarioEmphasis(
  page: Page,
  graph: AcceptedGraph,
  scenario: Scenario,
) {
  const activeNodeIds = new Set(scenario.orderedPath);
  const activeEdgeIds = new Set(scenario.traversedEdges.map((edge) => edge.id));

  for (const node of graph.nodes) {
    await expect(page.getByTestId(`rf__node-${node.id}`)).toHaveClass(
      activeNodeIds.has(node.id)
        ? /scenario-state--active/
        : /scenario-state--dimmed/,
    );
  }
  for (const edge of graph.edges) {
    await expect(page.getByTestId(`rf__edge-${edge.id}`)).toHaveClass(
      activeEdgeIds.has(edge.id)
        ? /scenario-state--active/
        : /scenario-state--dimmed/,
    );
  }
}

function stableArtifact(artifact: ScenarioArtifact) {
  return {
    graphId: artifact.graphId,
    graphName: artifact.graphName,
    graphUpdatedAt: artifact.graphUpdatedAt,
    graphSchemaVersion: artifact.graphSchemaVersion,
    scenarios: artifact.scenarios,
  };
}

test('J01 — read, propose, and reject leaves the accepted complex graph untouched', async ({ app }) => {
  await loadFlagshipGraph(app);
  const accepted = await readAcceptedGraph(app);
  expect(accepted.graph).toMatchObject({
    id: flagship.graphId,
    name: flagship.title,
    status: 'draft',
  });
  expect(accepted.graph.nodes).toHaveLength(7);
  expect(accepted.graph.edges).toHaveLength(8);
  expect(accepted.graph.subgraphs).toEqual([
    expect.objectContaining({ id: 'research-cell' }),
  ]);

  const candidateLabel = 'Unapproved judge framing';
  const proposal = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    rationale: 'J01 agent suggestion remains review-only.',
    operations: [
      {
        type: 'update_node',
        nodeId: flagship.nodeId,
        patch: { label: candidateLabel },
      },
    ],
  });
  expect(proposal).toMatchObject({ ok: true, proposal: { status: 'pending' } });

  const projection = app.getByRole('radiogroup', { name: 'Canvas projection' });
  await expect(projection.getByRole('radio', { name: 'Proposal', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(app.getByRole('region', { name: 'Before / Proposed' })).toBeVisible();
  const acceptedOverviewCanvas = app
    .getByRole('region', { name: 'Before / Proposed' })
    .locator('.proposal-overview-graph')
    .first()
    .locator('.proposal-overview-canvas');
  await expect(acceptedOverviewCanvas).toContainText(flagship.acceptedLabel);
  await expect(acceptedOverviewCanvas.getByText(candidateLabel, { exact: true })).toHaveCount(0);
  const pending = await readAcceptedGraph(app);
  expect(pending.graph).toEqual(accepted.graph);
  expect(pending.pendingProposal).toMatchObject({
    status: 'pending',
    rationale: 'J01 agent suggestion remains review-only.',
  });

  await app.getByRole('button', { name: 'Reject' }).click();
  const rejected = await readAcceptedGraph(app);
  expect(rejected.graph).toEqual(accepted.graph);
  expect(rejected.pendingProposal).toBeUndefined();
  await expect(app.getByRole('heading', { name: 'Before / Proposed' })).toHaveCount(0);
  await expect(app.getByText(candidateLabel, { exact: true })).toHaveCount(0);
  await expect(app.locator('[data-proposal-state]')).toHaveCount(0);
  await expect(app.getByTestId(`rf__node-${flagship.nodeId}`)).toContainText(
    flagship.acceptedLabel,
  );
});

test('J02 — corrected reproposal compares stable identity, approves once, and freezes', async ({ app }) => {
  await loadFlagshipGraph(app);
  const original = await proposeFlagshipLabel(
    app,
    'Draft judge framing',
    'J02 first draft for rejection.',
  );
  await app.getByRole('button', { name: 'Reject' }).click();
  expect((await readAcceptedGraph(app)).graph).toEqual(original.graph);

  const correctedLabel = 'Judge-ready research framing';
  await proposeFlagshipLabel(app, correctedLabel, 'J02 corrected agent proposal.');
  const comparison = app.getByRole('region', { name: 'Before / Proposed' });
  await expect(comparison.getByRole('heading', { name: 'Before', exact: true })).toBeVisible();
  await expect(comparison.getByRole('heading', { name: 'Proposed', exact: true })).toBeVisible();
  const identityDiff = comparison.getByLabel(`Changed values for ${flagship.nodeId}`);
  await expect(identityDiff).toContainText(flagship.acceptedLabel);
  await expect(identityDiff).toContainText(correctedLabel);
  await expect(comparison.getByLabel('Proposal diff summary')).toContainText(
    `updated ${flagship.nodeId} (label)`,
  );

  const approve = app.getByRole('button', { name: 'Approve' });
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(approve).toHaveCount(0);
  const approved = await readAcceptedGraph(app);
  expect(approved.pendingProposal).toBeUndefined();
  expect(approved.graph.nodes.filter((node) => node.id === flagship.nodeId)).toEqual([
    expect.objectContaining({ id: flagship.nodeId, label: correctedLabel }),
  ]);
  expect(approved.graph.updatedAt).not.toBe(original.graph.updatedAt);

  await app.getByRole('button', {
    name: 'Confirm and freeze contract; currently draft',
  }).click();
  const frozen = await readAcceptedGraph(app);
  expect(frozen.graph.status).toBe('frozen');
  const scenarios = await callWebMcpTool<ScenarioRead>(app, 'get_branch_scenarios', {});
  expect(scenarios).toMatchObject({ ok: true, graphId: flagship.graphId });
  expect(scenarios.scenarios?.length).toBeGreaterThan(1);
  await expect(
    app
      .getByRole('radiogroup', { name: 'Canvas projection' })
      .getByRole('radio', { name: 'Scenario', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('J03 — selected path emphasis and its artifact describe one accepted revision', async ({ app }) => {
  const { frozen, scenarios } = await approveAndFreezeFlagship(
    app,
    'Judge-approved research framing',
  );
  const selected = scenarios.find((scenario) =>
    scenario.orderedPath.includes('inspect-evidence'),
  );
  expect(selected).toBeDefined();
  await selectScenario(app, selected!);
  await expectExactScenarioEmphasis(app, frozen.graph, selected!);
  expect((await readAcceptedGraph(app)).graph).toEqual(frozen.graph);

  const filename = `graph-test-${selected!.id}.json`;
  const artifact = JSON.parse(await downloadText(app, filename)) as ScenarioArtifact;
  expect(artifact).toMatchObject({
    graphId: frozen.graph.id,
    graphName: frozen.graph.name,
    graphUpdatedAt: frozen.graph.updatedAt,
    graphSchemaVersion: '6',
  });
  expect(artifact.scenarios).toEqual([selected]);
  expect(artifact.scenarios[0]?.orderedPath).toEqual(selected!.orderedPath);
  expect(artifact.scenarios[0]?.traversedEdges).toEqual(selected!.traversedEdges);
});

test('J04 — approved frozen truth, scenarios, and downloads stay consistent after reload', async ({ app }) => {
  const { frozen, scenarios } = await approveAndFreezeFlagship(
    app,
    'Persisted judge-approved framing',
  );
  const selected = scenarios[0]!;
  await selectScenario(app, selected);
  const filename = `graph-test-${selected.id}.json`;
  const beforeReload = JSON.parse(await downloadText(app, filename)) as ScenarioArtifact;

  await app.reload();
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  const reloaded = await readAcceptedGraph(app);
  expect(reloaded.graph).toEqual(frozen.graph);
  expect(reloaded.graph).toMatchObject({
    id: flagship.graphId,
    status: 'frozen',
    updatedAt: frozen.graph.updatedAt,
  });
  expect(reloaded.pendingProposal).toBeUndefined();

  const reloadedScenarios = await callWebMcpTool<ScenarioRead>(app, 'get_branch_scenarios', {});
  expect(reloadedScenarios).toEqual({
    ok: true,
    graphId: flagship.graphId,
    scenarios,
  });
  const scenarioMode = app
    .getByRole('radiogroup', { name: 'Canvas projection' })
    .getByRole('radio', { name: 'Scenario', exact: true });
  await scenarioMode.click();
  await expect(scenarioMode).toHaveAttribute('aria-checked', 'true');
  await selectScenario(app, selected);
  const afterReload = JSON.parse(await downloadText(app, filename)) as ScenarioArtifact;
  expect(stableArtifact(afterReload)).toEqual(stableArtifact(beforeReload));
  expect(afterReload).toMatchObject({
    graphId: reloaded.graph.id,
    graphUpdatedAt: reloaded.graph.updatedAt,
  });
  expect(afterReload.scenarios).toHaveLength(1);
  expect(afterReload.scenarios[0]).toMatchObject({
    id: selected.id,
    name: selected.name,
    orderedPath: selected.orderedPath,
    expectedTerminalOutcome: selected.expectedTerminalOutcome,
  });
  expect(afterReload.scenarios[0]?.traversedEdges.map((edge) => edge.id)).toEqual(
    selected.traversedEdges.map((edge) => edge.id),
  );

  const graphArtifact = JSON.parse(
    await downloadText(app, 'graph-contract.json'),
  ) as AcceptedGraph;
  expect(graphArtifact).toEqual(reloaded.graph);
});
