import { readFile } from 'node:fs/promises';
import type { Download, Locator, Page } from '@playwright/test';

import {
  callWebMcpTool,
  expect,
  freezeResearchIntake,
  loadGraphLibraryEntry,
  loadResearchIntake,
  test,
} from './fixtures';

type GraphRead = {
  ok: true;
  graph: {
    id: string;
    status: 'draft' | 'frozen';
    nodes: Array<{ id: string }>;
    edges: Array<{ id: string }>;
  };
};

type ScenarioRead = {
  ok: true;
  scenarios: Array<{ id: string; name: string; orderedPath: string[] }>;
};

async function readGraph(page: Page) {
  return (await callWebMcpTool<GraphRead>(page, 'get_graph', {})).graph;
}

async function loadHumanControlDemo(page: Page) {
  await loadGraphLibraryEntry(page, 'Human Control & HITL', 'human-control-hitl-demo');
}

async function loadParallelResearchDemo(page: Page) {
  await loadGraphLibraryEntry(page, 'Parallel research · Send ×N', 'dynamic-parallelism-merge-demo');
}

async function consumeDownload(page: Page, filename: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8_000 }),
    page.getByRole('link', { name: `Download ${filename}` }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(filename);
  const path = await download.path();
  if (!path) throw new Error(`Browser did not persist ${filename}`);
  return { download, path, text: await readFile(path, 'utf8') } satisfies {
    download: Download;
    path: string;
    text: string;
  };
}

async function expectFitInsideOpenDesktopRails(page: Page, nodeIds?: readonly string[]) {
  await expect.poll(async () => page.evaluate((requestedNodeIds) => {
    const palette = document.querySelector<HTMLElement>('.workspace-palette-slot');
    const inspector = document.querySelector<HTMLElement>('.workspace-inspector-panel');
    const left = palette ? palette.getBoundingClientRect().right + 8 : 8;
    const right = inspector ? inspector.getBoundingClientRect().left - 8 : window.innerWidth - 8;
    const candidates = requestedNodeIds?.length
      ? requestedNodeIds.map((id) => document.querySelector<HTMLElement>(`[data-testid="rf__node-${id}"]`))
          .filter((node): node is HTMLElement => Boolean(node))
      : [...document.querySelectorAll<HTMLElement>('.react-flow__node')];
    const nodes = candidates
      .filter((node) => node.offsetParent !== null && !node.classList.contains('react-flow__node-subgraph'));
    return nodes.length > 0 && nodes.every((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= left - 1 && rect.right <= right + 1;
    });
  }, nodeIds ? [...nodeIds] : undefined), { timeout: 10_000 }).toBe(true);
}

async function expectEdgeLabelOnPath(page: Page, edgeId: string) {
  const distance = await page.locator(`[data-edge-id="${edgeId}"]`).evaluate((label, id) => {
    const path = document.querySelector<SVGPathElement>(
      `[data-testid="rf__edge-${id}"] .routing-edge__path`,
    );
    if (!path) throw new Error(`Missing route path for ${id}`);
    const rect = label.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error(`Missing route transform for ${id}`);
    const length = path.getTotalLength();
    let closest = Number.POSITIVE_INFINITY;
    for (let index = 0; index <= 240; index += 1) {
      const point = path.getPointAtLength((length * index) / 240);
      const x = point.x * matrix.a + point.y * matrix.c + matrix.e;
      const y = point.x * matrix.b + point.y * matrix.d + matrix.f;
      closest = Math.min(closest, Math.hypot(center.x - x, center.y - y));
    }
    return closest;
  }, edgeId);
  expect(distance).toBeLessThan(2.5);
}

async function settledPathHitPoint(path: Locator) {
  return path.evaluate(async (element) => {
    const readPoint = (position: number) => {
      const svgPath = element as SVGPathElement;
      const point = svgPath.getPointAtLength(svgPath.getTotalLength() * position);
      const matrix = svgPath.getScreenCTM();
      if (!matrix) throw new Error('Edge interaction path has no screen transform');
      return {
        x: point.x * matrix.a + point.y * matrix.c + matrix.e,
        y: point.x * matrix.b + point.y * matrix.d + matrix.f,
      };
    };

    let previous = readPoint(0.5);
    let stableFrames = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const current = readPoint(0.5);
      stableFrames = Math.hypot(current.x - previous.x, current.y - previous.y) < 0.25
        ? stableFrames + 1
        : 0;
      if (stableFrames >= 12) break;
      previous = current;
    }
    if (stableFrames < 12) throw new Error('Edge interaction path did not settle');

    const edge = element.closest('.react-flow__edge');
    for (const position of [0.5, 0.55, 0.45, 0.6, 0.4, 0.65, 0.35, 0.7, 0.3, 0.75, 0.25]) {
      const point = readPoint(position);
      const hit = document.elementFromPoint(point.x, point.y);
      if (edge && hit && edge.contains(hit)) return point;
    }
    throw new Error('Edge interaction path has no uniquely hittable point near its midpoint');
  });
}

test('manual Fit encloses the graph inside whichever desktop side rails are open', async ({ app }) => {
  await app.setViewportSize({ width: 1440, height: 900 });
  await loadGraphLibraryEntry(app, 'Hierarchical Deep Research', 'library-hierarchical-deep-research');

  await app.getByRole('button', { name: 'Show inspector' }).click();
  await expect(app.getByRole('button', { name: 'Collapse inspector' })).toBeVisible();
  await app.getByRole('button', { name: 'Fit graph' }).click();
  await expectFitInsideOpenDesktopRails(app);
  await expectEdgeLabelOnPath(app, 'merge-supervisor');

  await app.getByRole('button', { name: 'Collapse inspector' }).click();
  await app.getByRole('button', { name: 'Fit graph' }).click();
  await expectFitInsideOpenDesktopRails(app);

  await app.getByRole('button', { name: 'Open Inspector' }).click();
  await app.getByRole('button', { name: 'Collapse node palette' }).click();
  await app.getByRole('button', { name: 'Fit graph' }).click();
  await expectFitInsideOpenDesktopRails(app);
});

test('node and edge hover feedback stays visible without changing route patterns', async ({ app }) => {
  await app.emulateMedia({ reducedMotion: 'no-preference' });
  await app.setViewportSize({ width: 1440, height: 900 });
  await loadResearchIntake(app);

  const edge = app.getByTestId('rf__edge-clarify-write-brief');
  const interactionPath = edge.locator('.react-flow__edge-interaction');
  await expect(app.getByRole('button', { name: 'Auto-layout graph' })).toBeEnabled();
  await settledPathHitPoint(interactionPath);

  const node = app.getByTestId('rf__node-clarify-request');
  const shell = node.locator('.contract-node-shell');
  const restingShadow = await shell.evaluate((element) => getComputedStyle(element).boxShadow);
  await node.hover();
  await expect.poll(() => shell.evaluate((element) => {
    const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { scale: transform.a, lift: transform.f };
  })).toEqual({ scale: 1.01, lift: -1 });
  expect(await shell.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(restingShadow);

  const visiblePath = edge.locator('.routing-edge__path');
  const hoverHalo = edge.locator('.routing-edge__hover-halo');
  const dashPattern = await visiblePath.evaluate((element) => getComputedStyle(element).strokeDasharray);
  const midpoint = await settledPathHitPoint(interactionPath);
  await app.mouse.move(midpoint.x, midpoint.y);
  await expect.poll(() => hoverHalo.evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.8);
  await expect(hoverHalo).toHaveAttribute('vector-effect', 'non-scaling-stroke');
  await expect.poll(() => visiblePath.evaluate((element) => Number.parseFloat(getComputedStyle(element).strokeWidth)))
    .toBeGreaterThanOrEqual(2.35);
  expect(await visiblePath.evaluate((element) => getComputedStyle(element).strokeDasharray))
    .toBe(dashPattern);

  // Regression: panel changes followed by Fit View can zoom the graph far
  // enough that graph-space hover affordances become imperceptible.
  const hideInventory = app.getByRole('button', { name: 'Hide inventory' });
  if (await hideInventory.isVisible()) await hideInventory.click();
  const hideInspector = app.getByRole('button', { name: 'Hide inspector' });
  if (await hideInspector.isVisible()) await hideInspector.click();
  await app.getByRole('button', { name: 'Fit graph' }).click();
  await expect.poll(() => app.locator('.react-flow__viewport').evaluate((element) => {
    const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return transform.a;
  })).toBeLessThan(0.9);

  // Fit animates the viewport independently from the node shell. Hover only
  // after that camera motion has settled so the pointer cannot chase a moving
  // React Flow wrapper and leave the shell between animation frames.
  await app.waitForTimeout(250);
  await shell.hover();
  await expect.poll(() => shell.evaluate((element) => {
    const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { scale: transform.a, lift: transform.f };
  })).toEqual({ scale: 1.01, lift: -1 });

  const fittedMidpoint = await settledPathHitPoint(interactionPath);
  await app.mouse.move(fittedMidpoint.x, fittedMidpoint.y);
  await expect.poll(() => hoverHalo.evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.8);

  await app.mouse.click(fittedMidpoint.x, fittedMidpoint.y);
  await expect(edge).toHaveClass(/selected/);
  await expect(edge.locator('.routing-edge__selection-halo'))
    .toHaveAttribute('vector-effect', 'non-scaling-stroke');
});

test('repeated mode, viewport, panel, and selection controls preserve accepted truth and history', async ({ app }) => {
  await app.setViewportSize({ width: 1440, height: 900 });
  const initial = await readGraph(app);
  await loadParallelResearchDemo(app);
  const accepted = await readGraph(app);
  const undo = app.getByRole('button', { name: 'Undo' });
  const redo = app.getByRole('button', { name: 'Redo' });
  const historyBefore = { undoDisabled: await undo.isDisabled(), redoDisabled: await redo.isDisabled() };
  const projection = app.getByRole('radiogroup', { name: 'Canvas projection' });
  const design = projection.getByRole('radio', { name: 'Design', exact: true });
  const runtime = projection.getByRole('radio', { name: 'Runtime', exact: true });
  await app.getByRole('button', { name: 'Show inspector' }).click();
  await expect(app.getByRole('button', { name: 'Collapse inspector' })).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    await runtime.click();
    await expect(runtime).toHaveAttribute('aria-checked', 'true');
    await expect(app.locator('.runtime-instance-node')).toHaveCount(3);
    await design.click();
    await expect(design).toHaveAttribute('aria-checked', 'true');
    await app.getByRole('button', { name: 'Fit graph' }).click();
    await app.getByRole('button', { name: 'Zoom in' }).click();
    await app.getByRole('button', { name: 'Zoom out' }).click();

    await app.getByRole('button', { name: 'Collapse inspector' }).click();
    await app.getByRole('button', { name: 'Open Inspector' }).click();
    await expect(app.getByRole('button', { name: 'Collapse inspector' })).toBeVisible();

    await app.getByRole('button', { name: 'Collapse node palette' }).click();
    await expect(app.getByRole('button', { name: 'Open Palette' })).toBeVisible();
    await app.getByRole('button', { name: 'Open Palette' }).click();

    const selectionId = index % 2 === 0 ? 'generate-queries' : 'merge-evidence';
    await app.getByTestId(`rf__node-${selectionId}`).click();
    await expect(app.getByTestId(`rf__node-${selectionId}`)).toHaveClass(/selected/);
  }

  expect(await readGraph(app)).toEqual(accepted);
  expect({ undoDisabled: await undo.isDisabled(), redoDisabled: await redo.isDisabled() }).toEqual(historyBefore);
  await undo.click();
  await expect.poll(() => readGraph(app)).toEqual(initial);
  await redo.click();
  await expect.poll(() => readGraph(app)).toEqual(accepted);
});

test('portal dialogs establish focus and restore it to their invoking controls', async ({ app }) => {
  const libraryTrigger = app.getByRole('button', { name: 'Workflow library, 14 templates' });
  await libraryTrigger.focus();
  await libraryTrigger.press('Enter');
  const libraryDialog = app.getByRole('dialog', { name: 'Graph library' });
  await expect(libraryDialog).toBeVisible();
  await expect(app.getByRole('searchbox', { name: 'Search graph library' })).toBeFocused();
  const libraryFocusable = libraryDialog.locator('a[href], button:not([disabled]), input:not([disabled])');
  await libraryFocusable.first().focus();
  await app.keyboard.press('Shift+Tab');
  expect(await libraryDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await libraryFocusable.last().focus();
  await app.keyboard.press('Tab');
  expect(await libraryDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await app.keyboard.press('Escape');
  await expect(libraryDialog).toHaveCount(0);
  await expect(libraryTrigger).toBeFocused();

  await loadHumanControlDemo(app);
  await app.getByTestId('rf__node-deploy-change').click();
  const previewTrigger = app.getByRole('button', { name: 'Preview input request' });
  await previewTrigger.focus();
  await previewTrigger.click();
  const previewDialog = app.getByRole('dialog', { name: 'Preview input request' });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.getByRole('button', { name: 'Close input request preview' })).toBeFocused();
  await app.keyboard.press('Escape');
  await expect(previewDialog).toHaveCount(0);
  await expect(previewTrigger).toBeFocused();

  await previewTrigger.click();
  await previewDialog.getByRole('button', { name: 'Close input request preview' }).click();
  await expect(previewDialog).toHaveCount(0);
  await expect(previewTrigger).toBeFocused();
});

test('scenario accordions and repeated compact downloads remain valid without stale Blob URLs', async ({ app }) => {
  test.setTimeout(120_000);
  await freezeResearchIntake(app);
  await app.getByRole('radio', { name: 'Scenario', exact: true }).click();
  const scenarioRead = await callWebMcpTool<ScenarioRead>(app, 'get_branch_scenarios', {});
  expect(scenarioRead.scenarios.length).toBeGreaterThan(1);
  const firstScenario = scenarioRead.scenarios[0];
  const secondScenario = scenarioRead.scenarios[1];
  const firstRow = app.locator(`button[data-scenario-id="${firstScenario.id}"]`);
  const secondRow = app.locator(`button[data-scenario-id="${secondScenario.id}"]`);
  await firstRow.click();
  await expect(firstRow).toHaveAttribute('aria-expanded', 'true');
  await expectFitInsideOpenDesktopRails(app, firstScenario.orderedPath);
  await expect(firstRow.locator('.mode-path-strip.is-expanded')).toBeVisible();
  await expect(firstRow.locator('.mode-path-strip__overflow')).toHaveCount(0);
  await expect(firstRow.locator('.mode-path-strip__node')).toHaveCount(firstScenario.orderedPath.length);

  await secondRow.click();
  await expect(firstRow).toHaveAttribute('aria-expanded', 'false');
  await expect(secondRow).toHaveAttribute('aria-expanded', 'true');
  await expect(app.locator('.scenario-row__expanded')).toHaveCount(1);

  const globalFilenames = [
    'graph-contract.json',
    'graph-test-scenarios.json',
    'test_graph_paths.py',
  ];

  for (const filename of globalFilenames) {
    const link = app.getByRole('link', { name: `Download ${filename}` });
    await expect(link).toHaveAttribute('href', /^blob:/);
    const first = await consumeDownload(app, filename);
    await expect(link).toHaveAttribute('href', /^blob:/);
    const second = await consumeDownload(app, filename);
    expect(second.text).toBe(first.text);
    expect(first.text.length).toBeGreaterThan(40);
  }
});
