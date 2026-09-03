import type { Page } from '@playwright/test';

import {
  callWebMcpTool,
  confirmGraphLibraryReplacement,
  expect,
  test,
  webMcpToolNames,
} from './fixtures';

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
      parentId?: string;
      position: { x: number; y: number };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      mode: string;
      loopCap?: number;
      send?: {
        multiplicity: string;
        mergeNodeId: string;
        templateAnatomy?: {
          canonicalTemplateNodeId: string;
          dimensions: { width: number; height: number };
        };
      };
    }>;
    subgraphs: Array<{
      id: string;
      parentId?: string;
      position: { x: number; y: number };
      dimensions: { width: number; height: number };
      collapsed: boolean;
    }>;
  };
  validation: { validForFreeze: boolean; issues: unknown[] };
  pendingProposal?: { status: string };
};

type ScenarioRead = {
  ok: boolean;
  graphId?: string;
  scenarios?: Array<{
    id: string;
    name: string;
    orderedPath: string[];
  }>;
};

const entries = [
  ['Research Supervisor', 'vijaybadana/graphcontract'],
  ['Research Intake Routing', 'vijaybadana/graphcontract'],
  ['Human Control & HITL', 'vijaybadana/graphcontract'],
  ['Parallel research · Send ×N', 'vijaybadana/graphcontract'],
  ['Hierarchical Deep Research', 'langchain-ai/open_deep_research'],
  ['Guarded Coding-Agent Delivery', 'langchain-ai/open-swe'],
  ['Evidence-to-Approved Social Content', 'CopilotKit/open-fullstack-social-media-agent'],
  ['Multi-Stage Expert Review', 'TauricResearch/TradingAgents'],
  ['Guarded Natural-Language-to-SQL', 'tharunramavath/AI-Powered-SQL-Agent'],
  ['Email Triage with Human Review', 'langchain-ai/agents-from-scratch-ts'],
  ['Human-Approved Incident Response', 'AttiR/OpsCanvas'],
  ['Specialist Travel Support', 'ro-anderson/multi-agent-rag-customer-support'],
  ['Voice Specialist Handoffs', 'langchain-ai/pipecat-langgraph-example'],
  ['Parallel Research with Reflection', 'google-gemini/gemini-fullstack-langgraph-quickstart'],
] as const;

async function readGraph(page: Page) {
  return (await callWebMcpTool<GraphRead>(page, 'get_graph', {})).graph;
}

async function openLibrary(page: Page) {
  await page.getByRole('button', { name: 'Workflow library, 14 templates' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function openEntry(page: Page, title: string) {
  await page.getByRole('button', { name: `Open ${title}` }).click();
  await confirmGraphLibraryReplacement(page, title);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('Graph Library exposes all fourteen normalized templates through search, domain and concept filters', async ({ app }) => {
  await openLibrary(app);
  await expect(app.getByText('Workflow templates', { exact: true })).toHaveCount(0);
  await expect(app.getByRole('dialog').locator('.graph-library-sheet__toolbar').getByText('Graph library', { exact: true })).toHaveCount(0);
  await expect(app.getByText('Showing 14 of 14 templates', { exact: true })).toHaveClass(/sr-only/);
  expect(await webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);

  for (const [title, source] of entries) {
    const card = app.getByRole('button', { name: `Open ${title}` }).locator('..');
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: `Open ${source} on GitHub` })).toBeVisible();
  }
  await expect(app.getByText('Normalized — no source code copied', { exact: true })).toHaveCount(0);
  await expect(app.getByText('Open graph', { exact: true })).toHaveCount(0);

  const search = app.getByRole('searchbox', { name: 'Search graph library' });
  await search.fill('OpsCanvas');
  await expect(app.getByText('Showing 1 of 14 templates', { exact: true })).toHaveClass(/sr-only/);
  await expect(app.getByRole('button', { name: 'Open Human-Approved Incident Response' })).toBeVisible();

  await search.fill('');
  await app.getByRole('button', { name: 'research', exact: true }).click();
  await expect(app.getByText('Showing 5 of 14 templates', { exact: true })).toHaveClass(/sr-only/);
  await app.getByRole('button', { name: 'merge', exact: true }).click();
  await expect(app.getByText('Showing 3 of 14 templates', { exact: true })).toHaveClass(/sr-only/);
  await expect(app.getByRole('button', { name: 'Open Parallel Research with Reflection' })).toBeVisible();

  await search.fill('not-a-library-template');
  await expect(app.getByRole('heading', { name: 'No matching templates' })).toBeVisible();
  await expect(app.getByText('Your existing graph remains unchanged while browsing.')).toBeVisible();
  await app.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(app.getByText('Showing 14 of 14 templates', { exact: true })).toHaveClass(/sr-only/);
});

test('Graph Library keeps keyboard focus, closes accessibly, and isolates GitHub source links', async ({ app }) => {
  const trigger = app.getByRole('button', { name: 'Workflow library, 14 templates' });
  await trigger.focus();
  await trigger.press('Enter');
  const search = app.getByRole('searchbox', { name: 'Search graph library' });
  await expect(search).toBeFocused();
  await app.keyboard.press('Escape');
  await expect(app.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  const before = await readGraph(app);
  await openLibrary(app);
  const source = app.getByRole('link', {
    name: 'Open langchain-ai/open_deep_research on GitHub',
  });
  await expect(source).toHaveAttribute('href', 'https://github.com/langchain-ai/open_deep_research');
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  const popup = app.waitForEvent('popup');
  await source.click();
  await (await popup).close();
  expect(await readGraph(app)).toEqual(before);
});

test('library replacement confirms Cancel, then Open, Undo, reload, and automatic Fit', async ({ app }) => {
  const before = await readGraph(app);
  const beforeViewport = await app.locator('.react-flow__viewport').getAttribute('style');
  await openLibrary(app);
  await app.getByRole('button', { name: 'Open Guarded Coding-Agent Delivery' }).click();
  const confirmation = app.getByRole('alertdialog', { name: 'Open “Guarded Coding-Agent Delivery”?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancel' }).click();
  expect(await readGraph(app)).toEqual(before);
  await expect(app.getByRole('dialog', { name: 'Graph library' })).toBeVisible();

  await openEntry(app, 'Guarded Coding-Agent Delivery');
  expect((await readGraph(app)).id).toBe('library-guarded-coding-agent-delivery');
  await expect
    .poll(() => app.locator('.react-flow__viewport').getAttribute('style'))
    .not.toBe(beforeViewport);

  await app.getByRole('button', { name: 'Undo' }).click();
  expect(await readGraph(app)).toEqual(before);
  await app.getByRole('button', { name: 'Redo' }).click();
  await app.reload();
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  expect((await readGraph(app)).id).toBe('library-guarded-coding-agent-delivery');
  await expect(app.getByRole('button', { name: 'Fit graph' })).toBeEnabled();
});

test('library loads representative subgraph, HITL, and Send/Merge workflows onto the canvas', async ({ app }) => {
  await app.setViewportSize({ width: 1440, height: 900 });
  await openLibrary(app);
  await openEntry(app, 'Hierarchical Deep Research');
  const hierarchical = await readGraph(app);
  expect(hierarchical.subgraphs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'research-cell' }),
      expect.objectContaining({ id: 'researcher-workflow', parentId: 'research-cell' }),
    ]),
  );
  expect(hierarchical.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'frame-question', label: 'Plan research', parentId: 'research-cell' }),
    expect.objectContaining({ id: 'researcher-agent', label: 'Researcher Agent', parentId: 'researcher-workflow' }),
    expect.objectContaining({ id: 'research-merge', kind: 'merge', parentId: 'researcher-workflow' }),
  ]));
  expect(hierarchical.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: 'dispatch-send',
      mode: 'send',
      target: 'researcher-agent',
      send: expect.objectContaining({
        multiplicity: 'dynamic',
        mergeNodeId: 'research-merge',
        templateAnatomy: expect.objectContaining({ canonicalTemplateNodeId: 'researcher-agent' }),
      }),
    }),
    expect.objectContaining({ id: 'researcher-supervisor-loop', source: 'review-findings', target: 'frame-question', loopCap: 5 }),
  ]));
  await expect(app.getByTestId('rf__node-research-cell')).toBeVisible();
  const researcherSubgraph = app.getByTestId('rf__node-researcher-workflow');
  const researcherAgent = app.getByTestId('rf__node-researcher-agent');
  await expect(researcherSubgraph).toBeVisible();
  await expect(researcherAgent).toBeVisible();
  const dynamicWorkerGroup = app.getByTestId('rf__node-dynamic-worker-group:dispatch-send');
  await expect(dynamicWorkerGroup).toBeVisible();
  await app.getByRole('button', { name: 'Fit graph' }).click();
  await app.waitForTimeout(250);
  const [canvasBounds, subgraphBounds, researcherBounds, templateBounds, mergeBounds, reportBounds] = await Promise.all([
    app.locator('.react-flow').boundingBox(),
    app.getByTestId('rf__node-research-cell').boundingBox(),
    researcherSubgraph.boundingBox(),
    researcherAgent.boundingBox(),
    app.getByTestId('rf__node-research-merge').boundingBox(),
    app.getByTestId('rf__node-final-report').boundingBox(),
  ]);
  expect(canvasBounds).not.toBeNull();
  expect(subgraphBounds).not.toBeNull();
  expect(researcherBounds).not.toBeNull();
  expect(templateBounds).not.toBeNull();
  expect(mergeBounds).not.toBeNull();
  expect(reportBounds).not.toBeNull();
  expect(researcherBounds!.x).toBeGreaterThanOrEqual(subgraphBounds!.x - 1);
  expect(researcherBounds!.y).toBeGreaterThanOrEqual(subgraphBounds!.y - 1);
  expect(researcherBounds!.x + researcherBounds!.width).toBeLessThanOrEqual(subgraphBounds!.x + subgraphBounds!.width + 1);
  expect(researcherBounds!.y + researcherBounds!.height).toBeLessThanOrEqual(subgraphBounds!.y + subgraphBounds!.height + 1);
  expect(templateBounds!.x).toBeGreaterThan(researcherBounds!.x);
  expect(templateBounds!.y).toBeGreaterThan(researcherBounds!.y);
  expect(templateBounds!.x + templateBounds!.width).toBeLessThan(researcherBounds!.x + researcherBounds!.width);
  expect(templateBounds!.y + templateBounds!.height).toBeLessThan(researcherBounds!.y + researcherBounds!.height);
  expect(mergeBounds!.x).toBeGreaterThan(templateBounds!.x);
  expect(reportBounds!.x + reportBounds!.width).toBeLessThanOrEqual(canvasBounds!.x + canvasBounds!.width - 8);

  const beforeDynamicMove = await readGraph(app);
  const beforeTemplatePosition = beforeDynamicMove.nodes.find(
    (node) => node.id === 'researcher-agent',
  )!.position;
  const dynamicBody = dynamicWorkerGroup.locator('.dynamic-worker-group-body-drag-surface');
  const dynamicBodyBounds = await dynamicBody.boundingBox();
  expect(dynamicBodyBounds).not.toBeNull();
  const dynamicDragX = dynamicBodyBounds!.x + dynamicBodyBounds!.width / 2;
  const dynamicDragY = dynamicBodyBounds!.y + dynamicBodyBounds!.height * 0.85;
  await app.mouse.move(dynamicDragX, dynamicDragY);
  await app.mouse.down();
  await app.mouse.move(dynamicDragX + 18, dynamicDragY + 10, { steps: 5 });
  await app.mouse.up();
  await expect.poll(async () => (
    await readGraph(app)
  ).nodes.find((node) => node.id === 'researcher-agent')?.position).not.toEqual(beforeTemplatePosition);

  // The frame's broad drag surface must not cover real canonical members.
  await researcherAgent.click();
  await expect(app.getByRole('heading', { name: 'Researcher Agent' })).toBeVisible();

  const dynamicHeader = dynamicWorkerGroup.locator('.dynamic-worker-group-header');
  await dynamicHeader.click();
  await expect(dynamicWorkerGroup.locator('.dynamic-worker-group')).toHaveClass(/is-active/);
  const beforeDynamicResize = await readGraph(app);
  const beforeAnatomyDimensions = beforeDynamicResize.edges.find(
    (edge) => edge.id === 'dispatch-send',
  )!.send!.templateAnatomy!.dimensions;
  const dynamicResizeHandle = dynamicWorkerGroup.locator('.dynamic-worker-group-resize-control');
  await expect(dynamicResizeHandle).toBeVisible();
  await dynamicResizeHandle.hover();
  const dynamicResizeBounds = await dynamicResizeHandle.boundingBox();
  expect(dynamicResizeBounds).not.toBeNull();
  await app.mouse.move(
    dynamicResizeBounds!.x + dynamicResizeBounds!.width / 2,
    dynamicResizeBounds!.y + dynamicResizeBounds!.height / 2,
  );
  await app.mouse.down();
  await app.mouse.move(dynamicResizeBounds!.x + 18, dynamicResizeBounds!.y + 4, { steps: 5 });
  await app.mouse.up();
  await expect.poll(async () => (
    await readGraph(app)
  ).edges.find((edge) => edge.id === 'dispatch-send')?.send?.templateAnatomy?.dimensions.width)
    .toBeGreaterThan(beforeAnatomyDimensions.width);

  await researcherSubgraph.locator('.subgraph-node-header').click();
  await expect(researcherSubgraph).toHaveClass(/selected/);
  await expect(app.getByRole('heading', { name: 'Researcher ×N' })).toBeVisible();

  const beforeResize = await readGraph(app);
  const beforeResizeSubgraph = beforeResize.subgraphs.find(
    (subgraph) => subgraph.id === 'researcher-workflow',
  )!;
  const beforeResizeChildren = Object.fromEntries(
    beforeResize.nodes
      .filter((node) => node.parentId === 'researcher-workflow')
      .map((node) => [node.id, node.position]),
  );
  const resizeHandle = researcherSubgraph.locator('.subgraph-node-resize-control');
  await expect(resizeHandle).toBeVisible();
  await resizeHandle.hover();
  const resizeBounds = await resizeHandle.boundingBox();
  expect(resizeBounds).not.toBeNull();
  await app.mouse.move(
    resizeBounds!.x + resizeBounds!.width / 2,
    resizeBounds!.y + resizeBounds!.height / 2,
  );
  await app.mouse.down();
  await app.mouse.move(resizeBounds!.x + 28, resizeBounds!.y + 28, { steps: 5 });
  await app.mouse.up();
  await expect.poll(async () => (
    await readGraph(app)
  ).subgraphs.find((subgraph) => subgraph.id === 'researcher-workflow')?.dimensions)
    .not.toEqual(beforeResizeSubgraph.dimensions);
  const afterResize = await readGraph(app);
  const resizedSubgraph = afterResize.subgraphs.find(
    (subgraph) => subgraph.id === 'researcher-workflow',
  )!;
  const outerSubgraph = afterResize.subgraphs.find((subgraph) => subgraph.id === 'research-cell')!;
  expect(resizedSubgraph.position.x + resizedSubgraph.dimensions.width)
    .toBeLessThanOrEqual(outerSubgraph.dimensions.width - 36);
  expect(resizedSubgraph.position.y + resizedSubgraph.dimensions.height)
    .toBeLessThanOrEqual(outerSubgraph.dimensions.height - 36);
  expect(Object.fromEntries(
    afterResize.nodes
      .filter((node) => node.parentId === 'researcher-workflow')
      .map((node) => [node.id, node.position]),
  )).toEqual(beforeResizeChildren);

  const beforeMove = await readGraph(app);
  const beforeResearcher = beforeMove.subgraphs.find((subgraph) => subgraph.id === 'researcher-workflow')!;
  const childPositions = Object.fromEntries(
    beforeMove.nodes
      .filter((node) => node.parentId === 'researcher-workflow')
      .map((node) => [node.id, node.position]),
  );
  const header = researcherSubgraph.locator('.subgraph-node-header');
  const headerBounds = await header.boundingBox();
  expect(headerBounds).not.toBeNull();
  await app.mouse.move(headerBounds!.x + 80, headerBounds!.y + 20);
  await app.mouse.down();
  await app.mouse.move(headerBounds!.x + 120, headerBounds!.y + 44, { steps: 5 });
  await app.mouse.up();
  await expect.poll(async () => (
    await readGraph(app)
  ).subgraphs.find((subgraph) => subgraph.id === 'researcher-workflow')?.position).not.toEqual(beforeResearcher.position);
  const afterMove = await readGraph(app);
  expect(Object.fromEntries(
    afterMove.nodes
      .filter((node) => node.parentId === 'researcher-workflow')
      .map((node) => [node.id, node.position]),
  )).toEqual(childPositions);

  await openLibrary(app);
  await openEntry(app, 'Human-Approved Incident Response');
  const hitl = await readGraph(app);
  expect(hitl.nodes.find((node) => node.id === 'apply-response')).toMatchObject({ executor: 'tool' });
  await expect(app.getByTestId('rf__node-apply-response')).toBeVisible();
  await expect(app.getByTestId('rf__node-apply-response').getByLabel(/Human-in-the-loop gate/).first()).toBeVisible();

  await openLibrary(app);
  await openEntry(app, 'Parallel Research with Reflection');
  const parallel = await readGraph(app);
  expect(parallel.nodes.find((node) => node.id === 'research-merge')).toMatchObject({ kind: 'merge' });
  expect(parallel.edges.find((edge) => edge.id === 'questions-send')).toMatchObject({ mode: 'send' });
  await expect(app.getByTestId('rf__node-research-merge')).toBeVisible();
  await expect(app.locator('[data-edge-id="questions-send"]')).toHaveAttribute('data-mode', 'send');
});

test('all fourteen library templates freeze, select a scenario, and persist through reload', async ({ app }) => {
  test.setTimeout(240_000);

  for (const [title] of entries) {
    await test.step(title, async () => {
      await openLibrary(app);
      await openEntry(app, title);

      const loaded = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
      expect(loaded.graph).toMatchObject({ status: 'draft' });
      expect(loaded.validation).toEqual({ validForFreeze: true, issues: [] });

      await app.getByRole('button', { name: 'Confirm and freeze contract; currently draft' }).click();
      const projection = app.getByRole('radiogroup', { name: 'Canvas projection' });
      await expect(projection.getByRole('radio', { name: 'Scenario', exact: true })).toHaveAttribute(
        'aria-checked',
        'true',
      );

      const scenarios = await callWebMcpTool<ScenarioRead>(app, 'get_branch_scenarios', {});
      expect(scenarios).toMatchObject({ ok: true, graphId: loaded.graph.id });
      const selected = scenarios.scenarios?.[0];
      expect(selected).toBeDefined();
      const scenarioRow = app.locator(`button[data-scenario-id="${selected!.id}"]`);
      await scenarioRow.click();
      await expect(scenarioRow).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => app.locator('.scenario-state--active').count()).toBeGreaterThan(0);

      const frozen = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
      expect(frozen.graph.status).toBe('frozen');
      await app.reload();
      await expect.poll(() => webMcpToolNames(app)).toEqual([
        'get_branch_scenarios',
        'get_graph',
        'propose_graph_changes',
      ]);

      const reloaded = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
      expect(reloaded.graph).toEqual(frozen.graph);
      expect(reloaded.validation).toEqual({ validForFreeze: true, issues: [] });
      expect(await callWebMcpTool<ScenarioRead>(app, 'get_branch_scenarios', {})).toEqual(scenarios);
      await expect(app.locator('.scenario-state--active')).toHaveCount(0);
      await expect(app.locator('.scenario-state--dimmed')).toHaveCount(0);

      await app.getByRole('button', { name: 'Unfreeze contract; currently frozen' }).click();
      await expect.poll(async () => (await readGraph(app)).status).toBe('draft');
    });
  }
});

test('frozen and pending proposals block library replacement while the drawer remains reachable', async ({ app }) => {
  await app.getByRole('button', { name: /confirm (?:and|&) freeze/i }).click();
  await openLibrary(app);
  const frozenAction = app.getByRole('button', { name: /Open Hierarchical Deep Research unavailable/ });
  await expect(frozenAction).toBeDisabled();
  await expect(app.getByRole('status').filter({
    hasText: 'Unfreeze the contract before opening a library graph.',
  })).toBeVisible();
  await app.getByRole('button', { name: 'Close graph library' }).click();
  await app.locator('.workspace-freeze-button').click();

  const accepted = await readGraph(app);
  await callWebMcpTool(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.updatedAt,
    operations: [{ type: 'update_node', nodeId: 'classifier', patch: { label: 'Library lock preview' } }],
    rationale: 'E2E library replacement lock.',
  });
  await openLibrary(app);
  const proposalAction = app.getByRole('button', { name: /Open Hierarchical Deep Research unavailable/ });
  await expect(proposalAction).toBeDisabled();
  await expect(app.getByRole('status').filter({
    hasText: 'Library replacement is blocked while a proposal awaits human review.',
  })).toBeVisible();
  expect((await callWebMcpTool<GraphRead>(app, 'get_graph', {})).pendingProposal).toMatchObject({ status: 'pending' });
});

test('Graph Library drawer remains reachable at compact and desktop breakpoints', async ({ app }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 820 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await app.setViewportSize(viewport);
    const trigger = app.getByRole('button', { name: 'Workflow library, 14 templates' });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = app.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    await expect(app.getByRole('searchbox', { name: 'Search graph library' })).toBeVisible();
    await expect(app.getByRole('button', { name: 'Close graph library' })).toBeVisible();
    await app.keyboard.press('Escape');
  }
});
