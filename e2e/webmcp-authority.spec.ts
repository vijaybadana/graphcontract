import {
  callWebMcpTool,
  expect,
  test,
  webMcpToolNames,
} from './fixtures';

type GraphRead = {
  ok: true;
  graph: {
    status: 'draft' | 'frozen';
    updatedAt: string;
    nodes: Array<{ id: string; label: string }>;
  };
  pendingProposal?: { status: string; rationale: string };
};

const classifierLabel = (read: GraphRead) =>
  read.graph.nodes.find((node) => node.id === 'classifier')?.label;

test('WebMCP exposes exactly three tools and keeps approval and rejection human-only', async ({ app }) => {
  expect(await webMcpToolNames(app)).toEqual([
    'get_branch_scenarios',
    'get_graph',
    'propose_graph_changes',
  ]);

  const original = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(classifierLabel(original)).toBe('Classifier Agent');

  const rejectedProposal = await callWebMcpTool<{ ok: boolean }>(
    app,
    'propose_graph_changes',
    {
      expectedGraphUpdatedAt: original.graph.updatedAt,
      operations: [
        {
          type: 'update_node',
          nodeId: 'classifier',
          patch: { label: 'Rejected Classifier' },
        },
      ],
      rationale: 'E2E: rejected proposal remains review-only.',
    },
  );
  expect(rejectedProposal.ok).toBe(true);
  await expect(app.getByText('Proposal awaiting review', { exact: true })).toBeVisible();
  await expect(app.getByText('Rejected Classifier', { exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Agent' })).toBeDisabled();
  await expect(app.getByRole('button', { name: 'Confirm & freeze' })).toBeDisabled();

  const pendingRead = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(classifierLabel(pendingRead)).toBe('Classifier Agent');
  expect(pendingRead.pendingProposal).toMatchObject({
    status: 'pending',
    rationale: 'E2E: rejected proposal remains review-only.',
  });

  await app.getByRole('button', { name: 'Reject' }).click();
  await expect(app.getByText('Proposal rejected. The accepted graph was not changed.')).toBeVisible();
  const afterReject = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(classifierLabel(afterReject)).toBe('Classifier Agent');

  const approvedProposal = await callWebMcpTool<{ ok: boolean }>(
    app,
    'propose_graph_changes',
    {
      expectedGraphUpdatedAt: afterReject.graph.updatedAt,
      operations: [
        {
          type: 'update_node',
          nodeId: 'classifier',
          patch: { label: 'Approved Classifier' },
        },
      ],
      rationale: 'E2E: approved proposal applies only after the UI action.',
    },
  );
  expect(approvedProposal.ok).toBe(true);
  await app.getByRole('button', { name: 'Approve' }).click();
  const afterApprove = await callWebMcpTool<GraphRead>(app, 'get_graph', {});
  expect(classifierLabel(afterApprove)).toBe('Approved Classifier');

  await app.reload();
  await expect(app.getByText('Approved Classifier', { exact: true })).toBeVisible();
  expect(classifierLabel(await callWebMcpTool<GraphRead>(app, 'get_graph', {}))).toBe(
    'Approved Classifier',
  );
});
