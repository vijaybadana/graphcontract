import type { Page } from '@playwright/test';

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
    nodes: Array<{ id: string; label: string; position: { x: number; y: number } }>;
    edges: Array<{ id: string; mode: string }>;
  };
  validation: { validForFreeze: boolean; issues: unknown[] };
  pendingProposal?: { id: string; status: string; rationale: string; operations?: unknown[] };
  reviewedProposal?: {
    id: string;
    status: string;
    reviewStatus: 'changes_requested';
    rationale: string;
    operations: unknown[];
    diff: Record<string, unknown>;
  };
  reviewRequest?: {
    status: 'changes_requested';
    feedback: string;
    proposalId: string;
    reviewedGraphId: string;
    reviewedGraphUpdatedAt: string;
    reviewedAt: string;
    contentTrust: 'untrusted-human-authored';
  };
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

async function expectNodesInsideUsableCanvas(page: Page, nodeIds: string[]) {
  await expect.poll(() => page.evaluate((ids) => {
    const canvas = document.querySelector<HTMLElement>('.react-flow');
    if (!canvas) return false;
    const canvasRect = canvas.getBoundingClientRect();
    const visibleRect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || getComputedStyle(element).display === 'none') return null;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? rect : null;
    };
    const paletteRect = visibleRect('.workspace-palette-slot');
    const inspectorRect = visibleRect('.workspace-inspector-panel');
    const bounds = {
      left: paletteRect ? paletteRect.right + 12 : canvasRect.left + 12,
      right: inspectorRect ? inspectorRect.left - 12 : canvasRect.right - 12,
      top: canvasRect.top + 112,
      bottom: canvasRect.bottom - 78,
    };
    return ids.every((id) => {
      const element = document.querySelector<HTMLElement>(`[data-testid="rf__node-${id}"]`);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      return rect.width >= 72 && center.x >= bounds.left && center.x <= bounds.right &&
        center.y >= bounds.top && center.y <= bounds.bottom;
    });
  }, nodeIds)).toBe(true);
}

const translatedProposal = (accepted: GraphRead, offsetX: number, rationale: string) => ({
  expectedGraphUpdatedAt: accepted.graph.updatedAt,
  operations: accepted.graph.nodes.map((node) => ({
    type: 'update_node',
    nodeId: node.id,
    patch: {
      position: {
        x: node.position.x + offsetX,
        y: node.position.y,
      },
    },
  })),
  rationale,
});

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

  for (const name of ['Task', 'Agent', 'Tool', 'Human', 'Subgraph']) {
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

test('human review feedback survives reload and is consumed only by a valid revised proposal', async ({ app }) => {
  expect(await webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const proposal = await callWebMcpTool<ProposalResult>(
    app,
    'propose_graph_changes',
    updateClassifier('Needs clearer routing', accepted.graph.updatedAt),
  );
  expect(proposal).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  const reviewedProposalId = (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).pendingProposal!.id;
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toEqual(accepted.graph);

  const requestChanges = app.getByRole('button', { name: 'Request changes' });
  await requestChanges.click();
  const dialog = app.getByRole('dialog', { name: 'Request proposal changes' });
  const feedback = dialog.getByLabel('Requested changes');
  await expect(dialog).toBeVisible();
  await expect(feedback).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Submit request' })).toBeDisabled();
  await app.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(requestChanges).toBeFocused();

  await requestChanges.click();
  const requestedText = 'Keep the classifier name and clarify the technical route.';
  await dialog.getByLabel('Requested changes').fill(requestedText);
  await dialog.getByRole('button', { name: 'Submit request' }).click();
  await expect(dialog).toBeHidden();
  await expect(app.locator('.proposal-panel__notice-title', { hasText: 'Changes requested' })).toBeVisible();
  let reviewed = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(reviewed.graph).toEqual(accepted.graph);
  expect(reviewed.pendingProposal).toBeUndefined();
  expect(reviewed.reviewedProposal).toMatchObject({
    id: reviewedProposalId,
    reviewStatus: 'changes_requested',
    operations: updateClassifier('Needs clearer routing', accepted.graph.updatedAt).operations,
  });
  expect(reviewed.reviewRequest).toMatchObject({
    status: 'changes_requested',
    feedback: requestedText,
    reviewedGraphId: accepted.graph.id,
    reviewedGraphUpdatedAt: accepted.graph.updatedAt,
    contentTrust: 'untrusted-human-authored',
  });
  await app.getByRole('button', { name: 'Review updated classifier' }).click();
  await expect(app.getByTestId('rf__node-classifier').locator('.contract-node-shell'))
    .toHaveClass(/proposal-focus-active/);
  await expect.poll(() => app.locator('.react-flow__viewport').evaluate((element) => {
    const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return transform.a;
  })).toBeGreaterThanOrEqual(0.61);
  await app.getByRole('button', { name: 'Back to proposal' }).click();

  await app.reload();
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  reviewed = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(reviewed.reviewRequest?.feedback).toBe(requestedText);
  expect(reviewed.reviewedProposal?.id).toBe(reviewedProposalId);
  await expect(app.getByRole('radio', { name: 'Proposal', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(app.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Request changes' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Reject' })).toBeDisabled();

  const stale = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    ...updateClassifier('Stale revision', '2000-01-01T00:00:00.000Z'),
  });
  expect(stale).toMatchObject({ ok: false, error: { code: 'PROPOSAL_STALE' } });
  let preserved = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(preserved.reviewRequest?.feedback).toBe(requestedText);
  expect(preserved.reviewedProposal?.id).toBe(reviewedProposalId);

  const invalid = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    operations: [{ type: 'remove_node', nodeId: 'end' }],
    rationale: 'Invalid revision must not consume the human review request.',
  });
  expect(invalid).toMatchObject({ ok: false, error: { code: 'PROPOSAL_INVALID' } });
  preserved = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(preserved.reviewRequest?.feedback).toBe(requestedText);
  expect(preserved.reviewedProposal?.id).toBe(reviewedProposalId);

  const revised = await callWebMcpTool<ProposalResult>(
    app,
    'propose_graph_changes',
    updateClassifier('Technical Routing Classifier', accepted.graph.updatedAt),
  );
  expect(revised).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  const pendingRevision = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(pendingRevision.reviewRequest).toBeUndefined();
  expect(pendingRevision.reviewedProposal).toBeUndefined();
  expect(pendingRevision.pendingProposal?.id).not.toBe(reviewedProposalId);
  expect(pendingRevision.graph).toEqual(accepted.graph);
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();
  await app.getByRole('button', { name: 'Approve' }).click();
  const approved = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(classifierLabel(approved)).toBe('Technical Routing Classifier');
  expect(approved.reviewRequest).toBeUndefined();
});

test('proposal projection transitions fit each candidate and restore the accepted graph without camera drift', async ({ app }) => {
  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const endpointIds = [accepted.graph.nodes[0].id, accepted.graph.nodes.at(-1)!.id];

  const first = await callWebMcpTool<ProposalResult>(
    app,
    'propose_graph_changes',
    translatedProposal(accepted, 5_000, 'Move the candidate far right for review.'),
  );
  expect(first).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  await expect(app.getByRole('radio', { name: 'Proposal', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expectNodesInsideUsableCanvas(app, endpointIds);

  await app.getByRole('button', { name: 'Request changes' }).click();
  const requestDialog = app.getByRole('dialog', { name: 'Request proposal changes' });
  await requestDialog.getByLabel('Requested changes').fill('Keep the accepted positions and revise the candidate.');
  await requestDialog.getByRole('button', { name: 'Submit request' }).click();
  await expect(app.getByRole('radio', { name: 'Proposal', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expectNodesInsideUsableCanvas(app, endpointIds);
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toEqual(accepted.graph);
  await expect(app.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Request changes' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Reject' })).toBeDisabled();

  const replacement = await callWebMcpTool<ProposalResult>(
    app,
    'propose_graph_changes',
    translatedProposal(accepted, 8_000, 'Replacement candidate after requested changes.'),
  );
  expect(replacement).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  await expect(app.getByRole('button', { name: 'Collapse proposal panel' })).toBeVisible();
  await expectNodesInsideUsableCanvas(app, endpointIds);

  await app.getByRole('button', { name: 'Collapse proposal panel' }).click();
  await expect(app.getByRole('button', { name: 'Open Inspector' })).toBeVisible();
  await expectNodesInsideUsableCanvas(app, endpointIds);
  await app.getByRole('button', { name: 'Open Inspector' }).click();
  await app.getByRole('button', { name: 'Reject' }).click();
  await expect(app.getByRole('radio', { name: 'Design', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expectNodesInsideUsableCanvas(app, endpointIds);
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toEqual(accepted.graph);
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
  const pending = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(pending.graph).toEqual(accepted.graph);

  const comparison = app.getByRole('region', { name: 'Graph overview' });
  await expect(comparison.getByRole('heading', { name: 'Graph overview' })).toBeVisible();
  const summary = comparison.getByLabel('Proposal diff summary');
  await expect(summary).toContainText('updated classifier (label)');
  await expect(summary).toContainText('updated billing (label)');
  await expect(comparison.locator('.proposal-overview-canvas')).toHaveCount(1);
  expect(await comparison.locator('.proposal-overview-canvas').evaluateAll(
    (canvases) => canvases.every((canvas) => canvas.getAttribute('aria-hidden') === 'true' && (canvas as HTMLElement & { inert: boolean }).inert),
  )).toBe(true);

  await app.getByRole('button', { name: 'Approve' }).click();
  await expect(app.getByRole('radiogroup', { name: 'Canvas projection' }).getByRole('radio', { name: 'Design', exact: true })).toHaveAttribute('aria-checked', 'true');
  let approved = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(approved.pendingProposal).toBeUndefined();
  expect(classifierLabel(approved)).toBe('Atomic Classifier');
  expect(approved.graph.nodes.find((node) => node.id === 'billing')?.label).toBe('Atomic Billing');

  await app.reload();
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
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
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  await expect(app.getByText('stale', { exact: true })).toBeVisible();
  await expect(app.getByRole('status').filter({ hasText: 'No candidate was replayed against the current graph' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Reject' })).toBeEnabled();
  await expect(app.getByRole('heading', { name: 'Graph overview' })).toHaveCount(0);
  await expect(app.getByText('Stale Preview', { exact: true })).toHaveCount(0);
  await expect(app.getByTestId('rf__node-classifier').getByText('Classifier Agent', { exact: true })).toBeVisible();
  expect(classifierLabel(await callWebMcpTool<GraphRead>(app, 'get_graph', {}))).toBe(
    'Classifier Agent',
  );

  await app.getByRole('button', { name: 'Reject' }).click();
  const rejected = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(rejected.pendingProposal).toBeUndefined();
  expect(classifierLabel(rejected)).toBe('Classifier Agent');
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
  await expect(app.getByRole('radio', {
    name: 'Scenario unavailable: Freeze a valid contract to generate scenarios.',
  })).toBeDisabled();
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
  await expect(app.getByRole('radio', { name: 'Scenario', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );

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
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  await expect(app.getByText('E2E proposal: Persisted Preview', { exact: true })).toBeVisible();
  expect(classifierLabel(await callWebMcpTool<GraphRead>(app, 'get_graph', {}))).toBe(
    'Classifier Agent',
  );
  await app.getByRole('button', { name: 'Reject' }).click();
  await app.reload();
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).pendingProposal).toBeUndefined();
  expect(classifierLabel(await callWebMcpTool<GraphRead>(app, 'get_graph', {}))).toBe(
    'Classifier Agent',
  );
});

test('reset is undoable and restores the previous accepted graph', async ({ app }) => {
  await loadResearchIntake(app);
  await app.getByRole('button', { name: 'Reset example graph' }).click();
  await expect.poll(async () => (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toMatchObject({
    id: 'customer-support-contract',
    name: 'Customer Support Workflow',
    nodes: expect.arrayContaining([expect.objectContaining({ id: 'classifier' })]),
  });
  await expect(app.getByLabel('Graph status')).toContainText('7 nodes');

  await app.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toMatchObject({
    id: 'research-intake-routing-demo',
    name: 'Research Intake Routing',
  });
  await expect(app.getByLabel('Graph status')).toContainText('9 nodes');
  await app.reload();
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  await expect.poll(async () => (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toMatchObject({
    id: 'research-intake-routing-demo',
    name: 'Research Intake Routing',
  });
});
