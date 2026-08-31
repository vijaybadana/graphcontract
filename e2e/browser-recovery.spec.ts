import type { Page } from '@playwright/test';

import {
  callWebMcpTool,
  expect,
  freezeResearchIntake,
  test,
  webMcpToolNames,
} from './fixtures';

const workspaceStorageKey = 'graphcontract-workspace-v1';
const currentPersistVersion = 8;
const expectedToolNames = [
  'get_branch_scenarios',
  'get_graph',
  'propose_graph_changes',
];

type GraphNode = Record<string, unknown> & {
  id: string;
  kind: string;
  label: string;
  executor?: string;
};

type WorkflowGraph = Record<string, unknown> & {
  schemaVersion: string;
  id: string;
  name: string;
  status: 'draft' | 'frozen';
  updatedAt: string;
  capabilities: Record<string, unknown> & {
    store?: { available?: boolean };
  };
  nodes: GraphNode[];
  edges: Array<Record<string, unknown> & { id: string }>;
  subgraphs: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
};

type GraphRead = {
  ok: true;
  graph: WorkflowGraph;
  validation: { validForFreeze: boolean; issues: unknown[] };
  pendingProposal?: { id: string; status: string; rationale: string };
};

type ProposalResult = {
  ok: boolean;
  proposal?: { status: string };
  error?: { code: string; message: string };
};

type BranchScenario = {
  id: string;
  name: string;
  orderedPath: string[];
  traversedEdges: Array<{ id: string }>;
};

type ScenarioRead = {
  ok: boolean;
  graphId?: string;
  scenarios?: BranchScenario[];
};

type StoredWorkspace = {
  state: Record<string, unknown>;
  version: number;
};

async function readGraph(page: Page): Promise<GraphRead> {
  return callWebMcpTool<GraphRead>(page, 'get_graph', {});
}

async function reloadWorkspace(page: Page) {
  await page.reload();
  await expect(page).toHaveTitle('GraphContract — Human-approved agent workflows');
  await expect(page.getByRole('application')).toBeVisible();
  await expect.poll(() => webMcpToolNames(page)).toEqual(expectedToolNames);
}

async function seedStoredWorkspace(page: Page, state: Record<string, unknown>, version: number) {
  await page.evaluate(
    ({ key, storedState, storedVersion }) => {
      localStorage.setItem(key, JSON.stringify({ state: storedState, version: storedVersion }));
    },
    { key: workspaceStorageKey, storedState: state, storedVersion: version },
  );
  await reloadWorkspace(page);
}

async function seedRawStoredWorkspace(page: Page, value: string) {
  await page.evaluate(
    ({ key, rawValue }) => localStorage.setItem(key, rawValue),
    { key: workspaceStorageKey, rawValue: value },
  );
  await reloadWorkspace(page);
}

async function readStoredWorkspace(page: Page): Promise<StoredWorkspace> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error(`Missing persisted workspace at ${key}`);
    return JSON.parse(raw) as StoredWorkspace;
  }, workspaceStorageKey);
}

function asRepresentativeV4(graph: WorkflowGraph): Record<string, unknown> {
  const nodes = graph.nodes.map((node) => {
    const legacy = structuredClone(node);
    delete legacy.storeAccess;
    delete legacy.retry;
    delete legacy.readiness;
    delete legacy.opaque;
    if (legacy.kind === 'end') delete legacy.outcome;
    if (legacy.id === 'classifier') {
      legacy.label = 'Legacy recovery classifier';
      legacy.modifiers = { storeRead: true, storeWrite: true, retryFallback: true };
    }
    return legacy;
  });
  const subgraphs = graph.subgraphs.map((subgraph) => {
    const legacy = structuredClone(subgraph);
    delete legacy.capabilityOverrides;
    return legacy;
  });

  return {
    schemaVersion: '4',
    id: graph.id,
    name: 'Recovered legacy workspace',
    status: 'draft',
    updatedAt: graph.updatedAt,
    nodes,
    edges: structuredClone(graph.edges),
    subgraphs,
  };
}

test('R01 corrupt storage recovers to a truthful, usable default workspace', async ({ app }) => {
  await seedRawStoredWorkspace(app, '{"state":');
  expect((await readGraph(app)).graph).toMatchObject({
    schemaVersion: '6',
    id: 'customer-support-contract',
    status: 'draft',
  });
  await expect.poll(() => readStoredWorkspace(app)).toMatchObject({
    version: currentPersistVersion,
    state: { graph: { id: 'customer-support-contract' }, proposal: null },
  });

  await seedStoredWorkspace(
    app,
    {
      graph: {
        schemaVersion: '6',
        id: 'corrupt-workspace',
        name: 'This graph must not render',
        status: 'frozen',
        updatedAt: 'not-a-valid-workspace',
        nodes: 'malformed-node-collection',
        edges: [],
        subgraphs: [],
      },
      proposal: { id: 'untrusted-proposal' },
      scenarios: [{ id: 'untrusted-scenario' }],
    },
    7,
  );

  const recovered = await readGraph(app);
  expect(recovered.graph).toMatchObject({
    schemaVersion: '6',
    id: 'customer-support-contract',
    name: 'Customer Support Workflow',
    status: 'draft',
  });
  expect(recovered.graph.nodes).toHaveLength(7);
  expect(recovered.graph.edges).toHaveLength(8);
  expect(recovered.validation).toEqual({ validForFreeze: true, issues: [] });
  expect(recovered.pendingProposal).toBeUndefined();

  await expect(app.locator('.workspace-contract-state')).toHaveText('Valid draft');
  await expect(app.getByLabel('Graph status')).toContainText('7 nodes');
  await expect(app.getByLabel('Graph status')).toContainText('8 branches');
  await expect(app.getByLabel('Graph status')).toContainText('Contract valid');
  await expect(app.getByRole('button', { name: 'Confirm and freeze contract; currently draft' })).toBeEnabled();
  await expect(app.getByTestId('rf__node-classifier')).toBeVisible();

  await expect.poll(() => readStoredWorkspace(app)).toMatchObject({
    version: currentPersistVersion,
    state: {
      graph: { schemaVersion: '6', id: 'customer-support-contract', status: 'draft' },
      proposal: null,
    },
  });
});

test('R02 representative v4 workspace migrates, remains editable, and persists as v6', async ({ app }) => {
  const initial = await readGraph(app);
  const representativeV4 = asRepresentativeV4(initial.graph);
  await seedStoredWorkspace(
    app,
    { graph: representativeV4, proposal: null, scenarios: [] },
    4,
  );

  let migrated = await readGraph(app);
  expect(migrated.graph).toMatchObject({
    schemaVersion: '6',
    id: initial.graph.id,
    name: 'Recovered legacy workspace',
    status: 'draft',
    capabilities: { store: { available: true } },
  });
  expect(migrated.graph.nodes.find((node) => node.id === 'classifier')).toMatchObject({
    kind: 'step',
    executor: 'ai',
    label: 'Legacy recovery classifier',
    storeAccess: { read: {}, write: {} },
    retry: { maxAttempts: 2, backoff: { strategy: 'fixed', initialDelayMs: 0 } },
  });
  expect(migrated.graph.nodes.map((node) => node.id)).toEqual(
    initial.graph.nodes.map((node) => node.id),
  );
  expect(migrated.graph.edges.map(({ id, source, target }) => ({ id, source, target }))).toEqual(
    initial.graph.edges.map(({ id, source, target }) => ({ id, source, target })),
  );
  expect(migrated.graph.subgraphs.map((subgraph) => subgraph.id)).toEqual(
    initial.graph.subgraphs.map((subgraph) => subgraph.id),
  );
  expect(migrated.graph.nodes.find((node) => node.id === 'billing')).toMatchObject(
    initial.graph.nodes.find((node) => node.id === 'billing')!,
  );
  expect(migrated.validation).toEqual({ validForFreeze: true, issues: [] });

  await expect.poll(() => readStoredWorkspace(app)).toMatchObject({
    version: currentPersistVersion,
    state: { graph: { schemaVersion: '6', name: 'Recovered legacy workspace' }, proposal: null },
  });

  await app.getByTestId('rf__node-classifier').click();
  const label = app.getByLabel('Label', { exact: true });
  await expect(label).toBeEnabled();
  await label.fill('Edited migrated classifier');
  await expect.poll(async () =>
    (await readGraph(app)).graph.nodes.find((node) => node.id === 'classifier')?.label,
  ).toBe('Edited migrated classifier');

  await reloadWorkspace(app);
  migrated = await readGraph(app);
  expect(migrated.graph.nodes.find((node) => node.id === 'classifier')?.label).toBe(
    'Edited migrated classifier',
  );
  expect(migrated.validation).toEqual({ validForFreeze: true, issues: [] });
  const persisted = await readStoredWorkspace(app);
  expect(persisted.version).toBe(currentPersistVersion);
  expect((persisted.state.graph as { schemaVersion: string }).schemaVersion).toBe('6');
  expect(persisted.state).not.toHaveProperty('scenarios');
});

test('R03 stale stored scenarios are discarded and rederived from the frozen graph', async ({ app }) => {
  await freezeResearchIntake(app);
  const canonical = await callWebMcpTool<ScenarioRead>(app, 'get_branch_scenarios', {});
  expect(canonical.ok).toBe(true);
  expect(canonical.scenarios).toHaveLength(5);
  const frozen = await readGraph(app);
  const stored = await readStoredWorkspace(app);
  const forgedScenario = {
    id: 'scenario-forged',
    name: 'Forged persisted path',
    orderedPath: ['research-intake-start', 'forged-terminal'],
    traversedEdges: [{ id: 'forged-edge' }],
    expectedTerminalNode: 'forged-terminal',
  };

  await seedStoredWorkspace(
    app,
    { ...stored.state, graph: frozen.graph, proposal: null, scenarios: [forgedScenario] },
    currentPersistVersion,
  );

  const recovered = await callWebMcpTool<ScenarioRead>(app, 'get_branch_scenarios', {});
  expect(recovered).toEqual(canonical);
  expect(recovered.scenarios?.some((scenario) => scenario.id === forgedScenario.id)).toBe(false);

  await app.getByRole('radio', { name: 'Scenario', exact: true }).click();
  const scenarioRows = app.locator('button[data-scenario-id]');
  await expect(scenarioRows).toHaveCount(canonical.scenarios!.length);
  await expect(app.locator(`button[data-scenario-id="${forgedScenario.id}"]`)).toHaveCount(0);
  expect(await scenarioRows.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-scenario-id')))).toEqual(
    canonical.scenarios!.map((scenario) => scenario.id),
  );

  const rewritten = await readStoredWorkspace(app);
  expect(rewritten.version).toBe(currentPersistVersion);
  expect(rewritten.state).not.toHaveProperty('scenarios');
});

test('R04 interrupted pending proposal reloads locked, rejects cleanly, and restores editing', async ({ app }) => {
  const accepted = await readGraph(app);
  const proposal = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    operations: [
      {
        type: 'update_node',
        nodeId: 'classifier',
        patch: { label: 'Interrupted candidate classifier' },
      },
    ],
    rationale: 'Interrupted proposal recovery review.',
  });
  expect(proposal).toMatchObject({ ok: true, proposal: { status: 'pending' } });

  await reloadWorkspace(app);
  const interrupted = await readGraph(app);
  expect(interrupted.graph).toEqual(accepted.graph);
  expect(interrupted.pendingProposal).toMatchObject({
    status: 'pending',
    rationale: 'Interrupted proposal recovery review.',
  });
  await expect(app.getByText('Interrupted proposal recovery review.', { exact: true })).toBeVisible();
  const comparison = app.getByRole('region', { name: 'Before / Proposed' });
  await expect(comparison).toBeVisible();
  await expect(comparison.getByLabel('Changed values for classifier', { exact: true })).toContainText(
    'Interrupted candidate classifier',
  );
  await expect(comparison.locator('.proposal-overview-canvas').last()).toContainText(
    'Interrupted candidate classifier',
  );
  await expect(app.getByTestId('rf__node-classifier').getByText('Classifier Agent', { exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Step', exact: true })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Reset example graph' })).toBeDisabled();
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();

  await app.getByRole('button', { name: 'Reject' }).click();
  const rejected = await readGraph(app);
  expect(rejected.graph).toEqual(accepted.graph);
  expect(rejected.pendingProposal).toBeUndefined();
  await expect(app.getByRole('button', { name: 'Step', exact: true })).toBeEnabled();
  await expect(app.getByRole('button', { name: 'Reset example graph' })).toBeEnabled();
  await expect(app.getByRole('button', { name: 'Confirm and freeze contract; currently draft' })).toBeEnabled();

  await app.getByTestId('rf__node-classifier').click();
  const label = app.getByLabel('Label', { exact: true });
  await expect(label).toBeEnabled();
  await label.fill('Recovered accepted classifier');
  await expect.poll(async () =>
    (await readGraph(app)).graph.nodes.find((node) => node.id === 'classifier')?.label,
  ).toBe('Recovered accepted classifier');

  await reloadWorkspace(app);
  const persisted = await readGraph(app);
  expect(persisted.pendingProposal).toBeUndefined();
  expect(persisted.graph.nodes).toHaveLength(accepted.graph.nodes.length);
  expect(persisted.graph.nodes.find((node) => node.id === 'classifier')?.label).toBe(
    'Recovered accepted classifier',
  );
});
