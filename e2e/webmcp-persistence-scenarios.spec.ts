import {
  callWebMcpTool,
  expect,
  freezeResearchIntake,
  loadResearchIntake,
  test,
  webMcpToolMetadata,
  webMcpToolNames,
} from './fixtures';

type GraphRead = {
  ok: true;
  graph: {
    id: string;
    name: string;
    status: 'draft' | 'frozen';
    updatedAt: string;
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ id: string; mode: string }>;
  };
  validation: { validForFreeze: boolean; issues: unknown[] };
  pendingProposal?: { id: string; status: string; rationale: string };
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
    id: string;
    name: string;
    orderedPath: string[];
    traversedEdges: Array<{ id: string; isLoop?: boolean }>;
  }>;
  error?: { code: string; message: string };
};

const updateClassifier = (label: string, expectedGraphUpdatedAt: string) => ({
  expectedGraphUpdatedAt,
  operations: [{ type: 'update_node', nodeId: 'classifier', patch: { label } }],
  rationale: `E2E proposal: ${label}`,
});

const classifierLabel = (read: GraphRead) =>
  read.graph.nodes.find((node) => node.id === 'classifier')?.label;

test('registered WebMCP tools publish constrained schemas and truthful annotations', async ({ app }) => {
  expect(await webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  const read = await webMcpToolMetadata(app, 'get_graph');
  const propose = await webMcpToolMetadata(app, 'propose_graph_changes');
  const scenarios = await webMcpToolMetadata(app, 'get_branch_scenarios');

  expect(read).toMatchObject({
    title: 'Read the accepted workflow graph',
    inputSchema: { type: 'object', additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false },
  });
  expect(scenarios).toMatchObject({
    inputSchema: { type: 'object', additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false },
  });
  expect(propose.annotations).toEqual({ readOnlyHint: false, destructiveHint: false });
  expect(propose.inputSchema).toMatchObject({
    type: 'object',
    required: ['operations', 'rationale'],
    additionalProperties: false,
  });
  const schemaText = JSON.stringify(propose.inputSchema);
  for (const mode of ['normal', 'conditional', 'command', 'fallback']) {
    expect(schemaText).toContain(`\"${mode}\"`);
  }
  expect(schemaText).not.toContain('"loop"');
});

test('invalid proposal is visible but cannot be approved', async ({ app }) => {
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const result = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    operations: [{ type: 'remove_node', nodeId: 'end' }],
    rationale: 'E2E invalid proposal removes the required End node.',
  });

  expect(result).toMatchObject({ ok: true, proposal: { status: 'invalid' } });
  await expect(app.getByText('invalid', { exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Reject' })).toBeEnabled();
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph.nodes).toHaveLength(7);
});

test('pending proposal locks palette authoring and freeze without changing accepted truth', async ({ app }) => {
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  await callWebMcpTool<ProposalResult>(
    app,
    'propose_graph_changes',
    updateClassifier('Locked Preview', accepted.graph.updatedAt),
  );

  for (const name of ['Agent', 'Action / function', 'Tool', 'Human Input', 'Subgraph']) {
    await expect(app.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Reset example graph' })).toBeDisabled();
  const locked = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(classifierLabel(locked)).toBe('Classifier Agent');
  expect(locked.graph.id).toBe(accepted.graph.id);
  expect(locked.pendingProposal).toMatchObject({
    status: 'pending',
    rationale: 'E2E proposal: Locked Preview',
  });
  await expect(app.getByText('E2E proposal: Locked Preview', { exact: true })).toBeVisible();
});

test('a second proposal is rejected until the human resolves the first', async ({ app }) => {
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  await callWebMcpTool<ProposalResult>(
    app,
    'propose_graph_changes',
    updateClassifier('First Preview', accepted.graph.updatedAt),
  );
  const second = await callWebMcpTool<ProposalResult>(
    app,
    'propose_graph_changes',
    updateClassifier('Second Preview', accepted.graph.updatedAt),
  );

  expect(second).toEqual({
    ok: false,
    error: {
      code: 'PENDING_PROPOSAL_EXISTS',
      message: 'Review the current proposal before submitting another one.',
    },
  });
  await expect(app.getByText('E2E proposal: First Preview', { exact: true })).toBeVisible();
  await expect(app.getByText('E2E proposal: Second Preview', { exact: true })).toHaveCount(0);
});

test('approval applies a multi-operation proposal atomically and persists after reload', async ({ app }) => {
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const proposal = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    operations: [
      { type: 'update_node', nodeId: 'classifier', patch: { label: 'Atomic Classifier' } },
      { type: 'update_node', nodeId: 'billing', patch: { label: 'Atomic Billing' } },
    ],
    rationale: 'E2E atomic two-node approval.',
  });
  expect(proposal.ok).toBe(true);
  expect(classifierLabel(await callWebMcpTool<GraphRead>(app, 'get_graph', {}))).toBe(
    'Classifier Agent',
  );

  await app.getByRole('button', { name: 'Approve' }).click();
  let approved = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(approved.pendingProposal).toBeUndefined();
  expect(classifierLabel(approved)).toBe('Atomic Classifier');
  expect(approved.graph.nodes.find((node) => node.id === 'billing')?.label).toBe('Atomic Billing');

  await app.reload();
  approved = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(classifierLabel(approved)).toBe('Atomic Classifier');
  expect(approved.graph.nodes.find((node) => node.id === 'billing')?.label).toBe('Atomic Billing');
});

test('approval detects a proposal made stale by a changed accepted timestamp', async ({ app }) => {
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  await callWebMcpTool<ProposalResult>(
    app,
    'propose_graph_changes',
    updateClassifier('Stale Preview', accepted.graph.updatedAt),
  );

  await app.evaluate(() => {
    const key = 'graphcontract-workspace-v1';
    const persisted = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      state: { graph: { updatedAt: string } };
    };
    persisted.state.graph.updatedAt = '2099-01-01T00:00:00.000Z';
    localStorage.setItem(key, JSON.stringify(persisted));
  });
  await app.reload();
  await app.getByRole('button', { name: 'Approve' }).click();

  await expect(app.getByText('stale', { exact: true })).toBeVisible();
  await expect(app.getByText('Proposal is stale. Ask the agent to read the graph again.')).toBeVisible();
  expect(classifierLabel(await callWebMcpTool<GraphRead>(app, 'get_graph', {}))).toBe(
    'Classifier Agent',
  );
});

test('frozen graph refuses agent proposals until a human unfreezes it', async ({ app }) => {
  await freezeResearchIntake(app);
  const frozen = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const result = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: frozen.graph.updatedAt,
    operations: [
      {
        type: 'update_node',
        nodeId: 'clarify-request',
        patch: { label: 'Forbidden Frozen Change' },
      },
    ],
    rationale: 'E2E frozen rejection.',
  });

  expect(result).toEqual({
    ok: false,
    error: { code: 'GRAPH_FROZEN', message: 'Unfreeze the graph before requesting changes.' },
  });
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).pendingProposal).toBeUndefined();
  await expect(app.getByText('Forbidden Frozen Change', { exact: true })).toHaveCount(0);
});

test('branch scenarios are unavailable before human freeze', async ({ app }) => {
  await loadResearchIntake(app);
  const result = await callWebMcpTool<ScenarioResult>(app, 'get_branch_scenarios', {});

  expect(result).toEqual({
    ok: false,
    error: { code: 'GRAPH_NOT_FROZEN', message: 'The human has not frozen the graph.' },
  });
  await app.getByRole('button', { name: 'Show inspector' }).click();
  await app.getByRole('tab', { name: 'Scenarios' }).click();
  await expect(app.getByText('Freeze a valid contract', { exact: true })).toBeVisible();
});

test('scenario IDs, names, paths and order are deterministic across reads', async ({ app }) => {
  await freezeResearchIntake(app);
  const first = await callWebMcpTool<ScenarioResult>(app, 'get_branch_scenarios', {});
  const second = await callWebMcpTool<ScenarioResult>(app, 'get_branch_scenarios', {});

  expect(first.ok).toBe(true);
  expect(second).toEqual(first);
  expect(first.scenarios?.map(({ id }) => id)).toEqual([
    'scenario-1',
    'scenario-2',
    'scenario-3',
    'scenario-4',
    'scenario-5',
  ]);
  expect(first.scenarios?.every((scenario) => scenario.orderedPath[0] === 'research-intake-start')).toBe(true);
  expect(first.scenarios?.every((scenario) => new Set(scenario.orderedPath).size === scenario.orderedPath.length)).toBe(false);
  for (const scenario of first.scenarios ?? []) {
    expect(scenario.traversedEdges.filter((edge) => edge.id === 'researcher-continue').length).toBeLessThanOrEqual(1);
  }
});

test('download anchors own ready Blob URLs before the user gesture', async ({ app }) => {
  await freezeResearchIntake(app);
  await app.getByRole('tab', { name: 'Scenarios (5)' }).click();

  for (const filename of [
    'graph-contract.json',
    'graph-test-scenarios.json',
    'test_graph_paths.py',
  ]) {
    const link = app.getByRole('link', { name: `Download ${filename}` });
    await expect(link).toHaveAttribute('download', filename);
    await expect(link).toHaveAttribute('href', /^blob:/);
  }
});

test('pending proposal persists across reload and rejection preserves accepted local state', async ({ app }) => {
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  await callWebMcpTool<ProposalResult>(
    app,
    'propose_graph_changes',
    updateClassifier('Persisted Preview', accepted.graph.updatedAt),
  );

  await app.reload();
  await expect(app.getByText('E2E proposal: Persisted Preview', { exact: true })).toBeVisible();
  expect(classifierLabel(await callWebMcpTool<GraphRead>(app, 'get_graph', {}))).toBe(
    'Classifier Agent',
  );
  await app.getByRole('button', { name: 'Reject' }).click();
  await app.reload();
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).pendingProposal).toBeUndefined();
  expect(classifierLabel(await callWebMcpTool<GraphRead>(app, 'get_graph', {}))).toBe(
    'Classifier Agent',
  );
});

test('reset is undoable and restores the previous accepted graph', async ({ app }) => {
  await loadResearchIntake(app);
  await app.getByRole('button', { name: 'Reset example graph' }).click();
  await expect(app.getByText('Customer Support Workflow', { exact: true })).toBeVisible();
  await expect(app.getByText('7 nodes · 8 branches', { exact: true })).toBeVisible();

  await app.getByRole('button', { name: 'Undo' }).click();
  await expect(app.getByText('Research Intake Routing', { exact: true })).toBeVisible();
  await expect(app.getByText('9 nodes · 9 branches', { exact: true })).toBeVisible();
  await app.reload();
  await expect(app.getByText('Research Intake Routing', { exact: true })).toBeVisible();
});
