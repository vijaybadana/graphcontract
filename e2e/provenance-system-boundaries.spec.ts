import {
  callWebMcpTool,
  confirmGraphLibraryReplacement,
  expect,
  test,
  webMcpToolNames,
} from './fixtures';
import { downloadText } from './helpers/downloads';

type Relationship = {
  id: string;
  kind: 'spawned-run' | 'spawned-thread' | 'external-orchestration';
  label?: string;
  source: { kind: 'node'; nodeId: string } | { kind: 'external'; externalId: string; label: string };
  target: { kind: 'node'; nodeId: string } | { kind: 'external'; externalId: string; label: string };
  provenance: {
    representation: 'declared' | 'external-orchestration';
    evidence?: { source: string; evidenceClass: string; confidence: 'low' | 'medium' | 'high' };
  };
};

type GraphRead = {
  ok: true;
  graph: {
    id: string;
    schemaVersion: string;
    status: 'draft' | 'frozen';
    updatedAt: string;
    capabilities: { provenance: { evidenceOverlayAvailable: boolean; externalOrchestrationAvailable: boolean } };
    nodes: Array<{
      id: string;
      label: string;
      readiness?: { state: string; detail?: string };
      opaque?: { factoryLabel: string; inputPorts: Array<{ name: string }>; outputPorts: Array<{ name: string }> };
      outcome?: { kind: string; detail?: string };
    }>;
    edges: Array<{ id: string; source: string; target: string; mode: string }>;
    relationships: Relationship[];
  };
  pendingProposal?: { status: string; rationale: string };
};

type ProposalResult = {
  ok: boolean;
  proposal?: { status: 'pending' | 'invalid' };
  error?: { code: string; message: string };
};

type ScenarioResult = {
  ok: boolean;
  scenarios?: Array<{
    id: string;
    name: string;
    orderedPath: string[];
    traversedEdges: Array<{ source: string; target: string }>;
    relationshipAnnotations: Array<{ relationshipId?: string; family: string }>;
  }>;
};

const externalRelationship = (id: string, label: string, externalId: string): Relationship => ({
  id,
  kind: 'external-orchestration',
  source: { kind: 'node', nodeId: 'classifier' },
  target: { kind: 'external', externalId, label },
  label,
  provenance: {
    representation: 'external-orchestration',
    evidence: {
      source: `https://example.test/contracts/${externalId}`,
      evidenceClass: 'external-contract',
      confidence: 'medium',
    },
  },
});

async function submitAndApprove(
  app: Parameters<typeof callWebMcpTool>[0],
  operations: unknown[],
  rationale: string,
) {
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const result = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    operations,
    rationale,
  });
  expect(result).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  await app.getByRole('button', { name: 'Approve' }).click();
  return callWebMcpTool<GraphRead>(app, 'get_graph', {});
}

test('schema-v6 provenance, opaque/readiness/outcome, and a boundary relationship remain review-only until human approval', async ({ app }) => {
  const canvas = app.getByRole('application');
  expect(await webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const relation = externalRelationship('classifier-dispatch', 'Dispatch system', 'dispatch-system');
  const proposal = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    rationale: 'E2E v6 provenance and system-boundary review.',
    operations: [
      {
        type: 'update_graph_capabilities',
        patch: { provenance: { externalOrchestrationAvailable: true } },
      },
      {
        type: 'update_node',
        nodeId: 'classifier',
        patch: {
          readiness: { state: 'degraded', detail: 'Falls back to deterministic classification.' },
          opaque: {
            factoryLabel: 'create_support_classifier',
            inputPorts: [{ name: 'request' }],
            outputPorts: [{ name: 'route' }],
            runtimeInspection: { available: false },
          },
        },
      },
      { type: 'update_node', nodeId: 'end', patch: { outcome: { kind: 'completed' } } },
      {
        type: 'update_edge',
        edgeId: 'start-classifier',
        patch: {
          provenance: {
            representation: 'derived-semantic',
            evidence: {
              source: 'docs/support-routing.md',
              evidenceClass: 'reviewed-design',
              confidence: 'high',
            },
          },
        },
      },
      { type: 'add_relationship', relationship: relation },
    ],
  });

  expect(proposal).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  const pending = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(pending.graph).toEqual(accepted.graph);
  expect(pending.pendingProposal).toMatchObject({ status: 'pending' });
  await expect(canvas.getByTestId('rf__node-classifier').getByLabel(/Opaque or prebuilt/)).toBeVisible();
  await expect(canvas.getByTestId('rf__node-classifier').getByLabel(/Degraded readiness/)).toBeVisible();
  await expect(canvas.getByLabel('External system Dispatch system. Projection-only boundary tile.')).toBeVisible();

  await app.getByRole('button', { name: 'Review added classifier-dispatch', exact: true }).click();
  await expect(app.getByRole('heading', { name: 'classifier-dispatch', exact: true })).toBeVisible();
  await expect(app.getByLabel('Added: https://example.test/contracts/dispatch-system', { exact: true })).toBeVisible();
  await expect(app.getByLabel('Added: external-contract', { exact: true })).toBeVisible();
  await expect(app.getByLabel('Added: medium', { exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'Back to proposal', exact: true }).click();

  await app.getByRole('button', { name: /External orchestration: Dispatch system\. Proposed added\. Not a native control edge/ }).click();
  await expect(app.getByRole('heading', { name: 'classifier-dispatch', exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Agent', exact: true })).toBeDisabled();
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();
  await app.getByRole('button', { name: 'Back to proposal', exact: true }).click();

  const secondProposal = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    rationale: 'E2E must not replace a pending proposal.',
    operations: [{ type: 'update_node', nodeId: 'classifier', patch: { label: 'Not accepted' } }],
  });
  expect(secondProposal.error?.code).toBe('PENDING_PROPOSAL_EXISTS');

  await app.getByRole('button', { name: 'Approve' }).click();
  const approved = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(approved.graph).toMatchObject({ schemaVersion: '6', relationships: [relation] });
  expect(approved.graph.nodes.find((node) => node.id === 'classifier')).toMatchObject({
    readiness: { state: 'degraded' },
    opaque: { factoryLabel: 'create_support_classifier', inputPorts: [{ name: 'request' }], outputPorts: [{ name: 'route' }] },
  });
  expect(approved.graph.nodes.find((node) => node.id === 'end')?.outcome).toEqual({ kind: 'completed' });

  await app.getByRole('button', { name: /External orchestration: Dispatch system\..*Not a native control edge/ }).click();
  await expect(app.getByRole('heading', { name: 'Dispatch system', exact: true })).toBeVisible();
  await expect(app.getByRole('status').filter({ hasText: 'External relationship · read-only' })).toBeVisible();
  await expect(app.getByRole('status').filter({ hasText: 'Not a native control edge.' })).toBeVisible();

  await canvas.getByTestId('rf__node-classifier').click();
  await expect(app.getByText('Opaque / prebuilt Step', { exact: true })).toBeVisible();
  await expect(app.getByLabel('Opaque factory label')).toHaveValue('create_support_classifier');
  await expect(app.getByLabel('Opaque input ports')).toHaveValue('request');
  await expect(app.getByLabel('Opaque output ports')).toHaveValue('route');

  await app.getByRole('button', { name: /confirm (?:and|&) freeze/i }).click();
  const frozen = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(frozen.graph.status).toBe('frozen');
  const frozenProposal = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: frozen.graph.updatedAt,
    rationale: 'E2E frozen provenance change.',
    operations: [{ type: 'update_relationship', relationshipId: relation.id, patch: { label: 'Forbidden edit' } }],
  });
  expect(frozenProposal.error?.code).toBe('GRAPH_FROZEN');

  const scenarios = await callWebMcpTool<ScenarioResult>(app, 'get_branch_scenarios', {});
  expect(scenarios.ok).toBe(true);
  for (const scenario of scenarios.scenarios ?? []) {
    expect(scenario.orderedPath).not.toContain('dispatch-system');
    expect(scenario.traversedEdges.flatMap((edge) => [edge.source, edge.target])).not.toContain('dispatch-system');
    expect(scenario.relationshipAnnotations).toEqual(expect.arrayContaining([
      expect.objectContaining({ relationshipId: relation.id, family: 'external-orchestration' }),
    ]));
  }

  const projection = app.getByRole('radiogroup', { name: 'Canvas projection' });
  await expect(projection.getByRole('radio', { name: 'Scenario', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(app.getByRole('region', { name: 'Scenarios panel' })).toBeVisible();
  const graphDownload = JSON.parse(await downloadText(app, 'graph-contract.json')) as { relationships: Relationship[] };
  const scenarioDownload = JSON.parse(await downloadText(app, 'graph-test-scenarios.json')) as {
    graphRelationships: Relationship[];
    scenarios: Array<{ orderedPath: string[]; relationshipAnnotations: Array<{ relationshipId?: string }> }>;
  };
  expect(graphDownload.relationships).toEqual([relation]);
  expect(scenarioDownload.graphRelationships).toEqual([relation]);
  expect(scenarioDownload.scenarios.every((scenario) => !scenario.orderedPath.includes('dispatch-system'))).toBe(true);
  expect(scenarioDownload.scenarios.every((scenario) => scenario.relationshipAnnotations.some((annotation) => annotation.relationshipId === relation.id))).toBe(true);

  await app.reload();
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  const reloaded = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(reloaded.graph).toMatchObject({ schemaVersion: '6', status: 'frozen', relationships: [relation] });
});

test('relationship add, update, and removal previews are projection-only and rejection keeps accepted boundaries intact', async ({ app }) => {
  const canvas = app.getByRole('application');
  const first = externalRelationship('accepted-runner', 'Accepted runner', 'accepted-runner-system');
  const second = externalRelationship('accepted-archive', 'Accepted archive', 'accepted-archive-system');
  const bootstrapped = await submitAndApprove(
    app,
    [
      {
        type: 'update_graph_capabilities',
        patch: { provenance: { externalOrchestrationAvailable: true } },
      },
      { type: 'add_relationship', relationship: first },
      { type: 'add_relationship', relationship: second },
    ],
    'E2E accepted relationship setup.',
  );
  const acceptedRelationships = bootstrapped.graph.relationships;
  const acceptedEdges = bootstrapped.graph.edges;

  const candidate = externalRelationship('candidate-queue', 'Candidate queue', 'candidate-queue-system');
  const result = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: bootstrapped.graph.updatedAt,
    rationale: 'E2E review external relationship add, update, and removal.',
    operations: [
      { type: 'update_relationship', relationshipId: first.id, patch: { label: 'Candidate runner' } },
      { type: 'remove_relationship', relationshipId: second.id },
      { type: 'add_relationship', relationship: candidate },
    ],
  });
  expect(result).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  const pending = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(pending.graph.relationships).toEqual(acceptedRelationships);
  expect(pending.graph.edges).toEqual(acceptedEdges);

  await expect(app.getByRole('button', { name: /External orchestration: Candidate queue\. Proposed added/ })).toBeVisible();
  await expect(app.getByRole('button', { name: /External orchestration: Candidate runner\. Proposed updated/ })).toBeVisible();
  await expect(app.getByRole('button', { name: /External orchestration: Accepted archive\. Removed · accepted record/ })).toBeVisible();
  await expect(canvas.getByLabel('External system Candidate queue. Projection-only boundary tile.')).toBeVisible();

  await app.getByRole('button', { name: 'Reject' }).click();
  const rejected = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(rejected.pendingProposal).toBeUndefined();
  expect(rejected.graph.relationships).toEqual(acceptedRelationships);
  expect(rejected.graph.edges).toEqual(acceptedEdges);
  await expect(app.getByText('Candidate queue', { exact: true })).toHaveCount(0);
  await expect(app.getByText('Candidate runner', { exact: true })).toHaveCount(0);
});

test('selected scenarios preserve collapsed native proxies and dim unrelated non-native relationships', async ({ app }) => {
  const canvas = app.getByRole('application');
  await app.getByRole('button', { name: 'Workflow library, 14 templates' }).click();
  await expect(app.getByRole('dialog')).toBeVisible();
  await app.getByRole('button', { name: 'Open Hierarchical Deep Research' }).click();
  await confirmGraphLibraryReplacement(app, 'Hierarchical Deep Research');
  await expect.poll(async () => (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph.id).toBe(
    'library-hierarchical-deep-research',
  );

  const relationship = (
    id: string,
    nodeId: string,
    externalId: string,
    label: string,
  ): Relationship => ({
    id,
    kind: 'external-orchestration',
    source: { kind: 'node', nodeId },
    target: { kind: 'external', externalId, label },
    label,
    provenance: {
      representation: 'external-orchestration',
      evidence: {
        source: `https://example.test/contracts/${externalId}`,
        evidenceClass: 'external-contract',
        confidence: 'medium',
      },
    },
  });
  const activeRelationship = relationship(
    'frame-review-boundary',
    'frame-question',
    'review-boundary',
    'Review boundary',
  );
  const dimmedRelationship = relationship(
    'evidence-archive-boundary',
    'inspect-evidence',
    'archive-boundary',
    'Archive boundary',
  );
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const proposal = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    rationale: 'E2E collapsed scenario system-boundary projection.',
    operations: [
      {
        type: 'update_graph_capabilities',
        patch: { provenance: { externalOrchestrationAvailable: true } },
      },
      { type: 'add_relationship', relationship: activeRelationship },
      { type: 'add_relationship', relationship: dimmedRelationship },
    ],
  });
  expect(proposal).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  await app.getByRole('button', { name: 'Approve' }).click();
  await app.getByRole('button', { name: 'Collapse inspector' }).click();
  await app.getByRole('button', { name: 'Collapse subgraph Research Supervisor' }).click();
  await app.getByRole('button', { name: 'Confirm and freeze contract; currently draft' }).click();

  const frozen = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const scenarios = await callWebMcpTool<ScenarioResult>(app, 'get_branch_scenarios', {});
  const selected = scenarios.scenarios?.find((scenario) =>
    scenario.orderedPath.includes('frame-question') &&
    !scenario.orderedPath.includes('inspect-evidence'),
  );
  expect(selected).toBeDefined();
  expect(selected?.relationshipAnnotations).toEqual(expect.arrayContaining([
    expect.objectContaining({ relationshipId: activeRelationship.id, family: 'external-orchestration' }),
  ]));
  expect(selected?.relationshipAnnotations).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ relationshipId: dimmedRelationship.id }),
  ]));

  const scenarioRow = app.locator(`button[data-scenario-id="${selected!.id}"]`);
  await scenarioRow.click();
  await expect(scenarioRow).toHaveAttribute('aria-pressed', 'true');

  const proxy = canvas.getByTestId('rf__edge-subgraph-proxy:write-brief:research-cell');
  const activeBoundary = canvas.getByTestId('rf__edge-system-relationship:frame-review-boundary');
  const dimmedBoundary = canvas.getByTestId('rf__edge-system-relationship:evidence-archive-boundary');
  await expect(proxy).toHaveClass(/scenario-state--active/);
  await expect(proxy).toHaveCSS('opacity', '1');
  await expect(activeBoundary).toHaveClass(/scenario-state--active/);
  await expect(activeBoundary).toHaveCSS('opacity', '1');
  await expect(dimmedBoundary).toHaveClass(/scenario-state--dimmed/);
  await expect(dimmedBoundary).toHaveCSS('opacity', '0.18');
  await expect(canvas.getByTestId('rf__node-external-system:review-boundary')).toHaveClass(/scenario-state--active/);
  await expect(canvas.getByTestId('rf__node-external-system:archive-boundary')).toHaveClass(/scenario-state--dimmed/);
  await expect(app.getByRole('button', { name: /External orchestration: Review boundary.*Not a native control edge/ })).toBeVisible();

  const afterSelection = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(afterSelection.graph).toEqual(frozen.graph);
  expect(afterSelection.graph.edges.some((edge) => edge.id.startsWith('subgraph-proxy:'))).toBe(false);
  expect(afterSelection.graph.relationships).toEqual([activeRelationship, dimmedRelationship]);
  expect(selected?.traversedEdges.flatMap((edge) => [edge.source, edge.target])).not.toEqual(
    expect.arrayContaining(['review-boundary', 'archive-boundary']),
  );
});
