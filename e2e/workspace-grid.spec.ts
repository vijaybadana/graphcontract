import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

type RailState = {
  paletteOpen: boolean;
  inspectorOpen: boolean;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

const EDGE_TOLERANCE = 2;

async function setRailState(page: Page, state: RailState) {
  const stage = page.locator('.workspace-stage');
  const currentPalette = await stage.getAttribute('data-palette-open');
  if ((currentPalette === 'true') !== state.paletteOpen) {
    await page
      .getByRole('button', { name: state.paletteOpen ? 'Show inventory' : 'Hide inventory' })
      .click();
  }

  const currentInspector = await stage.getAttribute('data-inspector-open');
  if ((currentInspector === 'true') !== state.inspectorOpen) {
    await page
      .getByRole('button', { name: state.inspectorOpen ? 'Show inspector' : 'Hide inspector' })
      .click();
  }

  await expect(stage).toHaveAttribute('data-palette-open', String(state.paletteOpen));
  await expect(stage).toHaveAttribute('data-inspector-open', String(state.inspectorOpen));
}

async function readWorkspaceRects(page: Page) {
  return page.evaluate(() => {
    const read = (selector: string): Rect | null => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      };
    };

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      brand: read('.workspace-brand-island')!,
      command: read('.workspace-command-island')!,
      action: read('.workspace-action-island')!,
      palette: read('.workspace-palette-slot'),
      inspector: read('.workspace-inspector-panel'),
      capabilities: read('.graph-capability-strip')!,
    };
  });
}

function expectClose(actual: number, expected: number, description: string) {
  expect(Math.abs(actual - expected), description).toBeLessThanOrEqual(EDGE_TOLERANCE);
}

function expectSameRect(actual: Rect, expected: Rect, description: string) {
  expectClose(actual.x, expected.x, `${description} keeps its x position`);
  expectClose(actual.y, expected.y, `${description} keeps its y position`);
  expectClose(actual.width, expected.width, `${description} keeps its width`);
  expectClose(actual.height, expected.height, `${description} keeps its height`);
}

function expectSharedGrid(
  geometry: Awaited<ReturnType<typeof readWorkspaceRects>>,
  state: RailState,
) {
  const { brand, command, action, palette, inspector, capabilities } = geometry;

  expectClose(brand.y, command.y, 'brand and command share a top edge');
  expectClose(action.y, command.y, 'action and command share a top edge');
  expectClose(brand.height, command.height, 'brand and command share a height');
  expectClose(action.height, command.height, 'action and command share a height');
  expectClose(command.x - brand.right, action.x - command.right, 'header column gutters match');

  expect(capabilities.x).toBeGreaterThanOrEqual(command.x - EDGE_TOLERANCE);
  expect(capabilities.right).toBeLessThanOrEqual(command.right + EDGE_TOLERANCE);
  expectClose(
    capabilities.x + capabilities.width / 2,
    command.x + command.width / 2,
    'capabilities are centered in the canvas column',
  );

  if (state.paletteOpen) {
    expect(palette).not.toBeNull();
    expectClose(brand.x, palette!.x, 'brand and inventory share a left edge');
    expectClose(brand.right, palette!.right, 'brand and inventory share a right edge');
  } else {
    expect(palette).toBeNull();
  }

  if (state.inspectorOpen) {
    expect(inspector).not.toBeNull();
    expectClose(action.x, inspector!.x, 'status and inspector share a left edge');
    expectClose(action.right, inspector!.right, 'status and inspector share a right edge');
  } else {
    expect(inspector).toBeNull();
  }

  expect(geometry.documentWidth, 'workspace has no horizontal overflow').toBeLessThanOrEqual(
    geometry.viewportWidth,
  );
}

test('desktop header, rails, and capabilities use one responsive workspace grid', async ({ app }) => {
  await app.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
  ]) {
    await app.setViewportSize(viewport);
    const baselineState = { paletteOpen: true, inspectorOpen: true };
    await setRailState(app, baselineState);
    const baseline = await readWorkspaceRects(app);
    expectSharedGrid(baseline, baselineState);

    for (const state of [
      { paletteOpen: false, inspectorOpen: true },
      { paletteOpen: true, inspectorOpen: false },
      { paletteOpen: false, inspectorOpen: false },
    ]) {
      await test.step(
        `${viewport.width}×${viewport.height}, palette ${state.paletteOpen ? 'open' : 'closed'}, inspector ${state.inspectorOpen ? 'open' : 'closed'}`,
        async () => {
          await setRailState(app, state);
          const geometry = await readWorkspaceRects(app);
          expectSharedGrid(geometry, state);
          expectSameRect(geometry.brand, baseline.brand, 'brand island');
          expectSameRect(geometry.command, baseline.command, 'command island');
          expectSameRect(geometry.action, baseline.action, 'action island');
          expectSameRect(geometry.capabilities, baseline.capabilities, 'capabilities strip');
        },
      );
    }
  }
});
