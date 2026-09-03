import {
  callWebMcpTool,
  expect,
  loadGraphLibraryEntry,
  test,
  webMcpToolMetadata,
  webMcpToolNames,
} from './fixtures';
import { downloadText } from './helpers/downloads';

type GraphRead = {
  ok: true;
  graph: {
    id: string;
    name: string;
    status: 'draft' | 'frozen';
    updatedAt: string;
    nodes: Array<{
      id: string;
      kind: string;
      label: string;
      executor?: string;
      merge?: { reducer: { name: string; aggregateState: string } };
    }>;
    edges: Array<{
      id: string;
      mode: string;
      target: string;
      send?: {
        destinationTemplateId: string;
        multiplicity: string;
        payloadLabel: string;
        mergeNodeId: string;
        payloadSchemaRef?: string;
      };
    }>;
  };
  validation: { validForFreeze: boolean; issues: Array<{ code: string }> };
  pendingProposal?: { status: string; rationale: string };
};

type ProposalResult = {
  ok: boolean;
  proposal?: { status: string };
  error?: { code: string; message: string };
};

type ScenarioResult = {
  ok: boolean;
  graphId?: string;
  scenarios?: Array<{
    orderedPath: string[];
    traversedEdges: Array<{ id: string; mode: string; isLoop?: boolean; loopCap?: number }>;
    dynamicSends: Array<{
      edgeId: string;
      templateNodeId: string;
      destinationTemplateId: string;
      multiplicity: string;
      payloadLabel: string;
      mergeNodeId: string;
      payloadSchemaRef?: string;
    }>;
    merges: Array<{
      nodeId: string;
      reducer: { name: string; aggregateState: string };
      completion: { mode: string };
      continuation: { mode: string };
    }>;
  }>;
};

async function loadParallelResearchDemo(app: Parameters<typeof callWebMcpTool>[0]) {
  await loadGraphLibraryEntry(app, 'Parallel research · Send ×N', 'dynamic-parallelism-merge-demo');
  await expect(app.getByTestId('rf__node-generate-queries')).toBeVisible();
  await expect.poll(async () => (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph.id).toBe(
    'dynamic-parallelism-merge-demo',
  );
}

const parallelProposal = (expectedGraphUpdatedAt: string) => ({
  expectedGraphUpdatedAt,
  rationale: 'E2E P3 review-only Send and Merge refinement.',
  operations: [
    {
      type: 'update_edge',
      edgeId: 'parallel-send-search',
      patch: {
        mode: 'send',
        label: 'Dispatch research queries',
        send: {
          destinationTemplateId: 'search-evidence',
          multiplicity: 'dynamic',
          payloadLabel: 'research query',
          mergeNodeId: 'merge-evidence',
          payloadSchemaRef: 'ResearchQuery',
        },
      },
    },
    {
      type: 'update_node',
      nodeId: 'merge-evidence',
      patch: {
        merge: {
          reducer: { name: 'append_evidence', aggregateState: 'evidence' },
          completion: { mode: 'all' },
          continuation: { mode: 'once' },
          waitingForDynamicInputs: true,
        },
      },
    },
    { type: 'remove_edge', edgeId: 'parallel-reflect-end' },
    {
      type: 'add_edge',
      edge: {
        id: 'parallel-reflect-complete',
        source: 'reflect',
        target: 'parallel-end',
        mode: 'conditional',
        label: 'complete',
        condition: 'state.complete === true',
      },
    },
    {
      type: 'add_edge',
      edge: {
        id: 'parallel-reflect-refine',
        source: 'reflect',
        target: 'generate-queries',
        mode: 'conditional',
        label: 'refine',
        condition: 'state.complete === false',
        loopCap: 2,
      },
    },
  ],
});

test('confirmed Send ×N demo keeps one template and one Merge in design while exposing their contract inspection', async ({ app }) => {
  await expect(app.getByRole('radio', { name: /Runtime unavailable: No runtime trace or fixture is available/ })).toBeDisabled();
  await loadParallelResearchDemo(app);

  const read = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(read).toMatchObject({
    graph: { name: 'Parallel research · Send ×N', status: 'draft' },
    validation: { validForFreeze: true },
  });
  expect(read.graph.nodes).toHaveLength(6);
  expect(read.graph.nodes.filter((node) => node.id === 'search-evidence')).toHaveLength(1);
  expect(read.graph.nodes.filter((node) => node.kind === 'merge')).toHaveLength(1);
  expect(read.graph.nodes.find((node) => node.kind === 'merge')).toMatchObject({
    id: 'merge-evidence',
    merge: { reducer: { name: 'concatenate', aggregateState: 'evidence' } },
  });
  expect(read.graph.nodes.some((node) => node.id.startsWith('runtime:'))).toBe(false);
  expect(read.graph.edges.find((edge) => edge.id === 'parallel-send-search')).toMatchObject({
    mode: 'send',
    target: 'search-evidence',
    send: {
      destinationTemplateId: 'search-evidence',
      multiplicity: 'dynamic',
      payloadLabel: 'query',
      mergeNodeId: 'merge-evidence',
      payloadSchemaRef: 'ResearchQuery',
    },
  });
  await expect(app.locator('.runtime-instance-node')).toHaveCount(0);

  await app.getByTestId('rf__node-merge-evidence').click();
  await expect(app.getByRole('heading', { name: 'Merge reducer' })).toBeVisible();
  await expect(app.getByLabel('Merge reducer name')).toHaveValue('concatenate');
  await expect(app.getByLabel('Merge aggregate state')).toHaveValue('evidence');
  await expect(app.getByText('Waits for dynamic Send inputs. It is a structural junction, not a work Step.')).toBeVisible();

  await app.getByTestId('rf__edge-parallel-send-search').click();
  await expect(app.getByRole('heading', { name: 'Edge routing' })).toBeVisible();
  await expect(app.getByText('Send ×N · dynamic worker template')).toBeVisible();
  await expect(app.getByLabel('Send payload label')).toHaveValue('query');
  await expect(app.getByLabel('Send payload schema reference')).toHaveValue('ResearchQuery');
  await expect(app.locator('[data-edge-id="parallel-send-search"]')).toHaveAttribute('data-mode', 'send');
});

test('invalid Send payload and Merge reducer stay visibly invalid and cannot freeze the design contract', async ({ app }) => {
  await loadParallelResearchDemo(app);

  await app.getByTestId('rf__edge-parallel-send-search').click();
  await app.getByLabel('Send payload label').fill('');
  await expect(app.locator('[data-edge-id="parallel-send-search"]')).toHaveAttribute('data-invalid', 'true');
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();

  await app.getByTestId('rf__node-merge-evidence').click();
  await app.getByLabel('Merge reducer name').fill('');
  await expect(app.getByTestId('rf__node-merge-evidence').locator('.merge-node-shell')).toHaveAttribute('data-invalid', 'true');
  await expect(app.getByLabel('Invalid Merge')).toBeVisible();

  const invalid = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(invalid.validation.validForFreeze).toBe(false);
  expect(invalid.validation.issues.map((issue) => issue.code)).toEqual(
    expect.arrayContaining(['SEND_PAYLOAD_LABEL_REQUIRED', 'MERGE_REDUCER_REQUIRED']),
  );
});

test('Design, Runtime, Proposal, and Scenario remain read-only presentations over accepted truth', async ({ app }) => {
  await loadParallelResearchDemo(app);
  const acceptedBefore = (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph;
  const projection = app.getByRole('radiogroup', { name: 'Canvas projection' });
  const mode = (label: string) => projection.getByRole('radio', {
    name: new RegExp(`^${label}(?: unavailable:.*)?$`),
  });

  await expect(mode('Design')).toHaveAttribute('aria-checked', 'true');
  await expect(mode('Scenario')).toBeDisabled();
  await expect(mode('Proposal')).toBeDisabled();
  await expect(mode('Runtime')).toBeEnabled();
  await mode('Runtime').click();
  await expect(mode('Runtime')).toHaveAttribute('aria-checked', 'true');
  await expect(app.getByText(/Runtime projection is read-only/)).toBeVisible();
  await expect(app.locator('.canvas-instruction-strip')).toHaveCount(0);
  await expect(app.locator('.runtime-instance-node')).toHaveCount(3);
  await expect(app.locator('.runtime-instance-node[data-template-node-id="search-evidence"]')).toHaveCount(3);
  await expect(app.getByText('Search evidence · query 1', { exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Agent', exact: true })).toBeDisabled();

  await app.getByTestId('rf__node-runtime:research-worker-1').click();
  await expect(app.getByText('Observed trace projection — read-only. This instance is not part of the accepted graph and cannot change the contract.')).toBeVisible();
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toEqual(acceptedBefore);

  await mode('Design').click();
  await expect(app.locator('.runtime-instance-node')).toHaveCount(0);
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toEqual(acceptedBefore);

  expect(await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: acceptedBefore.updatedAt,
    rationale: 'E2E presentation-only proposal review.',
    operations: [
      { type: 'update_node', nodeId: 'generate-queries', patch: { label: 'Proposed query planner' } },
    ],
  })).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  await expect(mode('Proposal')).toHaveAttribute('aria-checked', 'true');
  await expect(mode('Design')).toBeDisabled();
  await expect(mode('Scenario')).toBeDisabled();
  await expect(mode('Runtime')).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Confirm and freeze contract; currently draft' })).toBeDisabled();
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toEqual(acceptedBefore);

  await app.getByRole('button', { name: 'Reject' }).click();
  await expect(mode('Design')).toHaveAttribute('aria-checked', 'true');
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toEqual(acceptedBefore);

  await app.getByRole('button', { name: 'Confirm and freeze contract; currently draft' }).click();
  await expect(mode('Scenario')).toHaveAttribute('aria-checked', 'true');
  const frozen = (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph;
  expect(frozen.status).toBe('frozen');
  expect(frozen.nodes).toEqual(acceptedBefore.nodes);
  expect(frozen.edges).toEqual(acceptedBefore.edges);

  await app.getByRole('button', { name: 'Unfreeze contract; currently frozen' }).click();
  await expect(mode('Design')).toHaveAttribute('aria-checked', 'true');
  const unfrozen = (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph;
  expect(unfrozen.status).toBe('draft');
  expect(unfrozen.nodes).toEqual(acceptedBefore.nodes);
  expect(unfrozen.edges).toEqual(acceptedBefore.edges);
});

test('three review-only tools preserve P3 proposal authority and frozen Send scenario/download metadata', async ({ app }) => {
  await loadParallelResearchDemo(app);
  expect(await webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  const propose = await webMcpToolMetadata(app, 'propose_graph_changes');
  const schema = JSON.stringify(propose.inputSchema);
  expect(schema).toContain('"send"');
  expect(schema).toContain('"merge"');
  expect(schema).toContain('"loopCap"');
  expect(propose.description).toContain('never creates runtime workers');
  expect(propose.description).toContain('cannot approve, reject, respond, resume, freeze, unfreeze');
  expect(propose.description).toContain('mutate runtime projections');

  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const candidate = parallelProposal(accepted.graph.updatedAt);
  expect(await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', candidate)).toMatchObject({
    ok: true,
    proposal: { status: 'pending' },
  });
  const pending = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(pending.graph).toEqual(accepted.graph);
  expect(pending.pendingProposal).toMatchObject({ status: 'pending', rationale: candidate.rationale });
  await expect(app.getByRole('button', { name: 'Agent', exact: true })).toBeDisabled();
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();

  await app.getByRole('button', { name: 'Approve' }).click();
  const approved = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(approved.pendingProposal).toBeUndefined();
  expect(approved.graph.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'parallel-reflect-complete', mode: 'conditional' }),
    expect.objectContaining({ id: 'parallel-reflect-refine', mode: 'conditional', target: 'generate-queries' }),
  ]));
  await app.getByRole('button', { name: /confirm (?:and|&) freeze/i }).click();
  const frozen = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(frozen.graph.status).toBe('frozen');
  const firstScenarios = await callWebMcpTool<ScenarioResult>(app, 'get_branch_scenarios', {});
  const secondScenarios = await callWebMcpTool<ScenarioResult>(app, 'get_branch_scenarios', {});
  expect(secondScenarios).toEqual(firstScenarios);
  expect(firstScenarios).toMatchObject({
    ok: true,
    graphId: 'dynamic-parallelism-merge-demo',
    scenarios: expect.any(Array),
  });
  expect(firstScenarios.scenarios).toHaveLength(3);
  for (const scenario of firstScenarios.scenarios ?? []) {
    expect(scenario.dynamicSends).toEqual(expect.arrayContaining([expect.objectContaining({
      edgeId: 'parallel-send-search',
      templateNodeId: 'search-evidence',
      destinationTemplateId: 'search-evidence',
      multiplicity: 'dynamic',
      payloadLabel: 'research query',
      mergeNodeId: 'merge-evidence',
      payloadSchemaRef: 'ResearchQuery',
    })]));
    expect(scenario.merges).toEqual(expect.arrayContaining([expect.objectContaining({
      nodeId: 'merge-evidence',
      reducer: { name: 'append_evidence', aggregateState: 'evidence' },
      completion: { mode: 'all' },
      continuation: { mode: 'once' },
    })]));
    expect(scenario.traversedEdges.filter((edge) => edge.id === 'parallel-reflect-refine').length).toBeLessThanOrEqual(2);
  }
  expect((firstScenarios.scenarios ?? []).map((scenario) =>
    scenario.traversedEdges.filter((edge) => edge.id === 'parallel-reflect-refine').length,
  ).sort()).toEqual([0, 1, 2]);

  const showInspector = app.getByRole('button', { name: 'Show inspector' });
  if (await showInspector.count()) await showInspector.click();
  await app.getByRole('tab', { name: 'Scenarios (3)' }).click();
  const graphDownload = JSON.parse(await downloadText(app, 'graph-contract.json')) as {
    nodes: Array<{ id: string }>;
    edges: Array<{ id: string; mode: string; loopCap?: number; send?: { multiplicity: string; payloadSchemaRef?: string } }>;
  };
  expect(graphDownload.nodes.some((node) => node.id.startsWith('runtime:'))).toBe(false);
  expect(graphDownload.edges.find((edge) => edge.id === 'parallel-send-search')).toMatchObject({
    mode: 'send',
    send: { multiplicity: 'dynamic', payloadSchemaRef: 'ResearchQuery' },
  });
  expect(graphDownload.edges.find((edge) => edge.id === 'parallel-reflect-refine')).toMatchObject({
    mode: 'conditional',
    loopCap: 2,
  });
  const scenarioDownload = JSON.parse(await downloadText(app, 'graph-test-scenarios.json')) as {
    scenarios: ScenarioResult['scenarios'];
  };
  expect(scenarioDownload.scenarios).toEqual(firstScenarios.scenarios);
  const pythonDownload = await downloadText(app, 'test_graph_paths.py');
  expect(pythonDownload).toContain('"dynamic_sends"');
  expect(pythonDownload).toContain('"merges"');
  expect(pythonDownload).not.toContain('research-worker-1');

  expect(await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    ...candidate,
    expectedGraphUpdatedAt: frozen.graph.updatedAt,
  })).toEqual({
    ok: false,
    error: { code: 'GRAPH_FROZEN', message: 'Unfreeze the graph before requesting changes.' },
  });
});
