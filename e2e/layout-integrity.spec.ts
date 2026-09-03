import type { Locator, Page } from '@playwright/test';

import {
  callWebMcpTool,
  confirmGraphLibraryReplacement,
  expect,
  loadResearchIntake,
  test,
  webMcpToolNames,
} from './fixtures';
import { loadResearchSupervisor } from './helpers/graph';

type Position = { x: number; y: number };
type ScreenRect = Position & { width: number; height: number };

type LayoutGraph = {
  id: string;
  name: string;
  status: 'draft' | 'frozen';
  updatedAt: string;
  nodes: Array<{
    id: string;
    kind: string;
    label: string;
    parentId?: string;
    position: Position;
    [key: string]: unknown;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    mode: string;
    label?: string;
    condition?: string;
    loopCap?: number;
    send?: { mergeNodeId: string; [key: string]: unknown };
    [key: string]: unknown;
  }>;
  subgraphs: Array<{
    id: string;
    label: string;
    parentId?: string;
    position: Position;
    dimensions: { width: number; height: number };
    collapsed: boolean;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

type GraphRead = {
  ok: true;
  graph: LayoutGraph;
  validation: { validForFreeze: boolean; issues: unknown[] };
};

type ProposalRead = {
  ok: boolean;
  proposal?: { status: string };
  error?: { code: string; message: string };
};

const templateTitles = [
  'Hierarchical Deep Research',
  'Guarded Coding-Agent Delivery',
  'Evidence-to-Approved Social Content',
  'Multi-Stage Expert Review',
  'Guarded Natural-Language-to-SQL',
  'Email Triage with Human Review',
  'Human-Approved Incident Response',
  'Specialist Travel Support',
  'Voice Specialist Handoffs',
  'Parallel Research with Reflection',
] as const;

const NODE_OVERLAP_TOLERANCE_PX = 2;
const CONTAINMENT_TOLERANCE_PX = 2;
const BOUNDARY_HANDLE_TOLERANCE_PX = 8;
const ROUTE_VIEWPORT_TOLERANCE_PX = 4;
const RENDERED_LAYOUT_TOLERANCE_PX = 1;

async function readGraph(page: Page): Promise<LayoutGraph> {
  const result = await callWebMcpTool<GraphRead>(page, 'get_graph', {});
  expect(result.ok).toBe(true);
  return result.graph;
}

async function openLibraryTemplate(page: Page, title: string) {
  await page.getByRole('button', { name: 'Workflow library, 14 templates' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: `Open ${title}` }).click();
  await confirmGraphLibraryReplacement(page, title);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await readGraph(page)).name).toBe(title);
}

function visibleCanvasElementIds(graph: LayoutGraph) {
  const parents = new Map(graph.subgraphs.map((subgraph) => [subgraph.id, subgraph]));
  const hasCollapsedAncestor = (parentId: string | undefined) => {
    const visited = new Set<string>();
    let currentId = parentId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const parent = parents.get(currentId);
      if (!parent) return false;
      if (parent.collapsed) return true;
      currentId = parent.parentId;
    }
    return false;
  };
  return [
    ...graph.subgraphs
      .filter((subgraph) => !hasCollapsedAncestor(subgraph.parentId))
      .map((subgraph) => subgraph.id),
    ...graph.nodes
      .filter((node) => !hasCollapsedAncestor(node.parentId))
      .map((node) => node.id),
  ];
}

async function renderedNodeRects(page: Page, ids: readonly string[]) {
  return page.evaluate((domainIds) => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-testid]'));
    const round = (value: number) => Math.round(value * 10) / 10;
    return domainIds.flatMap((id) => {
      const element = candidates.find(
        (candidate) => candidate.getAttribute('data-testid') === `rf__node-${id}`,
      );
      if (!element) return [];
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return [];
      }
      return [{
        id,
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height),
      }];
    });
  }, [...ids]);
}

async function waitForRenderedGeometry(page: Page, ids: readonly string[]) {
  let previous = '';
  let stableSamples = 0;
  await expect.poll(
    async () => {
      const rects = await renderedNodeRects(page, ids);
      if (rects.length !== ids.length) {
        previous = '';
        stableSamples = 0;
        return stableSamples;
      }
      const current = JSON.stringify(rects);
      stableSamples = current === previous ? stableSamples + 1 : 0;
      previous = current;
      return stableSamples;
    },
    { timeout: 10_000, intervals: [25, 40, 60, 80, 120] },
  ).toBeGreaterThanOrEqual(4);
  return renderedNodeRects(page, ids);
}

async function fitAndWait(page: Page, graph?: LayoutGraph) {
  const fittedGraph = graph ?? await readGraph(page);
  await page.getByRole('button', { name: 'Fit graph' }).click();
  return waitForRenderedGeometry(page, visibleCanvasElementIds(fittedGraph));
}

async function readViewportScale(page: Page) {
  return page.locator('.react-flow__viewport').evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    if (transform === 'none') return 1;
    const matrixValues = transform.match(/^matrix\((.+)\)$/)?.[1]?.split(',');
    return Number(matrixValues?.[0] ?? 1);
  });
}

function assertInside(
  outer: ScreenRect,
  inner: ScreenRect,
  tolerance: number,
  description: string,
) {
  expect(inner.x, `${description}: left edge`).toBeGreaterThanOrEqual(outer.x - tolerance);
  expect(inner.y, `${description}: top edge`).toBeGreaterThanOrEqual(outer.y - tolerance);
  expect(inner.x + inner.width, `${description}: right edge`).toBeLessThanOrEqual(
    outer.x + outer.width + tolerance,
  );
  expect(inner.y + inner.height, `${description}: bottom edge`).toBeLessThanOrEqual(
    outer.y + outer.height + tolerance,
  );
}

function assertNoUnexpectedNodeOverlap(
  title: string,
  graph: LayoutGraph,
  rects: Array<ScreenRect & { id: string }>,
) {
  const rectById = new Map(rects.map((rect) => [rect.id, rect]));
  const items = [
    ...graph.subgraphs.map((subgraph) => ({ id: subgraph.id, parentId: subgraph.parentId })),
    ...graph.nodes.map((node) => ({ id: node.id, parentId: node.parentId })),
  ].filter((item) => rectById.has(item.id));
  const parentById = new Map(items.map((item) => [item.id, item.parentId]));
  const isAncestor = (ancestorId: string, descendantId: string) => {
    const visited = new Set<string>();
    let parentId = parentById.get(descendantId);
    while (parentId && !visited.has(parentId)) {
      if (parentId === ancestorId) return true;
      visited.add(parentId);
      parentId = parentById.get(parentId);
    }
    return false;
  };

  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const left = items[leftIndex]!;
      const right = items[rightIndex]!;
      if (isAncestor(left.id, right.id) || isAncestor(right.id, left.id)) continue;
      const leftRect = rectById.get(left.id)!;
      const rightRect = rectById.get(right.id)!;
      const overlapWidth = Math.max(
        0,
        Math.min(leftRect.x + leftRect.width, rightRect.x + rightRect.width) -
          Math.max(leftRect.x, rightRect.x),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(leftRect.y + leftRect.height, rightRect.y + rightRect.height) -
          Math.max(leftRect.y, rightRect.y),
      );
      expect(
        overlapWidth <= NODE_OVERLAP_TOLERANCE_PX ||
          overlapHeight <= NODE_OVERLAP_TOLERANCE_PX,
        `${title}: ${left.id} and ${right.id} overlap by ${overlapWidth.toFixed(1)}×${overlapHeight.toFixed(1)}px`,
      ).toBe(true);
    }
  }
}

async function expectExpandedSubgraphContainment(
  page: Page,
  graph: LayoutGraph,
  subgraphId: string,
) {
  const subgraph = graph.subgraphs.find((candidate) => candidate.id === subgraphId);
  expect(subgraph, `missing canonical subgraph ${subgraphId}`).toBeDefined();
  expect(subgraph!.collapsed).toBe(false);
  const memberIds = graph.nodes
    .filter((node) => node.parentId === subgraphId)
    .map((node) => node.id);
  expect(memberIds.length, `${subgraphId} should have visible members`).toBeGreaterThan(0);
  const rects = await waitForRenderedGeometry(page, [subgraphId, ...memberIds]);
  const rectById = new Map(rects.map((rect) => [rect.id, rect]));
  const container = rectById.get(subgraphId)!;
  for (const memberId of memberIds) {
    assertInside(
      container,
      rectById.get(memberId)!,
      CONTAINMENT_TOLERANCE_PX,
      `${subgraphId} contains ${memberId}`,
    );
  }

  const handles = await page
    .getByTestId(`rf__node-${subgraphId}`)
    .locator('.subgraph-node-handle')
    .evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        side: element.classList.contains('react-flow__handle-left')
          ? 'left'
          : element.classList.contains('react-flow__handle-right')
            ? 'right'
            : 'unknown',
      };
    }));
  expect(handles, `${subgraphId} boundary handles`).toHaveLength(2);
  for (const [index, handle] of handles.entries()) {
    assertInside(
      container,
      handle,
      BOUNDARY_HANDLE_TOLERANCE_PX,
      `${subgraphId} contains boundary handle ${index + 1}`,
    );
  }
  const leftHandle = handles.find((handle) => handle.side === 'left');
  const rightHandle = handles.find((handle) => handle.side === 'right');
  expect(leftHandle, `${subgraphId} target handle is on the left`).toBeDefined();
  expect(rightHandle, `${subgraphId} source handle is on the right`).toBeDefined();
  expect(
    Math.abs(leftHandle!.x + leftHandle!.width / 2 - container.x),
    `${subgraphId} target handle hugs the left boundary`,
  ).toBeLessThanOrEqual(BOUNDARY_HANDLE_TOLERANCE_PX);
  expect(
    Math.abs(
      rightHandle!.x + rightHandle!.width / 2 - (container.x + container.width),
    ),
    `${subgraphId} source handle hugs the right boundary`,
  ).toBeLessThanOrEqual(BOUNDARY_HANDLE_TOLERANCE_PX);
}

async function expectRouteVisible(
  page: Page,
  edgeId: string,
  options: { label?: boolean } = {},
) {
  const edge = page.getByTestId(`rf__edge-${edgeId}`);
  await expect(edge).toHaveCount(1);
  const route = await edge.evaluate((root) => {
    const path = root.querySelector<SVGPathElement>('path.routing-edge__path');
    const canvas = root.closest<HTMLElement>('.react-flow') ??
      document.querySelector<HTMLElement>('.react-flow');
    if (!path || !canvas) return null;
    const markerReference = path.getAttribute('marker-end') ?? '';
    // React Flow includes the semantic CSS color token in its marker ID. The
    // token itself contains parentheses, so parse the complete quoted URL
    // fragment instead of stopping at the first `)` in `var(...)`.
    const markerId = markerReference
      .replace(/^url\(['"]?#/, '')
      .replace(/['"]?\)$/, '');
    const marker = markerId ? document.getElementById(markerId) : null;
    const markerShape = marker?.querySelector<SVGGraphicsElement>('path, polygon, polyline') ?? null;
    let markerShapeBounds: { width: number; height: number } | null = null;
    if (markerShape) {
      try {
        const bounds = markerShape.getBBox();
        markerShapeBounds = { width: bounds.width, height: bounds.height };
      } catch {
        markerShapeBounds = null;
      }
    }
    const markerShapeStyle = markerShape ? getComputedStyle(markerShape) : null;
    const point = path.getPointAtLength(path.getTotalLength());
    const matrix = path.getScreenCTM();
    const endpoint = matrix ? new DOMPoint(point.x, point.y).matrixTransform(matrix) : null;
    let pathBounds: { x: number; y: number; width: number; height: number } | null = null;
    if (matrix) {
      try {
        const bounds = path.getBBox();
        const corners = [
          new DOMPoint(bounds.x, bounds.y),
          new DOMPoint(bounds.x + bounds.width, bounds.y),
          new DOMPoint(bounds.x, bounds.y + bounds.height),
          new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height),
        ].map((corner) => corner.matrixTransform(matrix));
        const x = Math.min(...corners.map((corner) => corner.x));
        const y = Math.min(...corners.map((corner) => corner.y));
        const right = Math.max(...corners.map((corner) => corner.x));
        const bottom = Math.max(...corners.map((corner) => corner.y));
        pathBounds = { x, y, width: right - x, height: bottom - y };
      } catch {
        pathBounds = null;
      }
    }
    const canvasRect = canvas.getBoundingClientRect();
    const style = getComputedStyle(path);
    const markerStyle = marker ? getComputedStyle(marker) : null;
    return {
      pathLength: path.getTotalLength(),
      stroke: style.stroke,
      opacity: Number(style.opacity),
      markerReference,
      markerId,
      markerShape: Boolean(markerShape),
      markerShapeBounds,
      markerShapeFill: markerShapeStyle?.fill ?? '',
      markerShapeFillOpacity: Number(markerShapeStyle?.fillOpacity ?? 0),
      markerShapeOpacity: Number(markerShapeStyle?.opacity ?? 0),
      markerDisplay: markerStyle?.display,
      markerVisibility: markerStyle?.visibility,
      endpoint: endpoint ? { x: endpoint.x, y: endpoint.y } : null,
      pathBounds,
      canvas: {
        x: canvasRect.x,
        y: canvasRect.y,
        width: canvasRect.width,
        height: canvasRect.height,
      },
    };
  });
  expect(route, `${edgeId} rendered path`).not.toBeNull();
  expect(route!.pathLength, `${edgeId} path length`).toBeGreaterThan(1);
  expect(route!.stroke, `${edgeId} visible stroke`).not.toBe('none');
  expect(route!.opacity, `${edgeId} visible opacity`).toBeGreaterThan(0);
  expect(route!.markerReference, `${edgeId} marker-end reference`).toContain('#');
  expect(route!.markerId, `${edgeId} resolved arrowhead`).not.toBe('');
  expect(route!.markerShape, `${edgeId} arrowhead shape`).toBe(true);
  expect(route!.markerShapeBounds, `${edgeId} arrowhead SVG bounds`).not.toBeNull();
  expect(route!.markerShapeBounds!.width, `${edgeId} arrowhead width`).toBeGreaterThan(0);
  expect(route!.markerShapeBounds!.height, `${edgeId} arrowhead height`).toBeGreaterThan(0);
  expect(route!.markerShapeFill, `${edgeId} arrowhead fill`).not.toBe('none');
  expect(route!.markerShapeFill, `${edgeId} arrowhead fill`).not.toBe('transparent');
  expect(route!.markerShapeFillOpacity, `${edgeId} arrowhead fill opacity`).toBeGreaterThan(0);
  expect(route!.markerShapeOpacity, `${edgeId} arrowhead opacity`).toBeGreaterThan(0);
  expect(route!.markerDisplay, `${edgeId} arrowhead display`).not.toBe('none');
  expect(route!.markerVisibility, `${edgeId} arrowhead visibility`).not.toBe('hidden');
  expect(route!.endpoint, `${edgeId} route endpoint`).not.toBeNull();
  expect(route!.pathBounds, `${edgeId} transformed path bounds`).not.toBeNull();
  assertInside(
    route!.canvas,
    route!.pathBounds!,
    ROUTE_VIEWPORT_TOLERANCE_PX,
    `${edgeId} path remains in the canvas`,
  );
  assertInside(
    route!.canvas,
    { ...route!.endpoint!, width: 0, height: 0 },
    ROUTE_VIEWPORT_TOLERANCE_PX,
    `${edgeId} arrowhead endpoint remains in the canvas`,
  );

  if (options.label === false) return;
  const label = page.locator(`[data-edge-id="${edgeId}"]`);
  await expect(label).toBeVisible();
  const [labelRect, canvasRect] = await Promise.all([
    label.boundingBox(),
    page.locator('.react-flow').boundingBox(),
  ]);
  expect(labelRect, `${edgeId} label rectangle`).not.toBeNull();
  expect(canvasRect, 'canvas rectangle').not.toBeNull();
  assertInside(
    canvasRect!,
    labelRect!,
    ROUTE_VIEWPORT_TOLERANCE_PX,
    `${edgeId} label remains in the canvas`,
  );
}

async function dragBy(page: Page, target: Locator, delta: Position) {
  const box = await target.boundingBox();
  expect(box, 'drag target has geometry').not.toBeNull();
  const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 8 });
  await page.mouse.up();
}

async function dragByAt(
  page: Page,
  target: Locator,
  delta: Position,
  point: (box: ScreenRect) => Position,
) {
  const box = await target.boundingBox();
  expect(box, 'drag target has geometry').not.toBeNull();
  const start = point(box!);
  const hitNodeId = await page.evaluate(({ x, y }) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>('.react-flow__node')?.dataset.id ?? null,
  start);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 8 });
  await page.mouse.up();
  return hitNodeId;
}

function graphGeometry(graph: LayoutGraph) {
  return {
    nodes: Object.fromEntries(
      [...graph.nodes]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((node) => [node.id, node.position]),
    ),
    subgraphs: Object.fromEntries(
      [...graph.subgraphs]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((subgraph) => [subgraph.id, {
          position: subgraph.position,
          dimensions: subgraph.dimensions,
        }]),
    ),
  };
}

function graphSemantics(graph: LayoutGraph) {
  const semanticGraph = Object.fromEntries(
    Object.entries(graph).filter(
      ([key]) => key !== 'updatedAt' && key !== 'nodes' && key !== 'subgraphs',
    ),
  );
  return {
    ...semanticGraph,
    nodes: graph.nodes.map((node) => Object.fromEntries(
      Object.entries(node).filter(([key]) => key !== 'position'),
    )),
    subgraphs: graph.subgraphs.map((subgraph) => Object.fromEntries(
      Object.entries(subgraph).filter(
        ([key]) => key !== 'position' && key !== 'dimensions',
      ),
    )),
  };
}

function expectRectsClose(
  before: Array<ScreenRect & { id: string }>,
  after: Array<ScreenRect & { id: string }>,
) {
  expect(after.map(({ id }) => id)).toEqual(before.map(({ id }) => id));
  const afterById = new Map(after.map((rect) => [rect.id, rect]));
  for (const original of before) {
    const current = afterById.get(original.id)!;
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(
        Math.abs(current[key] - original[key]),
        `${original.id} rendered ${key} remains within ${RENDERED_LAYOUT_TOLERANCE_PX}px`,
      ).toBeLessThanOrEqual(RENDERED_LAYOUT_TOLERANCE_PX);
    }
  }
}

test('L01 all ten templates avoid visible node overlap', async ({ app }) => {
  test.setTimeout(180_000);
  await app.emulateMedia({ reducedMotion: 'reduce' });

  for (const title of templateTitles) {
    await test.step(title, async () => {
      await openLibraryTemplate(app, title);
      const graph = await readGraph(app);
      const rects = await fitAndWait(app, graph);
      expect(rects).toHaveLength(visibleCanvasElementIds(graph).length);
      assertNoUnexpectedNodeOverlap(title, graph, rects);
    });
  }
});

test('L02 expanded and repeatedly loaded subgraphs contain members and boundary handles', async ({ app }) => {
  test.setTimeout(90_000);
  await app.emulateMedia({ reducedMotion: 'reduce' });
  const cases = [
    ['Hierarchical Deep Research', 'research-cell'],
    ['Email Triage with Human Review', 'response-cell'],
    ['Hierarchical Deep Research', 'research-cell'],
  ] as const;

  for (const [title, subgraphId] of cases) {
    await test.step(`${title} · ${subgraphId}`, async () => {
      await openLibraryTemplate(app, title);
      const graph = await readGraph(app);
      await fitAndWait(app, graph);
      await expectExpandedSubgraphContainment(app, graph, subgraphId);
    });
  }
});

test('L03 routing labels and arrowheads remain legible after Fit', async ({ app }) => {
  test.setTimeout(90_000);
  await app.emulateMedia({ reducedMotion: 'reduce' });

  await test.step('conditional, Command, fallback, and loop routes', async () => {
    await loadResearchIntake(app);
    const fittedRects = await fitAndWait(app);
    expect(await readViewportScale(app)).toBeGreaterThanOrEqual(0.47);
    expect(Math.min(...fittedRects.map((rect) => rect.width))).toBeGreaterThanOrEqual(100);
    await expectRouteVisible(app, 'supervisor-final-report');
    await expectRouteVisible(app, 'clarify-write-brief');
    await expectRouteVisible(app, 'supervisor-human-review');
    await expectRouteVisible(app, 'researcher-continue');
  });

  await test.step('Send and Merge routes', async () => {
    await openLibraryTemplate(app, 'Parallel Research with Reflection');
    await fitAndWait(app);
    await expectRouteVisible(app, 'questions-send');
    await expectRouteVisible(app, 'researcher-merge', { label: false });
    await expect(app.getByTestId('rf__node-research-merge')).toBeVisible();
  });

  await test.step('collapsed subgraph proxy routes', async () => {
    await loadResearchSupervisor(app);
    await app.getByRole('button', { name: 'Collapse subgraph Research Supervisor' }).click();
    const collapsed = await readGraph(app);
    await fitAndWait(app, collapsed);
    await expectRouteVisible(
      app,
      'subgraph-proxy:research-outer-start:research-supervisor',
      { label: false },
    );
    await expectRouteVisible(
      app,
      'subgraph-proxy:research-supervisor:research-outer-end',
      { label: false },
    );
  });
});

test('L04 manually placed nodes and subgraph survive panels, projections, and reload', async ({ app }) => {
  test.setTimeout(90_000);
  await app.setViewportSize({ width: 1440, height: 900 });
  await app.emulateMedia({ reducedMotion: 'reduce' });
  await openLibraryTemplate(app, 'Hierarchical Deep Research');
  const originalRendered = await fitAndWait(app);
  const original = await readGraph(app);

  await dragBy(app, app.getByTestId('rf__node-write-brief'), { x: 44, y: 52 });
  await expect.poll(async () =>
    (await readGraph(app)).nodes.find((node) => node.id === 'write-brief')?.position,
  ).not.toEqual(original.nodes.find((node) => node.id === 'write-brief')?.position);

  await dragBy(app, app.getByTestId('rf__node-frame-question'), { x: 34, y: 26 });
  await expect.poll(async () =>
    (await readGraph(app)).nodes.find((node) => node.id === 'frame-question')?.position,
  ).not.toEqual(original.nodes.find((node) => node.id === 'frame-question')?.position);

  const beforeSubgraphDrag = await readGraph(app);
  const subgraphDragHit = await dragByAt(
    app,
    app.getByTestId('rf__node-research-cell').locator('.subgraph-node-shell'),
    { x: 38, y: 32 },
    // Use an empty lower-left section of the expanded frame. The right edge
    // can sit beneath the contextual inspector at fitted-out zooms.
    (box) => ({ x: box.x + 18, y: box.y + box.height - 18 }),
  );
  expect(subgraphDragHit, 'empty subgraph frame resolves to the parent interaction layer').toBe(
    'research-cell',
  );
  await expect.poll(async () =>
    (await readGraph(app)).subgraphs.find((subgraph) => subgraph.id === 'research-cell')?.position,
  ).not.toEqual(original.subgraphs.find((subgraph) => subgraph.id === 'research-cell')?.position);
  const authoredGraph = await readGraph(app);
  expect(
    authoredGraph.nodes.find((node) => node.id === 'frame-question')?.position,
    'moving a subgraph keeps child coordinates relative to the container',
  ).toEqual(beforeSubgraphDrag.nodes.find((node) => node.id === 'frame-question')?.position);
  const authored = graphGeometry(authoredGraph);
  const authoredRendered = await fitAndWait(app, authoredGraph);
  expect(authoredRendered).not.toEqual(originalRendered);

  await expect(app.getByRole('button', { name: 'Collapse inspector' })).toBeVisible();
  await app.getByRole('button', { name: 'Collapse inspector' }).click();
  await expect(app.getByRole('button', { name: 'Open Inspector' })).toBeVisible();
  await app.getByRole('button', { name: 'Hide inventory' }).click();
  await expect(app.getByRole('button', { name: 'Open Palette' })).toBeVisible();
  await app.getByRole('button', { name: 'Open Inspector' }).click();
  await expect(app.getByRole('button', { name: 'Collapse inspector' })).toBeVisible();
  await app.getByRole('button', { name: 'Open Palette' }).click();
  await app.getByRole('button', { name: 'Collapse inspector' }).click();
  expect(graphGeometry(await readGraph(app))).toEqual(authored);
  const persistedRendered = await fitAndWait(app);

  await app.getByRole('button', { name: 'Confirm and freeze contract; currently draft' }).click();
  const projection = app.getByRole('radiogroup', { name: 'Canvas projection' });
  await expect(projection.getByRole('radio', { name: 'Scenario', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await projection.getByRole('radio', { name: 'Design', exact: true }).click();
  await projection.getByRole('radio', { name: 'Scenario', exact: true }).click();
  expect(graphGeometry(await readGraph(app))).toEqual(authored);

  await app.reload();
  await expect.poll(() => webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);
  expect(graphGeometry(await readGraph(app))).toEqual(authored);
  const reloadedRendered = await fitAndWait(app);
  expectRectsClose(persistedRendered, reloadedRendered);
});

test('L05 Auto-layout is idempotent and preserves canonical semantics', async ({ app }) => {
  test.setTimeout(90_000);
  await app.emulateMedia({ reducedMotion: 'reduce' });
  await openLibraryTemplate(app, 'Parallel Research with Reflection');
  await fitAndWait(app);
  const loaded = await readGraph(app);
  const semantics = graphSemantics(loaded);

  await dragBy(app, app.getByTestId('rf__node-reflect-on-answer'), { x: 36, y: 58 });
  await expect.poll(async () =>
    (await readGraph(app)).nodes.find((node) => node.id === 'reflect-on-answer')?.position,
  ).not.toEqual(loaded.nodes.find((node) => node.id === 'reflect-on-answer')?.position);
  const postDrag = await readGraph(app);
  const postDragGeometry = graphGeometry(postDrag);
  expect(postDragGeometry).not.toEqual(graphGeometry(loaded));

  await app.getByRole('button', { name: 'Auto-layout graph' }).click();
  const first = await readGraph(app);
  const firstRects = await waitForRenderedGeometry(app, visibleCanvasElementIds(first));
  const draggedPosition = postDrag.nodes.find((node) => node.id === 'reflect-on-answer')!.position;
  const firstLayoutPosition = first.nodes.find((node) => node.id === 'reflect-on-answer')!.position;
  expect(graphGeometry(first)).not.toEqual(postDragGeometry);
  expect(
    Math.hypot(
      firstLayoutPosition.x - draggedPosition.x,
      firstLayoutPosition.y - draggedPosition.y,
    ),
    'the first Auto-layout materially moves the manually displaced node',
  ).toBeGreaterThan(1);
  expect(graphSemantics(first)).toEqual(semantics);

  await app.getByRole('button', { name: 'Auto-layout graph' }).click();
  const second = await readGraph(app);
  const secondRects = await waitForRenderedGeometry(app, visibleCanvasElementIds(second));
  expect(graphSemantics(second)).toEqual(semantics);
  expect(graphGeometry(second)).toEqual(graphGeometry(first));
  expectRectsClose(firstRects, secondRects);
});

test('L06 collapse and expand preserve a looped parallel subgraph geometry', async ({ app }) => {
  test.setTimeout(120_000);
  await app.emulateMedia({ reducedMotion: 'reduce' });
  await openLibraryTemplate(app, 'Parallel Research with Reflection');
  const accepted = await readGraph(app);
  const originalNodeIds = accepted.nodes.map((node) => node.id);

  const proposed = await callWebMcpTool<ProposalRead>(app, 'propose_graph_changes', {
    expectedGraphUpdatedAt: accepted.updatedAt,
    rationale: 'E2E layout contract: wrap the bounded Send/Merge reflection workflow in one compound scope.',
    operations: [
      {
        type: 'add_subgraph',
        subgraph: {
          id: 'parallel-loop-cell',
          label: 'Parallel reflection cell',
          position: { x: 160, y: 80 },
          dimensions: { width: 1760, height: 520 },
          collapsed: false,
        },
      },
      {
        type: 'assign_nodes_to_subgraph',
        subgraphId: 'parallel-loop-cell',
        nodeIds: originalNodeIds,
      },
      {
        type: 'add_node',
        node: {
          id: 'outer-parallel-start',
          kind: 'start',
          label: 'Start',
          position: { x: 40, y: 240 },
        },
      },
      {
        type: 'add_node',
        node: {
          id: 'outer-parallel-end',
          kind: 'end',
          label: 'Parallel workflow complete',
          position: { x: 2060, y: 240 },
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'outer-enter-parallel-cell',
          source: 'outer-parallel-start',
          target: 'parallel-start',
          mode: 'normal',
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'outer-exit-parallel-cell',
          source: 'research-answer-complete',
          target: 'outer-parallel-end',
          mode: 'normal',
        },
      },
    ],
  });
  expect(proposed).toMatchObject({ ok: true, proposal: { status: 'pending' } });
  await app.getByRole('button', { name: 'Approve' }).click();
  await expect.poll(async () => {
    const graph = await readGraph(app);
    return graph.subgraphs.some((subgraph) => subgraph.id === 'parallel-loop-cell');
  }).toBe(true);
  const expanded = await readGraph(app);
  expect(expanded.nodes.filter((node) => originalNodeIds.includes(node.id))).toEqual(
    expect.arrayContaining(
      originalNodeIds.map((id) => expect.objectContaining({ id, parentId: 'parallel-loop-cell' })),
    ),
  );
  expect(expanded.edges.find((edge) => edge.id === 'questions-send')).toMatchObject({
    mode: 'send',
    send: { mergeNodeId: 'research-merge' },
  });
  expect(expanded.edges.find((edge) => edge.id === 'reflect-refine')).toMatchObject({
    loopCap: 2,
  });
  await fitAndWait(app, expanded);
  await expectExpandedSubgraphContainment(app, expanded, 'parallel-loop-cell');

  const membership = expanded.nodes.map(({ id, parentId }) => ({ id, parentId }));
  const canonicalBeforeCollapse = {
    ...expanded,
    updatedAt: '<ignored>',
  };
  await app.getByTestId('rf__node-reflect-on-answer').click();
  await expect(app.getByTestId('rf__node-reflect-on-answer')).toHaveClass(/selected/);
  await app.getByRole('button', { name: 'Collapse subgraph Parallel reflection cell' }).click();
  const collapsed = await readGraph(app);
  expect(collapsed.nodes.map(({ id, parentId }) => ({ id, parentId }))).toEqual(membership);
  const collapsedParent = app.getByTestId('rf__node-parallel-loop-cell');
  const hiddenChild = app.getByTestId('rf__node-reflect-on-answer');
  await expect(collapsedParent.locator('.subgraph-node-shell')).toHaveClass(/is-selected/);
  const subgraphInspector = app.getByRole('region', {
    name: 'Parallel reflection cell inspector',
  });
  await expect(subgraphInspector).toBeVisible();
  await expect(subgraphInspector.getByRole('heading', {
    name: 'Parallel reflection cell',
  })).toBeVisible();
  await expect(subgraphInspector.getByLabel('Name', { exact: true })).toHaveValue(
    'Parallel reflection cell',
  );
  await expect(hiddenChild).toHaveCount(0);
  await expect(app.getByTestId('rf__edge-questions-send')).toHaveCount(0);
  await expect(app.getByTestId('rf__edge-reflect-refine')).toHaveCount(0);
  await expect(app.getByTestId(
    'rf__edge-subgraph-proxy:outer-parallel-start:parallel-loop-cell',
  )).toHaveCount(1);
  await expect(app.getByTestId(
    'rf__edge-subgraph-proxy:parallel-loop-cell:outer-parallel-end',
  )).toHaveCount(1);

  await fitAndWait(app, collapsed);
  await expectRouteVisible(
    app,
    'subgraph-proxy:outer-parallel-start:parallel-loop-cell',
    { label: false },
  );
  await expectRouteVisible(
    app,
    'subgraph-proxy:parallel-loop-cell:outer-parallel-end',
    { label: false },
  );

  await app
    .getByTestId('rf__node-parallel-loop-cell')
    .getByRole('button', { name: 'Expand subgraph Parallel reflection cell' })
    .click();
  const restored = await readGraph(app);
  expect({ ...restored, updatedAt: '<ignored>' }).toEqual(canonicalBeforeCollapse);
  await fitAndWait(app, restored);
  await expectExpandedSubgraphContainment(app, restored, 'parallel-loop-cell');
  await expectRouteVisible(app, 'questions-send');
  await expectRouteVisible(app, 'reflect-refine');
  await app.getByTestId('rf__node-reflect-on-answer').click();
  await expect(app.getByTestId('rf__node-reflect-on-answer')).toHaveClass(/selected/);
});
