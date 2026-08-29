import { expect, loadResearchIntake, test } from './fixtures';
import { chooseInspectorOption, readGraph } from './helpers/graph';

test('routing mode transitions update semantics while keeping authored route fields stable', async ({ app }) => {
  await loadResearchIntake(app);
  const route = app.getByTestId('rf__edge-brief-supervisor');
  await route.focus();
  await route.press('Enter');

  await chooseInspectorOption(app, 'Routing mode', 'Command');
  await expect(app.locator('[aria-label="Command edge, invalid"]')).toHaveCount(1);
  await app.getByRole('textbox', { name: 'Route label' }).fill('dispatch supervisor');
  await app.getByRole('textbox', { name: 'Condition' }).fill('state.briefReady === true');

  let edge = (await readGraph(app)).edges.find((candidate) => candidate.id === 'brief-supervisor');
  expect(edge).toMatchObject({
    mode: 'command',
    label: 'dispatch supervisor',
    condition: 'state.briefReady === true',
  });

  await chooseInspectorOption(app, 'Routing mode', 'Edge');
  await expect(app.getByRole('textbox', { name: 'Condition' })).toHaveCount(0);
  edge = (await readGraph(app)).edges.find((candidate) => candidate.id === 'brief-supervisor');
  expect(edge).toMatchObject({ mode: 'normal', label: 'dispatch supervisor' });
});

test('a whitespace-only conditional condition is visibly invalid and blocks freezing', async ({ app }) => {
  await loadResearchIntake(app);
  await app.getByTestId('rf__edge-supervisor-final-report').focus();
  await app.keyboard.press('Enter');

  const condition = app.getByRole('textbox', { name: 'Condition' });
  await condition.fill('   ');
  await condition.blur();

  await expect(app.getByRole('alert')).toContainText('Every supplied conditional condition must be readable.');
  await expect(app.locator('[aria-label="Conditional edge, route enough evidence, invalid"]')).toHaveCount(1);
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();
});

test('a derived loop can be selected, removed by keyboard, and restored with undo', async ({ app }) => {
  await loadResearchIntake(app);
  const loop = app.locator('[aria-label="Loop normal edge, route continue"]');
  await expect(loop).toHaveCount(1);

  await app.getByTestId('rf__edge-researcher-continue').focus();
  await app.keyboard.press('Enter');
  await app.keyboard.press('Delete');
  expect((await readGraph(app)).edges.some((edge) => edge.id === 'researcher-continue')).toBe(false);

  await app.getByRole('button', { name: 'Undo' }).click();
  expect((await readGraph(app)).edges.some((edge) => edge.id === 'researcher-continue')).toBe(true);
  await expect(app.locator('[aria-label="Loop normal edge, route continue"]')).toHaveCount(1);
});

test('fallback help explains its contract and duplicate fallbacks surface validation', async ({ app }) => {
  await loadResearchIntake(app);
  await app.getByTestId('rf__edge-supervisor-researcher').click();
  await chooseInspectorOption(app, 'Routing mode', 'Fallback');

  await expect(app.getByText(/One fallback is allowed per source\./)).toBeVisible();
  await expect(app.getByRole('alert')).toContainText(
    '“Research Supervisor” can have at most one fallback edge.',
  );
  await expect(
    app.locator('header[aria-label="GraphContract workspace controls"] .workspace-contract-state'),
  ).toHaveText('2 issues');
  await expect(app.locator('.workspace-freeze-button')).toBeDisabled();
  expect(
    (await readGraph(app)).edges.filter(
      (edge) => edge.source === 'research-supervisor' && edge.mode === 'fallback',
    ),
  ).toHaveLength(2);
});

test('conditional label and condition edits update both canvas semantics and canonical data', async ({ app }) => {
  await loadResearchIntake(app);
  await app.getByTestId('rf__edge-supervisor-final-report').focus();
  await app.keyboard.press('Enter');

  await app.getByRole('textbox', { name: 'Route label' }).fill('publish report');
  await app.getByRole('textbox', { name: 'Condition' }).fill('evidence.score >= 0.9');

  await expect(app.locator('[aria-label="Conditional edge, route publish report"]')).toHaveCount(1);
  await expect(app.getByRole('status').filter({ hasText: 'Valid route configuration.' })).toBeVisible();
  expect(
    (await readGraph(app)).edges.find((edge) => edge.id === 'supervisor-final-report'),
  ).toMatchObject({
    label: 'publish report',
    condition: 'evidence.score >= 0.9',
  });
});
