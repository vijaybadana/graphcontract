import type { Page } from '@playwright/test';

import { callWebMcpTool, expect } from '../fixtures';

export type E2EGraphNode = {
  id: string;
  kind: string;
  label: string;
  parentId?: string;
  position: { x: number; y: number };
};

export type E2EGraphEdge = {
  id: string;
  source: string;
  target: string;
  mode: 'normal' | 'conditional' | 'command' | 'fallback';
  label?: string;
  condition?: string;
};

export type E2ESubgraph = {
  id: string;
  label: string;
  collapsed: boolean;
  dimensions: { width: number; height: number };
};

export type E2EGraph = {
  id: string;
  name: string;
  status: 'draft' | 'frozen';
  nodes: E2EGraphNode[];
  edges: E2EGraphEdge[];
  subgraphs: E2ESubgraph[];
};

export async function readGraph(page: Page): Promise<E2EGraph> {
  const result = await callWebMcpTool<{ ok: true; graph: E2EGraph }>(page, 'get_graph', {});
  expect(result.ok).toBe(true);
  return result.graph;
}

export async function loadResearchSupervisor(page: Page) {
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Replace the current canvas with the Research Supervisor demo?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Load Research Supervisor demo' }).click();
  await expect(page.getByText('Research Supervisor Workflow', { exact: true })).toBeVisible();
  await expect(page.getByText('6 nodes · 5 branches', { exact: true })).toBeVisible();
}

export async function chooseInspectorOption(
  page: Page,
  triggerName: string,
  optionName: string,
) {
  await page.getByRole('button', { name: triggerName }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}
