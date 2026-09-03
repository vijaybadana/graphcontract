import type { Page } from '@playwright/test';

import {
  callWebMcpTool,
  confirmGraphLibraryReplacement,
  expect,
  loadGraphLibraryEntry,
  test,
} from './fixtures';

type Relationship = {
  id: string;
  kind: 'external-orchestration';
  label: string;
  source: { kind: 'node'; nodeId: string };
  target: { kind: 'external'; externalId: string; label: string };
  provenance: {
    representation: 'external-orchestration';
    evidence?: {
      source: string;
      evidenceClass: string;
      confidence: 'low' | 'medium' | 'high';
    };
  };
};

type PresentationGraph = {
  id: string;
  name: string;
  status: 'draft' | 'frozen';
  updatedAt: string;
  nodes: Array<{ id: string; label: string; parentId?: string }>;
  edges: Array<{ id: string; source: string; target: string }>;
  subgraphs: Array<{ id: string; collapsed: boolean }>;
  relationships: Relationship[];
};

type GraphRead = {
  ok: true;
  graph: PresentationGraph;
  validation: { validForFreeze: boolean; issues: unknown[] };
  pendingProposal?: { status: string; rationale: string };
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
  relationshipAnnotations: Array<{ relationshipId?: string; family: string }>;
};

type ScenarioRead = {
  ok: boolean;
  graphId?: string;
  scenarios?: Scenario[];
};

async function readGraph(page: Page) {
  const result = await callWebMcpTool<GraphRead>(page, 'get_graph', {});
  expect(result.ok).toBe(true);
  return result;
}

async function historyAvailability(page: Page) {
  return {
    undo: await page.getByRole('button', { name: 'Undo' }).isEnabled(),
    redo: await page.getByRole('button', { name: 'Redo' }).isEnabled(),
  };
}

async function expectNoHorizontalPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

function projectionMode(page: Page, label: 'Design' | 'Runtime' | 'Proposal' | 'Scenario') {
  return page
    .getByRole('radiogroup', { name: 'Canvas projection' })
    .getByRole('radio', { name: new RegExp(`^${label}(?: unavailable:.*)?$`) });
}

async function loadParallelResearchDemo(page: Page) {
  await loadGraphLibraryEntry(page, 'Parallel research · Send ×N', 'dynamic-parallelism-merge-demo');
  await expect(page.getByTestId('rf__node-generate-queries')).toBeVisible();
  await expect.poll(async () => (await readGraph(page)).graph.id).toBe(
    'dynamic-parallelism-merge-demo',
  );
}

async function loadHierarchicalResearch(page: Page) {
  await page.getByRole('button', { name: 'Workflow library, 14 templates' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Open Hierarchical Deep Research' }).click();
  await confirmGraphLibraryReplacement(page, 'Hierarchical Deep Research');
  await expect.poll(async () => (await readGraph(page)).graph.id).toBe(
    'library-hierarchical-deep-research',
  );
}

const externalRelationship = (
  id: string,
  nodeId: string,
  externalId: string,
  label: string,
): Relationship => ({
  id,
  kind: 'external-orchestration',
  label,
  source: { kind: 'node', nodeId },
  target: { kind: 'external', externalId, label },
  provenance: {
    representation: 'external-orchestration',
    evidence: {
      source: `https://example.test/contracts/${externalId}`,
      evidenceClass: 'reviewed-contract',
      confidence: 'high',
    },
  },
});

async function selectScenario(page: Page, scenario: Scenario) {
  const row = page.locator(`button[data-scenario-id="${scenario.id}"]`);
  await row.click();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
}

async function expectExactNativePath(
  page: Page,
  graph: PresentationGraph,
  scenario: Scenario,
) {
  const activeNodes = new Set(scenario.orderedPath);
  const activeEdges = new Set(scenario.traversedEdges.map((edge) => edge.id));

  for (const node of graph.nodes) {
    await expect(page.getByTestId(`rf__node-${node.id}`)).toHaveClass(
      activeNodes.has(node.id)
        ? /scenario-state--active/
        : /scenario-state--dimmed/,
    );
  }
  for (const edge of graph.edges) {
    await expect(page.getByTestId(`rf__edge-${edge.id}`)).toHaveClass(
      activeEdges.has(edge.id)
        ? /scenario-state--active/
        : /scenario-state--dimmed/,
    );
  }
}

test('V01 — Design, Runtime, Proposal, and Scenario are projections over accepted truth and history', async ({ app }) => {
  const initialTruth = await readGraph(app);
  await loadParallelResearchDemo(app);
  const designTruth = await readGraph(app);
  const designHistory = await historyAvailability(app);
  expect(designHistory).toEqual({ undo: true, redo: false });
  await expect(projectionMode(app, 'Design')).toHaveAttribute('aria-checked', 'true');

  await projectionMode(app, 'Runtime').click();
  await expect(projectionMode(app, 'Runtime')).toHaveAttribute('aria-checked', 'true');
  await expect(app.locator('.runtime-instance-node')).toHaveCount(3);
  expect((await readGraph(app)).graph).toEqual(designTruth.graph);
  expect(await historyAvailability(app)).toEqual({ undo: false, redo: false });

  await projectionMode(app, 'Design').click();
  await expect(app.locator('.runtime-instance-node')).toHaveCount(0);
  expect((await readGraph(app)).graph).toEqual(designTruth.graph);
  expect(await historyAvailability(app)).toEqual(designHistory);

  await app.getByRole('button', { name: 'Undo' }).click();
  expect((await readGraph(app)).graph).toEqual(initialTruth.graph);
  await expect(app.getByRole('button', { name: 'Redo' })).toBeEnabled();
  await app.getByRole('button', { name: 'Redo' }).click();
  expect((await readGraph(app)).graph).toEqual(designTruth.graph);
  expect(await historyAvailability(app)).toEqual(designHistory);

  const proposedLabel = 'Presentation-only query planner';
  const proposal = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: designTruth.graph.updatedAt,
    rationale: 'V01 proposal projection must not mutate accepted truth.',
    operations: [
      {
        type: 'update_node',
        nodeId: 'generate-queries',
        patch: { label: proposedLabel },
      },
    ],
  });
  expect(proposal).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  await expect(projectionMode(app, 'Proposal')).toHaveAttribute('aria-checked', 'true');
  expect((await readGraph(app)).graph).toEqual(designTruth.graph);

  await app.getByRole('button', { name: 'Approve' }).click();
  const approved = await readGraph(app);
  expect(approved.graph.nodes.find((node) => node.id === 'generate-queries')?.label).toBe(
    proposedLabel,
  );
  expect(approved.pendingProposal).toBeUndefined();
  expect(await historyAvailability(app)).toEqual(designHistory);

  await app.getByRole('button', {
    name: 'Confirm and freeze contract; currently draft',
  }).click();
  const scenarioTruth = await readGraph(app);
  expect(scenarioTruth.graph.status).toBe('frozen');
  await expect(projectionMode(app, 'Scenario')).toHaveAttribute('aria-checked', 'true');
  const frozenHistory = await historyAvailability(app);

  await projectionMode(app, 'Design').click();
  expect((await readGraph(app)).graph).toEqual(scenarioTruth.graph);
  expect(await historyAvailability(app)).toEqual(frozenHistory);
  await projectionMode(app, 'Scenario').click();
  expect((await readGraph(app)).graph).toEqual(scenarioTruth.graph);
  expect(await historyAvailability(app)).toEqual(frozenHistory);
});

test('V02 — proposal overview reports every change family by stable identity at desktop width', async ({ app }) => {
  await app.setViewportSize({ width: 1440, height: 900 });
  const accepted = await readGraph(app);
  const relationship = externalRelationship(
    'judge-audit-boundary',
    'classifier',
    'judge-audit-system',
    'Judge audit boundary',
  );
  const result = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    rationale: 'V02 complete proposal overview inventory.',
    operations: [
      {
        type: 'add_node',
        node: {
          id: 'judge-review-step',
          kind: 'step',
          executor: 'deterministic',
          label: 'Judge review step',
          position: { x: 720, y: 380 },
        },
      },
      {
        type: 'update_node',
        nodeId: 'classifier',
        patch: { label: 'Judge-routed classifier' },
      },
      { type: 'remove_node', nodeId: 'human' },
      {
        type: 'add_subgraph',
        subgraph: {
          id: 'judge-review-zone',
          label: 'Judge review zone',
          position: { x: 380, y: 20 },
          dimensions: { width: 640, height: 360 },
          collapsed: false,
        },
      },
      {
        type: 'add_node',
        node: {
          id: 'judge-zone-start',
          kind: 'start',
          label: 'Judge zone start',
          parentId: 'judge-review-zone',
          position: { x: 40, y: 140 },
        },
      },
      {
        type: 'add_node',
        node: {
          id: 'judge-zone-end',
          kind: 'end',
          label: 'Judge zone end',
          parentId: 'judge-review-zone',
          position: { x: 480, y: 140 },
        },
      },
      {
        type: 'assign_nodes_to_subgraph',
        subgraphId: 'judge-review-zone',
        nodeIds: ['billing'],
      },
      { type: 'remove_edge', edgeId: 'classifier-billing' },
      { type: 'remove_edge', edgeId: 'billing-refund' },
      {
        type: 'add_edge',
        edge: {
          id: 'classifier-judge-zone-start',
          source: 'classifier',
          target: 'judge-zone-start',
          mode: 'conditional',
          label: 'billing',
          condition: 'route.billing',
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'judge-zone-start-billing',
          source: 'judge-zone-start',
          target: 'billing',
          mode: 'normal',
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'billing-judge-zone-end',
          source: 'billing',
          target: 'judge-zone-end',
          mode: 'normal',
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'judge-zone-end-refund',
          source: 'judge-zone-end',
          target: 'refund',
          mode: 'normal',
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'classifier-judge-review',
          source: 'classifier',
          target: 'judge-review-step',
          mode: 'conditional',
          label: 'judge review',
          condition: 'route.judgeReview',
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'judge-review-end',
          source: 'judge-review-step',
          target: 'end',
          mode: 'normal',
        },
      },
      {
        type: 'update_graph_capabilities',
        patch: {
          store: {
            available: true,
            namespace: 'judge-review',
            retention: 'session',
          },
          provenance: { externalOrchestrationAvailable: true },
        },
      },
      { type: 'add_relationship', relationship },
    ],
  });
  expect(result).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  expect((await readGraph(app)).graph).toEqual(accepted.graph);

  const comparison = app.getByRole('region', { name: 'Graph overview' });
  await expect(comparison).toBeVisible();
  const overviewCanvases = comparison.locator('.proposal-overview-canvas');
  await expect(overviewCanvases).toHaveCount(1);
  const summary = comparison.getByLabel('Proposal diff summary');
  for (const surface of [overviewCanvases.nth(0), summary]) {
    await surface.scrollIntoViewIfNeeded();
    await expect(surface).toBeVisible();
    const geometry = await surface.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.width).toBeGreaterThan(0);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  }
  await expect(summary).toContainText('Nodes');
  await expect(summary).toContainText('added judge-review-step');
  await expect(summary).toContainText('updated classifier (label)');
  await expect(summary).toContainText('removed human');
  await expect(summary).toContainText('Subgraphs');
  await expect(summary).toContainText('added judge-review-zone');
  await expect(summary).toContainText('Native edges');
  await expect(summary).toContainText('added classifier-judge-review');
  await expect(summary).toContainText('removed classifier-billing');
  await expect(summary).toContainText('removed classifier-human');
  await expect(summary).toContainText('Non-native relationships');
  await expect(summary).toContainText('added judge-audit-boundary');
  await expect(summary).toContainText('Capabilities');
  await expect(summary).toContainText('updated graph.provenance');
  await expect(summary).toContainText('updated graph.store');

  await summary.getByRole('button', { name: 'Review updated billing' }).click();
  const membership = app.getByLabel('Changed fields for billing');
  await expect(membership).toContainText('parentId');
  await expect(membership).toContainText('judge-review-zone');
  await app.getByRole('button', { name: 'Back to proposal' }).click();

  await summary.getByRole('button', { name: 'Review updated classifier' }).click();
  await expect(app.getByLabel('Changed fields for classifier')).toContainText('Judge-routed classifier');
  await app.getByRole('button', { name: 'Back to proposal' }).click();

  await summary.getByRole('button', { name: 'Review added judge-audit-boundary' }).click();
  await expect(app.getByLabel('Changed fields for judge-audit-boundary')).toContainText('Judge audit boundary');
  await app.getByRole('button', { name: 'Back to proposal' }).click();

  const box = await comparison.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
  await expectNoHorizontalPageOverflow(app);
  await app.getByRole('button', { name: 'Reject' }).click();
  expect((await readGraph(app)).graph).toEqual(accepted.graph);
});

test('V03 — changing scenarios highlights exact native paths and preserves collapsed boundary semantics', async ({ app }) => {
  await loadHierarchicalResearch(app);
  const activeRelationship = externalRelationship(
    'v03-frame-review-boundary',
    'frame-question',
    'v03-review-boundary',
    'V03 review boundary',
  );
  const conditionalRelationship = externalRelationship(
    'v03-evidence-archive-boundary',
    'inspect-evidence',
    'v03-archive-boundary',
    'V03 archive boundary',
  );
  const beforeProposal = await readGraph(app);
  const proposal = await callWebMcpTool<ProposalResult>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: beforeProposal.graph.updatedAt,
    rationale: 'V03 non-native scenario presentation.',
    operations: [
      {
        type: 'update_graph_capabilities',
        patch: { provenance: { externalOrchestrationAvailable: true } },
      },
      { type: 'add_relationship', relationship: activeRelationship },
      { type: 'add_relationship', relationship: conditionalRelationship },
    ],
  });
  expect(proposal).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  await app.getByRole('button', { name: 'Approve' }).click();
  await app.getByRole('button', {
    name: 'Confirm and freeze contract; currently draft',
  }).click();

  const expandedFrozen = await readGraph(app);
  const expandedScenarioRead = await callWebMcpTool<ScenarioRead>(
    app,
    'get_branch_scenarios',
    {},
  );
  expect(expandedScenarioRead.ok).toBe(true);
  const direct = expandedScenarioRead.scenarios?.find(
    (scenario) =>
      scenario.orderedPath.includes('frame-question') &&
      !scenario.orderedPath.includes('inspect-evidence'),
  );
  const withEvidence = expandedScenarioRead.scenarios?.find((scenario) =>
    scenario.orderedPath.includes('inspect-evidence'),
  );
  expect(direct).toBeDefined();
  expect(withEvidence).toBeDefined();

  await selectScenario(app, direct!);
  await expectExactNativePath(app, expandedFrozen.graph, direct!);
  const activeBoundary = app.getByTestId(
    'rf__edge-system-relationship:v03-frame-review-boundary',
  );
  const conditionalBoundary = app.getByTestId(
    'rf__edge-system-relationship:v03-evidence-archive-boundary',
  );
  await expect(activeBoundary).toHaveClass(/scenario-state--active/);
  await expect(conditionalBoundary).toHaveClass(/scenario-state--dimmed/);

  await selectScenario(app, withEvidence!);
  await expectExactNativePath(app, expandedFrozen.graph, withEvidence!);
  await expect(activeBoundary).toHaveClass(/scenario-state--active/);
  await expect(conditionalBoundary).toHaveClass(/scenario-state--active/);
  expect((await readGraph(app)).graph).toEqual(expandedFrozen.graph);

  await app.getByRole('button', { name: 'Unfreeze contract; currently frozen' }).click();
  const collapseInspector = app.getByRole('button', { name: 'Collapse inspector' });
  if (await collapseInspector.count()) await collapseInspector.click();
  await app.getByRole('button', { name: 'Collapse subgraph Research Supervisor' }).click();
  await app.getByRole('button', {
    name: 'Confirm and freeze contract; currently draft',
  }).click();
  const collapsedFrozen = await readGraph(app);
  expect(collapsedFrozen.graph.subgraphs).toEqual([
    expect.objectContaining({ id: 'research-cell', collapsed: true }),
  ]);
  const collapsedScenarioRead = await callWebMcpTool<ScenarioRead>(
    app,
    'get_branch_scenarios',
    {},
  );
  const collapsedDirect = collapsedScenarioRead.scenarios?.find(
    (scenario) =>
      scenario.orderedPath.includes('frame-question') &&
      !scenario.orderedPath.includes('inspect-evidence'),
  );
  expect(collapsedDirect).toBeDefined();
  await selectScenario(app, collapsedDirect!);

  await expect(
    app.getByTestId('rf__edge-subgraph-proxy:write-brief:research-cell'),
  ).toHaveClass(/scenario-state--active/);
  await expect(
    app.getByTestId('rf__edge-system-relationship:v03-frame-review-boundary'),
  ).toHaveClass(/scenario-state--active/);
  await expect(
    app.getByTestId('rf__edge-system-relationship:v03-evidence-archive-boundary'),
  ).toHaveClass(/scenario-state--dimmed/);
  await expect(app.getByTestId('rf__node-external-system:v03-review-boundary')).toHaveClass(
    /scenario-state--active/,
  );
  await expect(app.getByTestId('rf__node-external-system:v03-archive-boundary')).toHaveClass(
    /scenario-state--dimmed/,
  );

  const afterSelection = await readGraph(app);
  expect(afterSelection.graph).toEqual(collapsedFrozen.graph);
  expect(afterSelection.graph.edges.some((edge) => edge.id.startsWith('subgraph-proxy:'))).toBe(
    false,
  );
  expect(afterSelection.graph.relationships).toEqual([
    activeRelationship,
    conditionalRelationship,
  ]);
  for (const scenario of collapsedScenarioRead.scenarios ?? []) {
    expect(scenario.orderedPath).not.toContain('v03-review-boundary');
    expect(scenario.orderedPath).not.toContain('v03-archive-boundary');
  }
});

test('V04 — projection radios retain keyboard semantics and names at 390, 768, and 1024', async ({ app }) => {
  await loadParallelResearchDemo(app);
  const accepted = await readGraph(app);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 820 },
    { width: 1024, height: 768 },
  ]) {
    await test.step(`${viewport.width}px`, async () => {
      await app.setViewportSize(viewport);
      const group = app.getByRole('radiogroup', { name: 'Canvas projection' });
      const design = group.getByRole('radio', { name: 'Design', exact: true });
      const runtime = group.getByRole('radio', { name: 'Runtime', exact: true });
      const scenario = group.getByRole('radio', {
        name: 'Scenario unavailable: Freeze a valid contract to generate scenarios.',
        exact: true,
      });
      const proposal = group.getByRole('radio', {
        name: 'Proposal unavailable: No proposal is awaiting human review.',
        exact: true,
      });

      await expect(group).toBeVisible();
      await expect(group).toHaveAttribute('aria-orientation', 'horizontal');
      await expect(design).toHaveAccessibleName('Design');
      await expect(runtime).toHaveAccessibleName('Runtime');
      await expect(scenario).toBeDisabled();
      await expect(proposal).toBeDisabled();
      for (const radio of [design, scenario, proposal, runtime]) {
        await expect(radio).toBeVisible();
        const rect = await radio.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.y).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height);
      }

      await design.focus();
      await expect(design).toBeFocused();
      await design.press('Enter');
      await design.press('ArrowRight');
      await expect(runtime).toBeFocused();
      await expect(runtime).toHaveAttribute('aria-checked', 'true');

      await runtime.press('Home');
      await expect(design).toBeFocused();
      await expect(design).toHaveAttribute('aria-checked', 'true');

      await design.press('End');
      await expect(runtime).toBeFocused();
      await expect(runtime).toHaveAttribute('aria-checked', 'true');

      await runtime.press('ArrowLeft');
      await expect(design).toBeFocused();
      await expect(design).toHaveAttribute('aria-checked', 'true');
      expect((await readGraph(app)).graph).toEqual(accepted.graph);
      await expectNoHorizontalPageOverflow(app);
    });
  }
});
