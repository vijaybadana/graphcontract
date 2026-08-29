import { expect, test } from './fixtures';
import { readGraph } from './helpers/graph';

test('palette search click-add creates the selected normalized Step preset', async ({ app }) => {
  const before = await readGraph(app);
  const search = app.getByRole('searchbox', { name: 'Search components' });

  await search.fill('agent');
  await expect(app.getByRole('button', { name: 'Agent', exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Tool', exact: true })).toHaveCount(0);
  await app.getByRole('button', { name: 'Agent', exact: true }).click();

  const after = await readGraph(app);
  expect(after.nodes).toHaveLength(before.nodes.length + 1);
  expect(
    after.nodes.filter((node) => node.kind === 'step' && node.executor === 'ai'),
  ).toHaveLength(
    before.nodes.filter((node) => node.kind === 'step' && node.executor === 'ai').length + 1,
  );
  await expect(app.getByRole('heading', { name: 'Node details' })).toBeVisible();
});

test('dragging a palette item onto the canvas creates it near the drop point', async ({ app }) => {
  const before = await readGraph(app);
  const tool = app.getByRole('button', { name: 'Tool', exact: true });
  const canvas = app.getByRole('application');

  await tool.dragTo(canvas, { targetPosition: { x: 720, y: 520 } });

  const after = await readGraph(app);
  const addedTools = after.nodes.filter(
    (node) =>
      node.kind === 'step' &&
      node.executor === 'tool' &&
      !before.nodes.some((candidate) => candidate.id === node.id),
  );
  expect(addedTools).toHaveLength(1);
  expect(addedTools[0].position.x).toBeGreaterThan(300);
  expect(addedTools[0].position.y).toBeGreaterThan(150);
});

test('shift-click creates a multi-selection and exposes its aggregate state', async ({ app }) => {
  await app.getByTestId('rf__node-classifier').click();
  await app.getByTestId('rf__node-billing').click({ modifiers: ['Shift'] });

  await expect(app.getByRole('status').filter({ hasText: '2 elements selected' })).toBeVisible();
  await expect(app.getByText('2 selected', { exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Duplicate selection' }).first()).toBeEnabled();
});

test('duplicate, delete, undo, and redo preserve one coherent history chain', async ({ app }) => {
  const initial = await readGraph(app);
  await app.getByTestId('rf__node-classifier').click();
  await app.getByRole('button', { name: 'Duplicate selection' }).first().click();

  let graph = await readGraph(app);
  expect(graph.nodes).toHaveLength(initial.nodes.length + 1);
  expect(graph.nodes.some((node) => node.label === 'Classifier Agent copy')).toBe(true);

  await app.getByRole('button', { name: 'Delete selection' }).click();
  graph = await readGraph(app);
  // Duplicate intentionally retains the source and copy as one selection, so
  // the subsequent delete removes both in a single undoable edit.
  expect(graph.nodes).toHaveLength(initial.nodes.length - 1);
  expect(graph.nodes.some((node) => node.label === 'Classifier Agent')).toBe(false);
  expect(graph.nodes.some((node) => node.label === 'Classifier Agent copy')).toBe(false);

  await app.getByRole('button', { name: 'Undo' }).click();
  expect((await readGraph(app)).nodes.some((node) => node.label === 'Classifier Agent')).toBe(true);
  expect((await readGraph(app)).nodes.some((node) => node.label === 'Classifier Agent copy')).toBe(true);

  await app.getByRole('button', { name: 'Redo' }).click();
  expect((await readGraph(app)).nodes.some((node) => node.label === 'Classifier Agent')).toBe(false);
  expect((await readGraph(app)).nodes.some((node) => node.label === 'Classifier Agent copy')).toBe(false);
});
