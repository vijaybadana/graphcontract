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
  const added = after.nodes.find((node) => !before.nodes.some((candidate) => candidate.id === node.id));
  expect(after.nodes).toHaveLength(before.nodes.length + 1);
  expect(added).toMatchObject({ kind: 'step', executor: 'ai' });
  expect(
    after.nodes.filter((node) => node.kind === 'step' && node.executor === 'ai'),
  ).toHaveLength(
    before.nodes.filter((node) => node.kind === 'step' && node.executor === 'ai').length + 1,
  );
  await expect(app.getByRole('textbox', { name: 'Name' })).toHaveValue(added!.label);
});

test('dragging every work palette preset creates canonical Steps in a valid stable layout', async ({ app }) => {
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
    await expect(app.getByRole('button', { name: 'Auto-layout graph' })).toBeEnabled();

    const after = await readGraph(app);
    const added = after.nodes.filter((node) => !before.nodes.some((candidate) => candidate.id === node.id));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ kind: 'step', executor: preset.executor });
    expect(Number.isFinite(added[0].position.x)).toBe(true);
    expect(Number.isFinite(added[0].position.y)).toBe(true);
    expect(after.nodes.filter((node) =>
      node.position.x === added[0].position.x && node.position.y === added[0].position.y,
    )).toHaveLength(1);
    await expect.poll(async () =>
      (await readGraph(app)).nodes.find((node) => node.id === added[0].id)?.position,
    ).toEqual(added[0].position);
  }
});

test('shift-click creates a multi-selection and exposes its aggregate state', async ({ app }) => {
  await app.getByTestId('rf__node-classifier').click();
  await app.getByTestId('rf__node-billing').click({ modifiers: ['Shift'] });

  await expect(app.getByRole('heading', { name: '2 elements selected' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Duplicate selection' }).first()).toBeEnabled();
});

test('duplicate, delete, undo, and redo preserve one coherent history chain', async ({ app }) => {
  const initial = await readGraph(app);
  await app.getByTestId('rf__node-classifier').click();
  await app.getByRole('button', { name: 'Duplicate selection' }).first().click();

  let graph = await readGraph(app);
  expect(graph.nodes).toHaveLength(initial.nodes.length + 1);
  expect(graph.nodes.some((node) => node.label === 'Classifier Agent copy')).toBe(true);

  await expect(app.getByRole('button', { name: 'Delete selection' })).toBeEnabled();
  await app.getByRole('button', { name: 'Delete selection' }).click();
  graph = await readGraph(app);
  // Duplicate selects the new copy, so delete removes only that copy.
  expect(graph.nodes).toHaveLength(initial.nodes.length);
  expect(graph.nodes.some((node) => node.label === 'Classifier Agent')).toBe(true);
  expect(graph.nodes.some((node) => node.label === 'Classifier Agent copy')).toBe(false);

  await app.getByRole('button', { name: 'Undo' }).click();
  expect((await readGraph(app)).nodes.some((node) => node.label === 'Classifier Agent')).toBe(true);
  expect((await readGraph(app)).nodes.some((node) => node.label === 'Classifier Agent copy')).toBe(true);

  await app.getByRole('button', { name: 'Redo' }).click();
  expect((await readGraph(app)).nodes.some((node) => node.label === 'Classifier Agent')).toBe(true);
  expect((await readGraph(app)).nodes.some((node) => node.label === 'Classifier Agent copy')).toBe(false);
});
