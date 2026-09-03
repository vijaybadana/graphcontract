import {
  callWebMcpTool,
  expect,
  freezeResearchIntake,
  test,
  webMcpToolNames,
} from './fixtures';
import { loadResearchSupervisor } from './helpers/graph';

type GraphRead = {
  graph: {
    updatedAt: string;
    status: 'draft' | 'frozen';
    capabilities: Record<string, unknown>;
    nodes: Array<{ id: string; retry?: unknown; storeAccess?: unknown }>;
    edges: Array<{ id: string; loopCap?: number }>;
  };
};

type ProposalResult = {
  ok: boolean;
  proposal?: { status: 'pending' | 'invalid' };
  error?: { code: string };
};

async function proposeAndApprove(
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
}

test('State, Checkpoint, Store, and Runtime remain distinct capability controls', async ({ app }) => {
  await proposeAndApprove(app, [
    {
      type: 'update_graph_capabilities',
      patch: {
        state: { enabled: true, schema: { fields: ['messages'], summary: 'Per-run messages' }, reducers: [{ key: 'messages', summary: 'Append messages' }] },
        checkpointer: { enabled: true, backend: 'MemorySaver', durableThread: { required: true, threadIdSource: 'request.threadId' } },
        store: { available: true, namespace: 'preferences', retention: 'session' },
        runtimeMode: { mode: 'text', input: 'text' },
      },
    },
  ], 'E2E durability distinction.');

  const settings = app.getByRole('tablist', { name: 'Durability settings' });
  await expect(app.getByRole('checkbox', { name: 'State enabled' })).toBeChecked();
  await expect(app.getByRole('textbox', { name: 'State fields' })).toHaveValue('messages');

  await settings.getByRole('tab', { name: 'Checkpoint' }).click();
  await expect(app.getByRole('checkbox', { name: 'Checkpoint enabled' })).toBeChecked();
  await expect(app.getByRole('checkbox', { name: 'Durable thread required' })).toBeChecked();

  await settings.getByRole('tab', { name: 'Store' }).click();
  await expect(app.getByRole('checkbox', { name: 'Store available' })).toBeChecked();
  await expect(app.getByRole('textbox', { name: 'Store namespace' })).toHaveValue('preferences');

  await settings.getByRole('tab', { name: 'Runtime' }).click();
  const runtimeSettings = app.getByRole('tabpanel', { name: 'runtime graph settings' });
  await expect(runtimeSettings.getByRole('combobox', { name: 'Runtime mode' })).toHaveValue('text');
  await expect(runtimeSettings.getByRole('status')).toContainText('Runtime mode applies at graph level');
});

test('a subgraph inherits capability scope until an explicit override replaces it', async ({ app }) => {
  await loadResearchSupervisor(app);
  await proposeAndApprove(app, [
    {
      type: 'update_graph_capabilities',
      patch: {
        state: { enabled: true, schema: { fields: ['brief'], summary: 'Outer working state' }, reducers: [] },
        store: { available: true, namespace: 'research', retention: 'session' },
      },
    },
    {
      type: 'set_subgraph_capability_override',
      subgraphId: 'research-supervisor',
      override: { store: { available: true, namespace: 'research-cell', retention: 'session' } },
    },
  ], 'E2E subgraph Store override.');

  const subgraph = app.getByTestId('rf__node-research-supervisor');
  await expect(subgraph.getByText('State', { exact: true })).toBeVisible();
  await expect(subgraph.getByText(/inherits/)).toHaveCount(2);
  await expect(subgraph.getByText('Store', { exact: true })).toBeVisible();
  await expect(subgraph.getByText(/override/)).toBeVisible();
});

test('direct Store access validates effective availability and only marks the declaring Step', async ({ app }) => {
  const before = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const invalid = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: before.graph.updatedAt,
    operations: [{ type: 'update_node', nodeId: 'billing', patch: { storeAccess: { read: { namespace: 'preferences', key: 'customer' } } } }],
    rationale: 'E2E invalid direct Store access.',
  });
  expect(invalid).toMatchObject({ ok: true, proposal: { status: 'invalid' } });
  await expect(app.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await app.getByRole('button', { name: 'Reject' }).click();

  await proposeAndApprove(app, [
    { type: 'update_graph_capabilities', patch: { store: { available: true, namespace: 'preferences', retention: 'session' } } },
    { type: 'update_node', nodeId: 'billing', patch: { storeAccess: { read: { namespace: 'preferences', key: 'customer' } } } },
  ], 'E2E valid direct Store access.');

  await expect(app.getByTestId('rf__node-billing').getByLabel('Store read')).toBeVisible();
  await expect(app.getByTestId('rf__node-classifier').getByLabel('Store read')).toHaveCount(0);
});

test('Retry remains internal metadata rather than creating a topology loop', async ({ app }) => {
  const before = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  await proposeAndApprove(app, [{
    type: 'update_node',
    nodeId: 'billing',
    patch: { retry: { maxAttempts: 3, backoff: { strategy: 'exponential', initialDelayMs: 100 }, retryOn: ['provider.timeout'] } },
  }], 'E2E internal retry policy.');

  const after = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(after.graph.edges).toEqual(before.graph.edges);
  expect(after.graph.edges.some((edge) => edge.loopCap !== undefined)).toBe(false);
  expect(after.graph.nodes.find((node) => node.id === 'billing')?.retry).toMatchObject({ maxAttempts: 3 });
  await expect(app.getByTestId('rf__node-billing').getByLabel('Internal retry policy')).toBeVisible();
  await expect(app.getByRole('application').locator('[aria-label^="Loop "]')).toHaveCount(0);
});

test('WebMCP remains exactly three review-only tools and cannot propose a frozen durability change', async ({ app }) => {
  await freezeResearchIntake(app);
  expect(await webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);

  const accepted = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  const result = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    operations: [{ type: 'update_graph_capabilities', patch: { store: { available: true } } }],
    rationale: 'E2E frozen durability change.',
  });
  expect(result).toMatchObject({ ok: false, error: { code: 'GRAPH_FROZEN' } });
});
