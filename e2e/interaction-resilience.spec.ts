import { readFile } from 'node:fs/promises';
import type { Download, Page } from '@playwright/test';

import { callWebMcpTool, expect, freezeResearchIntake, test } from './fixtures';

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
  scenarios: Array<{ id: string; name: string }>;
};

async function readGraph(page: Page) {
  return (await callWebMcpTool<GraphRead>(page, 'get_graph', {})).graph;
}

async function loadHumanControlDemo(page: Page) {
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Replace the current canvas with the Human Control & HITL demo?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Load Human Control & HITL demo' }).click();
  await expect.poll(async () => (await readGraph(page)).id).toBe('human-control-hitl-demo');
}

async function loadParallelResearchDemo(page: Page) {
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Replace the current canvas with the Parallel research Send ×N demo?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Load Parallel research · Send ×N' }).click();
  await expect.poll(async () => (await readGraph(page)).id).toBe('dynamic-parallelism-merge-demo');
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
    await expect(app.getByLabel('Graph status')).toContainText('1 selected');
  }

  expect(await readGraph(app)).toEqual(accepted);
  expect({ undoDisabled: await undo.isDisabled(), redoDisabled: await redo.isDisabled() }).toEqual(historyBefore);
  await undo.click();
  await expect.poll(() => readGraph(app)).toEqual(initial);
  await redo.click();
  await expect.poll(() => readGraph(app)).toEqual(accepted);
});

test('portal dialogs establish focus and restore it to their invoking controls', async ({ app }) => {
  const libraryTrigger = app.getByRole('button', { name: 'Workflow library, 10 templates' });
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

test('repeated per-case and all-case downloads remain valid without stale Blob URLs', async ({ app }) => {
  test.setTimeout(120_000);
  await freezeResearchIntake(app);
  await app.getByRole('tab', { name: 'Scenarios (5)' }).click();
  const scenarioRead = await callWebMcpTool<ScenarioRead>(app, 'get_branch_scenarios', {});
  expect(scenarioRead.scenarios.length).toBeGreaterThan(1);
  const firstScenario = scenarioRead.scenarios[0];
  const secondScenario = scenarioRead.scenarios[1];
  await app.locator(`button[data-scenario-id="${firstScenario.id}"]`).click();

  const firstCaseFilenames = [
    `graph-test-${firstScenario.id}.json`,
    `test_graph_path_${firstScenario.id.replaceAll('-', '_')}.py`,
  ];
  const firstCaseArtifacts = [] as Array<{ href: string; text: string }>;
  for (const filename of firstCaseFilenames) {
    const link = app.getByRole('link', { name: `Download ${filename}` });
    await expect(link).toHaveAttribute('href', /^blob:/);
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    const artifact = await consumeDownload(app, filename);
    firstCaseArtifacts.push({ href: href!, text: artifact.text });
  }

  await app.evaluate(() => {
    const observedWindow = window as Window & { __revokedGraphContractBlobUrls?: string[] };
    observedWindow.__revokedGraphContractBlobUrls = [];
    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      observedWindow.__revokedGraphContractBlobUrls!.push(url);
      revokeObjectURL(url);
    };
  });
  await app.locator(`button[data-scenario-id="${secondScenario.id}"]`).click();
  await expect(app.getByLabel(`Selected scenario: ${secondScenario.name}`)).toBeVisible();
  await expect.poll(
    () => app.evaluate(
      () => (window as Window & { __revokedGraphContractBlobUrls?: string[] })
        .__revokedGraphContractBlobUrls ?? [],
    ),
    { timeout: 8_000, intervals: [100, 250, 500] },
  ).toEqual(expect.arrayContaining(firstCaseArtifacts.map((artifact) => artifact.href)));

  const secondCaseFilenames = [
    `graph-test-${secondScenario.id}.json`,
    `test_graph_path_${secondScenario.id.replaceAll('-', '_')}.py`,
  ];
  for (const [index, filename] of secondCaseFilenames.entries()) {
    const link = app.getByRole('link', { name: `Download ${filename}` });
    await expect(link).toHaveAttribute('href', /^blob:/);
    const artifact = await consumeDownload(app, filename);
    expect(artifact.text).not.toBe(firstCaseArtifacts[index]!.text);
    expect(artifact.text.length).toBeGreaterThan(40);
  }

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
