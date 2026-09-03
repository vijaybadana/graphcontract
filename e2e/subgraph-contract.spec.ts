import { expect, test } from './fixtures';
import {
  loadResearchSupervisor,
  readGraph,
} from './helpers/graph';

test('Research Supervisor collapse hides members and expansion restores canonical edges', async ({ app }) => {
  await loadResearchSupervisor(app);
  await expect(app.getByTestId('rf__node-research-supervisor-agent')).toBeVisible();
  await expect(app.getByTestId('rf__edge-research-enter-subgraph')).toHaveCount(1);

  await app.getByRole('button', { name: 'Collapse subgraph Research Supervisor' }).first().click();
  await expect(app.getByTestId('rf__node-research-supervisor-agent')).toBeHidden();
  await expect(app.getByTestId('rf__edge-research-enter-subgraph')).toHaveCount(0);
  await expect(
    app.getByTestId('rf__edge-subgraph-proxy:research-outer-start:research-supervisor'),
  ).toHaveCount(1);

  await app.getByRole('button', { name: 'Expand subgraph Research Supervisor' }).first().click();
  await expect(app.getByTestId('rf__node-research-supervisor-agent')).toBeVisible();
  await expect(app.getByTestId('rf__edge-research-enter-subgraph')).toHaveCount(1);
});

test('collapsed proxy edges cannot delete the canonical boundary connection', async ({ app }) => {
  await loadResearchSupervisor(app);
  await app.getByRole('button', { name: 'Collapse subgraph Research Supervisor' }).first().click();
  const proxy = app.getByTestId(
    'rf__edge-subgraph-proxy:research-outer-start:research-supervisor',
  );

  await proxy.focus();
  await proxy.press('Enter');
  await expect(app.getByRole('button', { name: 'Delete selection' })).toBeDisabled();
  await app.keyboard.press('Delete');
  expect(
    (await readGraph(app)).edges.some((edge) => edge.id === 'research-enter-subgraph'),
  ).toBe(true);
  await expect(proxy).toHaveCount(1);
});

test('subgraph inspector resizes, assigns membership, and focuses the container', async ({ app }) => {
  await loadResearchSupervisor(app);
  await app.getByTestId('rf__node-research-outer-end').click();
  await app.getByRole('button', { name: /Parent subgraph/ }).click();
  await app.getByRole('option', { name: 'Research Supervisor', exact: true }).click();
  expect((await readGraph(app)).nodes.find((node) => node.id === 'research-outer-end')?.parentId).toBe(
    'research-supervisor',
  );

  await app
    .getByTestId('rf__node-research-supervisor')
    .locator('.subgraph-node-header')
    .click({ position: { x: 24, y: 20 } });
  await expect(app.getByRole('heading', { name: 'Research Supervisor', exact: true })).toBeVisible();
  await app.getByRole('spinbutton', { name: 'Width' }).fill('900');
  await app.getByRole('spinbutton', { name: 'Height' }).fill('420');

  const graph = await readGraph(app);
  expect(graph.subgraphs[0].dimensions).toEqual({ width: 900, height: 420 });

  const transformBefore = await app.locator('.react-flow__viewport').getAttribute('style');
  await app.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect
    .poll(() => app.locator('.react-flow__viewport').getAttribute('style'))
    .not.toBe(transformBefore);
});

test('reset restores the example graph and undo returns the prior demo', async ({ app }) => {
  await loadResearchSupervisor(app);
  await app.getByRole('button', { name: 'Reset example graph' }).click();
  await expect.poll(async () => (await readGraph(app)).id).toBe('customer-support-contract');
  await expect(app.getByTestId('rf__node-classifier')).toBeVisible();

  await app.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await readGraph(app)).id).toBe('research-supervisor-demo');
  await expect(app.getByTestId('rf__node-research-supervisor')).toBeVisible();
});

test('freezing a subgraph contract locks collapse, resize, membership, and node editing', async ({ app }) => {
  await loadResearchSupervisor(app);
  await app.getByRole('button', { name: /confirm (?:and|&) freeze/i }).click();
  await expect(app.getByRole('button', { name: 'Unfreeze contract; currently frozen' })).toBeVisible();
  const projection = app.getByRole('radiogroup', { name: 'Canvas projection' });
  await expect(projection.getByRole('radio', { name: 'Scenario', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await projection.getByRole('radio', { name: 'Design', exact: true }).click();
  await expect(projection.getByRole('radio', { name: 'Design', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await app
    .getByTestId('rf__node-research-supervisor')
    .locator('.subgraph-node-header')
    .click({ position: { x: 24, y: 20 } });
  await expect(app.getByRole('button', { name: 'Collapse subgraph Research Supervisor' }).first()).toBeDisabled();
  await expect(app.getByRole('spinbutton', { name: 'Width' })).toBeDisabled();
  await expect(app.getByRole('button', { name: /Add selected nodes/ })).toBeDisabled();

  await app.getByTestId('rf__node-research-supervisor-agent').click();
  await expect(app.getByLabel('Name', { exact: true })).toBeDisabled();
  expect((await readGraph(app)).status).toBe('frozen');
});
