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

test('dragging every work palette preset onto the canvas creates canonical Steps near the drop point', async ({ app }) => {
  const canvas = app.getByRole('application');

  for (const [index, preset] of (
    [
      { name: 'Task', executor: 'deterministic' },
      { name: 'Agent', executor: 'ai' },
      { name: 'Tool', executor: 'tool' },
      { name: 'Human', executor: 'human' },
    ] as const
  ).entries()) {
    const before = await readGraph(app);
    await app.getByRole('button', { name: preset.name, exact: true }).dragTo(canvas, {
      targetPosition: { x: 560 + index * 40, y: 360 + index * 40 },
    });

    const after = await readGraph(app);
    const added = after.nodes.filter((node) => !before.nodes.some((candidate) => candidate.id === node.id));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ kind: 'step', executor: preset.executor });
    expect(added[0].position.x).toBeGreaterThan(300);
    expect(added[0].position.y).toBeGreaterThan(150);
  }
});

test('shift-click creates a multi-selection and exposes its aggregate state', async ({ app }) => {
  await app.getByTestId('rf__node-classifier').click();
  await app.getByTestId('rf__node-billing').click({ modifiers: ['Shift'] });

  await expect(app.getByRole('status').filter({ hasText: '2 elements selected' })).toBeVisible();
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
