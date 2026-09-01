import { expect, test, type Page } from '@playwright/test';

function guardBrowser(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`[console.${message.type()}] ${message.text()}`);
    }
  });
  return problems;
}

test('landing explains the lifecycle and opens the existing canvas', async ({ page }) => {
  const problems = guardBrowser(page);
  await page.addInitScript(() => {
    type LandingHarnessWindow = Window & { __landingToolNames?: string[] };
    type LandingHarnessDocument = Document & {
      modelContext?: {
        registerTool: (tool: { name: string }) => Promise<void>;
      };
    };
    const targetWindow = window as LandingHarnessWindow;
    targetWindow.__landingToolNames = [];
    Object.defineProperty(document as LandingHarnessDocument, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (tool: { name: string }) => {
          targetWindow.__landingToolNames!.push(tool.name);
        },
      },
    });
  });
  await page.goto('/landing');

  await expect(page).toHaveTitle('GraphContract — Plan agent behavior before code');
  await expect(page.getByRole('heading', { name: 'Plan agent behavior before code.' })).toBeVisible();
  await expect(page.getByText('Agent proposal', { exact: true })).toBeVisible();
  await expect(page.getByText('Human review', { exact: true })).toBeVisible();
  await expect(page.getByText('Frozen contract', { exact: true })).toBeVisible();
  await expect(page.getByText('Implementation handoff', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => (window as Window & { __landingToolNames?: string[] }).__landingToolNames ?? [],
  )).toEqual([]);

  await page.getByRole('link', { name: 'See how it works' }).click();
  await expect(page).toHaveURL(/\/landing#how-it-works$/);
  await expect(page.locator('#how-it-works')).toBeInViewport();

  await page.getByRole('link', { name: 'Open canvas' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('application')).toBeVisible();
  await expect(page.locator('header[aria-label="GraphContract workspace controls"]')).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => ((window as Window & { __landingToolNames?: string[] }).__landingToolNames ?? []).sort(),
  )).toEqual(['get_branch_scenarios', 'get_graph', 'propose_graph_changes']);
  expect(problems).toEqual([]);
});

test('390px landing keeps the lifecycle legible without horizontal overflow', async ({ page }) => {
  const problems = guardBrowser(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/landing');

  await expect(page.getByRole('heading', { name: 'Plan agent behavior before code.' })).toBeVisible();
  await expect(page.getByText('Agent proposal', { exact: true })).toBeVisible();
  await expect(page.getByText('Human review', { exact: true })).toBeVisible();
  await expect(page.getByText('Revise', { exact: true })).toBeVisible();
  await expect(page.getByText('Approve', { exact: true })).toBeVisible();
  await expect(page.getByText('Implementation handoff', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
  expect(problems).toEqual([]);
});

test('reduced motion settles into a fully legible graph', async ({ page }) => {
  const problems = guardBrowser(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/landing');

  const nodes = page.locator('.landing-graph-node');
  await expect(nodes).toHaveCount(7);
  for (const node of await nodes.all()) {
    await expect(node).toBeVisible();
    await expect.poll(() => node.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  }
  expect(problems).toEqual([]);
});
