import type { Page } from '@playwright/test';

import {
  callWebMcpTool,
  expect,
  freezeResearchIntake,
  loadGraphLibraryEntry,
  test,
} from './fixtures';

type CompactGraphRead = {
  ok: true;
  graph: { updatedAt: string; nodes: Array<{ id: string; label: string }> };
};

async function expectNoHorizontalPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function loadResearchSupervisor(page: Page) {
  await loadGraphLibraryEntry(page, 'Research Supervisor', 'research-supervisor-demo');
  await expect(page.getByTestId('rf__node-research-supervisor')).toBeVisible();
  await expect(page.getByLabel('Graph status')).toContainText('6 nodes');
}

test('1440 desktop keeps palette and inspector independently operable', async ({ app }) => {
  await app.setViewportSize({ width: 1440, height: 900 });

  await expect(app.getByRole('button', { name: 'Collapse node palette' })).toBeVisible();
  await app.getByRole('button', { name: 'Show inspector' }).click();
  await expect(app.getByRole('button', { name: 'Collapse inspector' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Collapse node palette' })).toBeVisible();

  await app.getByRole('button', { name: 'Collapse node palette' }).click();
  await expect(app.getByRole('button', { name: 'Open Palette' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Collapse inspector' })).toBeVisible();
  await app.getByRole('button', { name: 'Open Palette' }).click();

  await app.getByRole('button', { name: 'Collapse inspector' }).click();
  await expect(app.getByRole('button', { name: 'Open Inspector' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Collapse node palette' })).toBeVisible();
  await expectNoHorizontalPageOverflow(app);
});

test('1024 compact workspace swaps palette and inspector instead of overlapping them', async ({ app }) => {
  await app.setViewportSize({ width: 1024, height: 768 });

  await expect(app.getByRole('img', { name: /Graph overview navigator/ })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Fit view' })).toBeVisible();
  await expect(app.getByLabel('Graph status')).toBeVisible();

  await expect(app.getByRole('button', { name: 'Collapse node palette' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Open Inspector' })).toBeVisible();
  await app.getByRole('button', { name: 'Show inspector' }).click();

  await expect(app.getByRole('button', { name: 'Collapse inspector' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Open Palette' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Collapse node palette' })).toHaveCount(0);

  await app.getByRole('button', { name: 'Open Palette' }).click();
  await expect(app.getByRole('button', { name: 'Collapse node palette' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Open Inspector' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Collapse inspector' })).toHaveCount(0);

  const accepted = await callWebMcpTool<CompactGraphRead>(app, 'get_graph', {});
  await callWebMcpTool(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.graph.updatedAt,
    rationale: 'E2E compact proposal presentation.',
    operations: [{ type: 'update_node', nodeId: 'classifier', patch: { label: 'Compact proposal' } }],
  });
  const projection = app.getByRole('radiogroup', { name: 'Canvas projection' });
  await expect(projection.getByRole('radio', { name: 'Proposal', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(app.getByRole('heading', { name: 'Proposal' })).toBeVisible();
  await expect(app.getByRole('heading', { name: 'Graph overview' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Collapse proposal panel' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Open Palette' })).toBeVisible();
  await app.getByRole('button', { name: 'Reject' }).click();
  await expectNoHorizontalPageOverflow(app);
});

test('768 tablet keeps editor chrome and contextual Design inspector reachable', async ({ app }) => {
  await app.setViewportSize({ width: 768, height: 820 });

  await expect(app.getByRole('button', { name: 'Fit graph' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Reset example graph' })).toBeVisible();
  await app.getByRole('button', { name: 'Open Inspector' }).click();
  await expect(app.getByRole('heading', { name: /Customer Support Workflow/ })).toBeVisible();
  await expect(app.getByRole('tab', { name: 'Edit & review' })).toHaveCount(0);
  await expect(app.getByRole('tab', { name: 'Scenarios' })).toHaveCount(0);
  await expect(app.getByRole('button', { name: 'Open Palette' })).toBeVisible();
  await expectNoHorizontalPageOverflow(app);
});

test('390 compact freeze and unfreeze retain accessible action names', async ({ app }) => {
  await app.setViewportSize({ width: 390, height: 844 });

  await expect(app.getByText('Graph overview', { exact: true })).toBeHidden();
  await expect(app.getByRole('img', { name: /Graph overview navigator/ })).toBeHidden();

  const freeze = app.locator('.workspace-freeze-button');
  await expect(freeze).toHaveAccessibleName('Confirm and freeze contract; currently draft');
  await freezeResearchIntake(app);
  await expect(freeze).toHaveAccessibleName('Unfreeze contract; currently frozen');
  const projection = app.getByRole('radiogroup', { name: 'Canvas projection' });
  await expect(projection.getByRole('radio', { name: 'Scenario', exact: true })).toHaveAttribute('aria-checked', 'true');
  const scenario = app.locator('button[data-scenario-id]').first();
  await expect(scenario).toBeVisible();
  await scenario.click();
  await expect(scenario).toHaveAttribute('aria-pressed', 'true');
  await expect(scenario).toHaveAttribute('aria-expanded', 'true');
  await expect(app.getByLabel('Path 1 details')).toBeVisible();
  await expect(app.getByLabel('Contract downloads')).toBeVisible();
  await expect(app.getByRole('button', { name: 'Collapse scenarios panel' })).toBeVisible();
  await freeze.click();
  await expect(freeze).toHaveAccessibleName('Confirm and freeze contract; currently draft');
  await expectNoHorizontalPageOverflow(app);
});

test('desktop panel separators resize by keyboard and reset by double click', async ({ app }) => {
  await app.setViewportSize({ width: 1440, height: 900 });
  await app.getByRole('button', { name: 'Show inspector' }).click();

  const inventoryResizer = app.getByRole('separator', { name: 'Resize node inventory' });
  await expect(inventoryResizer).toHaveAttribute('aria-valuenow', '232');
  await inventoryResizer.focus();
  await inventoryResizer.press('End');
  await expect(inventoryResizer).toHaveAttribute('aria-valuenow', '320');
  await inventoryResizer.dblclick();
  await expect(inventoryResizer).toHaveAttribute('aria-valuenow', '232');

  const inspectorResizer = app.getByRole('separator', { name: 'Resize inspector' });
  await expect(inspectorResizer).toHaveAttribute('aria-valuenow', '344');
  await inspectorResizer.focus();
  await inspectorResizer.press('Home');
  await expect(inspectorResizer).toHaveAttribute('aria-valuenow', '300');
  await inspectorResizer.press('End');
  await expect(inspectorResizer).toHaveAttribute('aria-valuenow', '460');
  await inspectorResizer.dblclick();
  await expect(inspectorResizer).toHaveAttribute('aria-valuenow', '344');
});

test('canvas chrome exposes named zoom, fit, reset, and minimap controls', async ({ app }) => {
  await app.setViewportSize({ width: 1440, height: 900 });

  await expect(app.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  await expect(app.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  await expect(app.getByRole('button', { name: 'Fit view' })).toBeEnabled();
  await expect(app.getByRole('button', { name: 'Fit graph' })).toBeEnabled();
  await expect(app.getByRole('button', { name: 'Reset example graph' })).toBeEnabled();
  const overview = app.getByRole('img', { name: /Graph overview navigator/ });
  await expect(overview).toBeVisible();
  await expect
    .poll(() => overview.evaluate((element) => getComputedStyle(element.parentElement!).margin))
    .toBe('0px');
  await expect(overview.locator('.react-flow__minimap-mask')).toHaveCount(1);
  await expect(app.locator('.graph-overview-viewport')).toHaveCount(1);
  await expect
    .poll(() =>
      overview.locator('.react-flow__minimap-mask').evaluate((element) =>
        getComputedStyle(element).stroke,
      ),
    )
    .toBe('rgba(0, 0, 0, 0)');
  await expect(overview.locator('.graph-overview-node')).toHaveCount(7);

  const mask = overview.locator('.react-flow__minimap-mask');
  const maskBeforeZoom = await mask.getAttribute('d');
  await app.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => mask.getAttribute('d')).not.toBe(maskBeforeZoom);

  const viewport = app.locator('.react-flow__viewport');
  const transformBeforePan = await viewport.evaluate((element) => getComputedStyle(element).transform);
  const overviewBox = await overview.boundingBox();
  if (!overviewBox) throw new Error('Expected a measurable graph overview.');
  await overview.click({ position: { x: overviewBox.width - 12, y: overviewBox.height - 12 } });
  await expect
    .poll(() => viewport.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(transformBeforePan);

  await app.getByRole('button', { name: 'Zoom out' }).click();
  await app.getByRole('button', { name: 'Fit graph' }).click();
});

test('keyboard duplicate, delete, undo, and redo keep graph counts truthful', async ({ app }) => {
  await app.getByTestId('rf__node-classifier').click();
  await expect(app.getByTestId('rf__node-classifier')).toHaveClass(/selected/);

  await app.keyboard.press('Control+d');
  await expect(app.getByLabel('Graph status')).toContainText('8 nodes');

  await app.keyboard.press('Control+z');
  await expect(app.getByLabel('Graph status')).toContainText('7 nodes');
  await app.keyboard.press('Control+Shift+z');
  await expect(app.getByLabel('Graph status')).toContainText('8 nodes');

  const duplicate = app.locator('.react-flow__node').filter({
    has: app.getByText('Classifier Agent copy', { exact: true }),
  });
  await duplicate.focus();
  await expect(duplicate).toBeFocused();
  await duplicate.press('Enter');
  await expect(duplicate).toHaveClass(/selected/);
  await app.keyboard.press('Delete');
  await expect(app.getByLabel('Graph status')).toContainText('7 nodes');
});

test('palette search filters components and announces a useful empty state', async ({ app }) => {
  const search = app.getByRole('searchbox', { name: 'Search components' });
  await search.fill('human');
  await expect(app.getByRole('button', { name: 'Human', exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Agent', exact: true })).toHaveCount(0);
  await expect(app.getByText('1 component and 0 references shown', { exact: true })).toBeAttached();

  await search.fill('not-a-component');
  await expect(
    app.getByRole('status').filter({ hasText: 'No components or references match “not-a-component”.' }),
  ).toBeVisible();
  await expect(app.getByText('0 components and 0 references shown', { exact: true })).toBeAttached();
});

test('node and edge focus targets expose semantic identity', async ({ app }) => {
  const node = app.getByTestId('rf__node-classifier');
  await expect(node).toHaveAttribute('role', 'group');
  await expect(node).toHaveAttribute('aria-roledescription', 'node');
  await node.focus();
  await expect(node).toBeFocused();
  await expect(node.getByText('Classifier Agent', { exact: true })).toBeVisible();

  const edge = app.getByTestId('rf__edge-classifier-billing');
  await expect(edge).toHaveAttribute('role', 'group');
  await expect(edge).toHaveAttribute('aria-roledescription', 'edge');
  await expect(edge).toHaveAccessibleName('Edge from classifier to billing');
  await edge.focus();
  await expect(edge).toBeFocused();
  await expect(app.locator('[aria-label="Conditional edge, route billing"]')).toBeVisible();
});

test('subgraph focus and collapse affordances expose their complete state', async ({ app }) => {
  await loadResearchSupervisor(app);

  const subgraph = app.getByTestId('rf__node-research-supervisor');
  await expect(subgraph).toHaveAttribute('aria-roledescription', 'node');
  await expect(subgraph).toHaveAccessibleName('Research Supervisor subgraph, expanded');
  await subgraph.focus();
  await expect(subgraph).toBeFocused();

  const collapse = app.getByRole('button', {
    name: 'Collapse subgraph Research Supervisor',
  });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await collapse.focus();
  await collapse.press('Enter');
  const expand = app.getByRole('button', {
    name: 'Expand subgraph Research Supervisor',
  });
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(subgraph).toHaveAccessibleName('Research Supervisor subgraph, collapsed');
});

test('frozen workspace removes canvas instructions and disables authoring controls', async ({ app }) => {
  await freezeResearchIntake(app);

  await expect(app.locator('.canvas-instruction-strip')).toHaveCount(0);
  await expect(app.getByRole('button', { name: 'Duplicate selection' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Delete selection' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Redo' })).toBeDisabled();
  const frozenEdges = app.getByRole('application').locator('.react-flow__edge[role="group"]');
  await expect(frozenEdges).toHaveCount(9);
  for (let index = 0; index < 9; index += 1) {
    await expect(frozenEdges.nth(index)).toHaveAccessibleName(/^Edge from /);
  }
  const frozenRouteLabels = app.locator('.routing-edge-label');
  await expect(frozenRouteLabels).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    await expect(frozenRouteLabels.nth(index)).toHaveAccessibleName(/edge/i);
  }
  await expect(app.getByLabel('Graph status')).toContainText('5 scenarios');
  await expect(app.getByLabel('Graph status')).toContainText('Contract frozen');
});

test('reduced-motion preference removes workspace animation and transitions', async ({ app }) => {
  await app.emulateMedia({ reducedMotion: 'reduce' });
  await app.reload();
  await app.getByRole('button', { name: 'Show inspector' }).click();

  const motion = await app.evaluate(() => {
    const inspector = document.querySelector('.workspace-inspector-panel');
    const freeze = document.querySelector('.workspace-freeze-button');
    const controls = document.querySelector('.canvas-flow-controls');
    if (!inspector || !freeze || !controls) throw new Error('workspace chrome missing');
    return {
      inspectorAnimation: getComputedStyle(inspector).animationName,
      freezeTransition: getComputedStyle(freeze).transitionDuration,
      controlsTransition: getComputedStyle(controls).transitionDuration,
    };
  });

  expect(motion).toEqual({
    inspectorAnimation: 'none',
    freezeTransition: '0s',
    controlsTransition: '0s',
  });
});

test('status counts and global modes remain keyboard reachable', async ({ app }) => {
  await expect(app.getByLabel('Graph status')).toContainText('7 nodes');
  await expect(app.getByLabel('Graph status')).toContainText('8 edges');
  await expect(app.getByLabel('Graph status')).toContainText('3 scenarios');
  await expect(app.getByLabel('Graph status')).toContainText('Ready to freeze');

  await app.getByTestId('rf__node-classifier').click();
  await expect(app.getByTestId('rf__node-classifier')).toHaveClass(/selected/);
  await expect(app.getByRole('heading', { name: 'Classifier Agent' })).toBeVisible();
  const design = app.getByRole('radio', { name: 'Design', exact: true });
  await design.focus();
  await expect(design).toBeFocused();
  await expect(design).toHaveAttribute('aria-checked', 'true');

  await freezeResearchIntake(app);
  const scenario = app.getByRole('radio', { name: 'Scenario', exact: true });
  await expect(scenario).toHaveAttribute('aria-checked', 'true');
  await expect(app.getByRole('heading', { name: 'Scenarios' })).toBeVisible();
});
