import { expect, test as base, type Page, type TestInfo } from '@playwright/test';

type BrowserTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  execute: (input: unknown) => Promise<unknown>;
};

type ConsoleGuard = {
  problems: string[];
};

const expectedToolNames = [
  'get_branch_scenarios',
  'get_graph',
  'propose_graph_changes',
];

async function installWebMcpHarness(page: Page) {
  await page.addInitScript(() => {
    type RegisteredTool = {
      name: string;
      execute: (input: unknown) => Promise<unknown>;
    };
    type ToolRegistry = Record<string, RegisteredTool>;
    type HarnessWindow = Window & { __graphContractWebMcpTools?: ToolRegistry };
    type HarnessDocument = Document & {
      modelContext?: {
        registerTool: (
          tool: RegisteredTool,
          options?: { signal?: AbortSignal },
        ) => Promise<void>;
      };
    };

    const harnessWindow = window as HarnessWindow;
    harnessWindow.__graphContractWebMcpTools = {};

    Object.defineProperty(document as HarnessDocument, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (
          tool: RegisteredTool,
          options?: { signal?: AbortSignal },
        ) => {
          const registry = harnessWindow.__graphContractWebMcpTools!;
          registry[tool.name] = tool;
          options?.signal?.addEventListener(
            'abort',
            () => {
              if (registry[tool.name] === tool) delete registry[tool.name];
            },
            { once: true },
          );
        },
      },
    });
  });
}

async function attachConsoleProblems(testInfo: TestInfo, problems: string[]) {
  if (problems.length === 0) return;
  await testInfo.attach('browser-console.txt', {
    body: problems.join('\n'),
    contentType: 'text/plain',
  });
}

export const test = base.extend<{ app: Page; consoleGuard: ConsoleGuard }>({
  consoleGuard: [
    async ({ page }, run, testInfo) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          problems.push(`[console.${message.type()}] ${message.text()}`);
        }
      });

      await run({ problems });
      await attachConsoleProblems(testInfo, problems);
      expect(problems, 'unexpected browser errors or warnings').toEqual([]);
    },
    { auto: true },
  ],

  app: async ({ page }, run) => {
    await installWebMcpHarness(page);
    await page.goto('/');
    await expect(page).toHaveTitle('GraphContract — Human-approved agent workflows');
    await expect(
      page.locator('header[aria-label="GraphContract workspace controls"]'),
    ).toBeVisible();
    await expect(page.getByRole('application')).toBeVisible();
    await expect.poll(() => webMcpToolNames(page)).toEqual(expectedToolNames);
    await run(page);
  },
});

export { expect } from '@playwright/test';

export async function webMcpToolNames(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const registry = (window as Window & {
      __graphContractWebMcpTools?: Record<string, BrowserTool>;
    }).__graphContractWebMcpTools;
    return Object.keys(registry ?? {}).sort();
  });
}

export async function webMcpToolMetadata(page: Page, name: string) {
  return page.evaluate((toolName) => {
    const registry = (window as Window & {
      __graphContractWebMcpTools?: Record<string, BrowserTool>;
    }).__graphContractWebMcpTools;
    const tool = registry?.[toolName];
    if (!tool) throw new Error(`WebMCP tool not registered: ${toolName}`);
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    };
  }, name);
}

export async function callWebMcpTool<Result>(
  page: Page,
  name: string,
  input: unknown,
): Promise<Result> {
  return page.evaluate(
    async ({ toolName, toolInput }) => {
      const registry = (window as Window & {
        __graphContractWebMcpTools?: Record<string, BrowserTool>;
      }).__graphContractWebMcpTools;
      const tool = registry?.[toolName];
      if (!tool) throw new Error(`WebMCP tool not registered: ${toolName}`);
      return tool.execute(toolInput);
    },
    { toolName: name, toolInput: input },
  ) as Promise<Result>;
}

export async function loadResearchIntake(page: Page) {
  await loadGraphLibraryEntry(page, 'Research Intake Routing', 'research-intake-routing-demo');
  await expect.poll(async () => {
    const result = await callWebMcpTool<{
      ok: true;
      graph: { id: string; name: string; nodes: unknown[]; edges: unknown[] };
    }>(page, 'get_graph', {});
    return {
      id: result.graph.id,
      name: result.graph.name,
      nodes: result.graph.nodes.length,
      edges: result.graph.edges.length,
    };
  }).toEqual({
    id: 'research-intake-routing-demo',
    name: 'Research Intake Routing',
    nodes: 9,
    edges: 9,
  });
}

export async function loadGraphLibraryEntry(page: Page, title: string, expectedGraphId: string) {
  if (!(await page.getByRole('dialog', { name: 'Graph library' }).isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Workflow library, 14 templates' }).click();
    await expect(page.getByRole('dialog', { name: 'Graph library' })).toBeVisible();
  }
  await page.getByRole('button', { name: `Open ${title}` }).click();
  await confirmGraphLibraryReplacement(page, title);
  await expect.poll(async () => {
    const result = await callWebMcpTool<{
      ok: true; graph: { id: string };
    }>(page, 'get_graph', {});
    return result.graph.id;
  }).toBe(expectedGraphId);
}

export async function confirmGraphLibraryReplacement(page: Page, title: string) {
  const confirmation = page.getByRole('alertdialog', { name: `Open “${title}”?` });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('One Undo restores your current workflow.');
  await confirmation.getByRole('button', { name: 'Replace canvas' }).click();
  await expect(confirmation).toHaveCount(0);
}

export async function freezeResearchIntake(page: Page) {
  await loadResearchIntake(page);
  await page
    .getByRole('button', { name: /confirm (?:and|&) freeze/i })
    .click();
  await expect.poll(async () => {
    const result = await callWebMcpTool<{
      ok: true;
      graph: { status: 'draft' | 'frozen' };
    }>(page, 'get_graph', {});
    return result.graph.status;
  }).toBe('frozen');
}
