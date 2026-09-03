import {
  callWebMcpTool,
  expect,
  loadGraphLibraryEntry,
  test,
  webMcpToolMetadata,
  webMcpToolNames,
} from './fixtures';

type GraphRead = {
  ok: true;
  graph: {
    id: string;
    status: 'draft' | 'frozen';
    updatedAt: string;
    nodes: Array<{
      id: string;
      kind: string;
      executor?: 'deterministic' | 'ai' | 'tool' | 'human';
      label: string;
      hitl?: { enabled: boolean; timing?: 'before' | 'inside' | 'after' };
      sensitive?: { approvalRequired: boolean };
    }>;
  };
  validation: { validForFreeze: boolean; issues: Array<{ code: string; message: string }> };
  pendingProposal?: { status: string; rationale: string };
};

type ProposalResult = {
  ok: boolean;
  proposal?: { status: string };
  error?: { code: string; message: string };
};

async function loadHumanControlDemo(app: Parameters<typeof callWebMcpTool>[0]) {
  await loadGraphLibraryEntry(app, 'Human Control & HITL', 'human-control-hitl-demo');
  await expect(app.getByTestId('rf__node-deploy-change')).toBeVisible();
}

async function selectNode(app: Parameters<typeof callWebMcpTool>[0], id: string) {
  await app.getByTestId(`rf__node-${id}`).click();
  await expect(app.getByRole('heading', { name: 'Node details' })).toBeVisible();
}

test('gate timing remains visibly and accessibly distinct while executor ownership stays orthogonal', async ({ app }) => {
  await loadHumanControlDemo(app);

  const deploy = app.getByTestId('rf__node-deploy-change');
  const beforeGate = deploy.locator('[data-hitl-timing="before"]');
  await expect(beforeGate).toHaveClass(/contract-node-hitl-marker--before/);
  await expect(beforeGate).toHaveAccessibleName(
    'Human-in-the-loop gate, before execution. Focus human input in the inspector.',
  );
  await expect(deploy.locator('[data-modifier-id="executor"]')).toHaveAccessibleName(
    'Tool executor. Focus executor in the inspector.',
  );

  await selectNode(app, 'revise-change-plan');
  await app.getByRole('checkbox', { name: 'HITL enabled' }).check();
  await app.getByRole('button', { name: 'HITL timing' }).click();
  await app.getByRole('option', { name: 'Inside', exact: true }).click();
  const revise = app.getByTestId('rf__node-revise-change-plan');
  const insideGate = revise.locator('[data-hitl-timing="inside"]');
  await expect(insideGate).toHaveClass(/contract-node-hitl-marker--inside/);
  await expect(insideGate).toHaveAccessibleName(
    'Human-in-the-loop gate, inside execution. Focus human input in the inspector.',
  );
  await expect(revise.locator('[data-modifier-id="executor"]')).toHaveAccessibleName(
    'AI executor. Focus executor in the inspector.',
  );

  await app.getByRole('button', { name: 'HITL timing' }).click();
  await app.getByRole('option', { name: 'After', exact: true }).click();
  const afterGate = revise.locator('[data-hitl-timing="after"]');
  await expect(afterGate).toHaveClass(/contract-node-hitl-marker--after/);
  await expect(afterGate).toHaveAccessibleName(
    'Human-in-the-loop gate, after execution. Focus human input in the inspector.',
  );

  await app.getByRole('button', { name: 'Human', exact: true }).click();
  const graph = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const human = graph.graph.nodes.find((node) => node.executor === 'human');
  expect(human).toMatchObject({ kind: 'step', executor: 'human' });
  await expect(app.getByTestId(`rf__node-${human!.id}`).locator('[data-hitl-timing]')).toHaveCount(0);
});

test('the Human Control demo previews approve, request-changes, and reject without mutating accepted state', async ({ app }) => {
  await loadHumanControlDemo(app);
  const acceptedBefore = (await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph;

  await selectNode(app, 'deploy-change');
  for (const [outcome, destination] of [
    ['Approve', 'Completed · change-completed'],
    ['Request changes', 'Revise change plan · revise-change-plan'],
    ['Reject', 'Cancelled · change-cancelled'],
  ]) {
    await app.getByRole('button', { name: 'Preview input request' }).click();
    const dialog = app.getByRole('dialog', { name: 'Preview input request' });
    await expect(dialog.getByText('Preview only — no runtime execution, response, resume, or graph mutation occurs here.')).toBeVisible();
    await dialog.getByRole('radio', { name: `${outcome} Would resume at ${destination}` }).check();
    await dialog.getByRole('button', { name: 'Preview selected response' }).click();
    await expect(dialog.getByText(new RegExp(`would resume at ${destination.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`))).toBeVisible();
    await expect(dialog.getByText('No runtime executed and the graph is unchanged.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close input request preview' }).click();
    await expect(dialog).toHaveCount(0);
  }

  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).graph).toEqual(acceptedBefore);
});

test('approval-required Sensitive policy is invalid without its explicit before approval gate', async ({ app }) => {
  await loadHumanControlDemo(app);
  await selectNode(app, 'deploy-change');

  await app.getByRole('checkbox', { name: 'HITL enabled' }).uncheck();
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();

  const invalid = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(invalid.validation.validForFreeze).toBe(false);
  expect(invalid.validation.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'SENSITIVE_APPROVAL_GATE_REQUIRED' })]),
  );
});

test('the three real page-registered WebMCP tools keep P2 changes review-only and protect pending and frozen graphs', async ({ app }) => {
  await loadHumanControlDemo(app);
  expect(await webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  const propose = await webMcpToolMetadata(app, 'propose_graph_changes');
  const schema = JSON.stringify(propose.inputSchema);
  expect(schema).toContain('"before"');
  expect(schema).toContain('"inside"');
  expect(schema).toContain('"after"');
  expect(propose.description).toContain('cannot approve, reject, respond, resume, freeze');

  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const candidate = {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    rationale: 'E2E P2 review-only HITL proposal.',
    operations: [{
      type: 'update_node',
      nodeId: 'revise-change-plan',
      patch: {
        hitl: {
          enabled: true,
          timing: 'inside',
          response: {
            type: 'approval',
            allowedOutcomes: [{
              id: 'approve',
              label: 'Approve',
              resumeNodeId: 'revision-prepared',
            }],
          },
        },
      },
    }],
  };
  expect(await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', candidate)).toMatchObject({
    ok: true,
    proposal: { status: 'pending' },
  });
  const pending = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(pending.graph).toEqual(accepted.graph);
  expect(pending.pendingProposal).toMatchObject({ status: 'pending', rationale: candidate.rationale });
  await expect(app.getByRole('button', { name: 'Agent', exact: true })).toBeDisabled();
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();

  await app.getByRole('button', { name: 'Reject' }).click();
  await app.getByRole('button', { name: /confirm (?:and|&) freeze/i }).click();
  const frozen = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(frozen.graph.status).toBe('frozen');
  expect(await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    ...candidate,
    expectedGraphUpdatedAt: frozen.graph.updatedAt,
  })).toEqual({
    ok: false,
    error: { code: 'GRAPH_FROZEN', message: 'Unfreeze the graph before requesting changes.' },
  });
});
