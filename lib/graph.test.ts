import { describe, expect, it } from 'vitest';

import {
  applyGraphOperations,
  createProposal,
  enumerateScenarios,
  GraphOperation,
  proposalDiff,
  proposalInputSchema,
  researchSupervisorGraph,
  sampleGraph,
  validateGraph,
  workflowGraphSchema,
} from './graph';

const cloneSample = () => structuredClone(sampleGraph);

describe('graph validation', () => {
  it('accepts the predefined customer-support workflow', () => {
    expect(validateGraph(cloneSample())).toEqual([]);
  });

  it('rejects mixed normal and conditional routing', () => {
    const graph = cloneSample();
    graph.edges.push({
      id: 'classifier-extra-normal',
      source: 'classifier',
      target: 'end',
      mode: 'normal',
    });

    expect(validateGraph(graph).some((entry) => entry.code === 'MIXED_ROUTING')).toBe(true);
  });

  it('allows topology cycles while rejecting End outgoing routes', () => {
    const graph = cloneSample();
    graph.edges.push({
      id: 'end-classifier',
      source: 'end',
      target: 'classifier',
      mode: 'normal',
    });

    const codes = validateGraph(graph).map((entry) => entry.code);
    expect(codes).not.toContain('CYCLE_DETECTED');
    expect(codes).toContain('END_HAS_OUTGOING');
  });

  it('normalizes a persisted pre-subgraph graph to an empty subgraph collection', () => {
    const legacy = cloneSample();
    delete (legacy as { subgraphs?: unknown }).subgraphs;

    expect(workflowGraphSchema.parse(legacy).subgraphs).toEqual([]);
  });

  it('accepts and traverses the Research Supervisor subgraph demo through its internal boundaries', () => {
    const graph = structuredClone(researchSupervisorGraph);

    expect(validateGraph(graph)).toEqual([]);
    expect(enumerateScenarios({ ...graph, status: 'frozen' })).toEqual([
      expect.objectContaining({
        orderedPath: [
          'research-outer-start',
          'research-subgraph-start',
          'research-supervisor-agent',
          'research-supervisor-tools',
          'research-subgraph-end',
          'research-outer-end',
        ],
        expectedTerminalNode: 'research-outer-end',
      }),
    ]);
  });
});

describe('proposals and scenarios', () => {
  it('creates a proposal without mutating accepted graph state', () => {
    const graph = cloneSample();
    const before = structuredClone(graph);
    const result = createProposal(graph, {
      rationale: 'Rename the billing specialist for clarity.',
      operations: [
        {
          type: 'update_node',
          nodeId: 'billing',
          patch: { label: 'Billing Resolution Agent' },
        },
      ],
    });

    expect(result.proposal?.status).toBe('pending');
    expect(graph).toEqual(before);
    expect(graph.nodes.find((node) => node.id === 'billing')?.label).toBe('Billing Agent');
  });

  it('accepts the dedicated subgraph operation schema and keeps parent membership out of node patches', () => {
    const subgraph = {
      id: 'review-area',
      label: 'Review area',
      position: { x: 400, y: 100 },
      dimensions: { width: 640, height: 360 },
      collapsed: false,
    };
    const parsed = proposalInputSchema.safeParse({
      rationale: 'Organize review work.',
      operations: [
        { type: 'add_subgraph', subgraph },
        { type: 'update_subgraph', subgraphId: subgraph.id, patch: { label: 'Review workspace' } },
        {
          type: 'add_node',
          node: {
            id: 'review-agent',
            kind: 'agent',
            label: 'Review agent',
            parentId: subgraph.id,
            position: { x: 60, y: 80 },
          },
        },
        { type: 'assign_nodes_to_subgraph', subgraphId: subgraph.id, nodeIds: ['billing'] },
        { type: 'remove_nodes_from_subgraph', nodeIds: ['billing'] },
        { type: 'dissolve_subgraph', subgraphId: subgraph.id },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(
      proposalInputSchema.safeParse({
        rationale: 'Use the dedicated membership operation instead.',
        operations: [
          { type: 'update_node', nodeId: 'billing', patch: { parentId: 'review-area' } },
        ],
      }).success,
    ).toBe(false);
  });

  it('applies subgraph operations in order and preserves absolute positions and canonical edges', () => {
    const graph = cloneSample();
    const before = structuredClone(graph);
    const operations: GraphOperation[] = [
      {
        type: 'add_subgraph',
        subgraph: {
          id: 'review-area',
          label: 'Review area',
          position: { x: 400, y: 100 },
          dimensions: { width: 640, height: 360 },
          collapsed: false,
        },
      },
      {
        type: 'update_subgraph',
        subgraphId: 'review-area',
        patch: { position: { x: 430, y: 90 }, label: 'Updated review area' },
      },
      {
        type: 'add_node',
        node: {
          id: 'review-agent',
          kind: 'agent',
          label: 'Review agent',
          parentId: 'review-area',
          position: { x: 50, y: 70 },
        },
      },
      { type: 'assign_nodes_to_subgraph', subgraphId: 'review-area', nodeIds: ['billing'] },
      { type: 'remove_nodes_from_subgraph', nodeIds: ['billing'] },
      { type: 'dissolve_subgraph', subgraphId: 'review-area' },
    ];

    const applied = applyGraphOperations(graph, operations);

    expect(applied.errors).toEqual([]);
    expect(applied.graph.subgraphs).toEqual([]);
    expect(applied.graph.nodes.find((node) => node.id === 'billing')).toMatchObject({
      position: { x: 480, y: 60 },
    });
    expect(applied.graph.nodes.find((node) => node.id === 'billing')).not.toHaveProperty('parentId');
    expect(applied.graph.nodes.find((node) => node.id === 'review-agent')).toMatchObject({
      position: { x: 480, y: 160 },
    });
    expect(applied.graph.nodes.find((node) => node.id === 'review-agent')).not.toHaveProperty('parentId');
    expect(applied.graph.edges).toEqual(before.edges);
    expect(graph).toEqual(before);
  });

  it('requires referenced subgraphs and nodes to exist at their operation step', () => {
    const applied = applyGraphOperations(cloneSample(), [
      {
        type: 'add_node',
        node: {
          id: 'orphaned-review-agent',
          kind: 'agent',
          label: 'Orphaned review agent',
          parentId: 'later-subgraph',
          position: { x: 0, y: 0 },
        },
      },
      {
        type: 'add_subgraph',
        subgraph: {
          id: 'later-subgraph',
          label: 'Later subgraph',
          position: { x: 0, y: 0 },
          dimensions: { width: 640, height: 360 },
          collapsed: false,
        },
      },
      { type: 'assign_nodes_to_subgraph', subgraphId: 'later-subgraph', nodeIds: ['missing-node'] },
    ]);

    expect(applied.errors.map((entry) => entry.code)).toEqual(['OPERATION_NOT_FOUND', 'OPERATION_NOT_FOUND']);
    expect(applied.graph.nodes.some((node) => node.id === 'orphaned-review-agent')).toBe(false);
  });

  it('creates a valid proposed subgraph structure and reports deterministic membership diffs', () => {
    const graph = cloneSample();
    const result = createProposal(graph, {
      rationale: 'Insert a review subgraph in the billing branch.',
      operations: [
        { type: 'remove_edge', edgeId: 'classifier-billing' },
        { type: 'remove_node', nodeId: 'billing' },
        {
          type: 'add_subgraph',
          subgraph: {
            id: 'billing-review',
            label: 'Billing review',
            position: { x: 400, y: 20 },
            dimensions: { width: 620, height: 300 },
            collapsed: false,
          },
        },
        {
          type: 'add_node',
          node: {
            id: 'billing-review-start',
            kind: 'start',
            label: 'Review start',
            parentId: 'billing-review',
            position: { x: 30, y: 100 },
          },
        },
        {
          type: 'add_node',
          node: {
            id: 'billing-review-agent',
            kind: 'agent',
            label: 'Billing review',
            parentId: 'billing-review',
            position: { x: 210, y: 100 },
          },
        },
        {
          type: 'add_node',
          node: {
            id: 'billing-review-end',
            kind: 'end',
            label: 'Review complete',
            parentId: 'billing-review',
            position: { x: 410, y: 100 },
          },
        },
        {
          type: 'add_edge',
          edge: {
            id: 'classifier-review-start',
            source: 'classifier',
            target: 'billing-review-start',
            mode: 'conditional',
            label: 'billing',
          },
        },
        {
          type: 'add_edge',
          edge: { id: 'review-start-agent', source: 'billing-review-start', target: 'billing-review-agent', mode: 'normal' },
        },
        {
          type: 'add_edge',
          edge: { id: 'review-agent-end', source: 'billing-review-agent', target: 'billing-review-end', mode: 'normal' },
        },
        {
          type: 'add_edge',
          edge: { id: 'review-end-refund', source: 'billing-review-end', target: 'refund', mode: 'normal' },
        },
      ],
    });

    expect(result.proposal?.status).toBe('pending');
    expect(result.proposal?.validationErrors).toBeUndefined();
    expect(result.proposal?.diff.addedSubgraphIds).toEqual(['billing-review']);
    expect(result.proposal?.diff.membershipChangedNodeIds).toEqual([
      'billing-review-start',
      'billing-review-agent',
      'billing-review-end',
    ]);
    expect(graph.subgraphs).toEqual([]);

    const diff = proposalDiff([
      { type: 'assign_nodes_to_subgraph', subgraphId: 'billing-review', nodeIds: ['billing', 'billing'] },
      { type: 'remove_nodes_from_subgraph', nodeIds: ['billing'] },
    ]);
    expect(diff.membershipChangedNodeIds).toEqual(['billing']);
  });

  it('enumerates every reachable path after the demo routing proposal', () => {
    const graph = cloneSample();
    const humanEdit: GraphOperation[] = [
      { type: 'remove_edge', edgeId: 'billing-refund' },
      {
        type: 'add_node',
        node: {
          id: 'fraud',
          kind: 'action',
          label: 'Fraud Check',
          position: { x: 690, y: 20 },
        },
      },
      {
        type: 'add_edge',
        edge: { id: 'billing-fraud', source: 'billing', target: 'fraud', mode: 'normal' },
      },
      {
        type: 'add_edge',
        edge: { id: 'fraud-refund', source: 'fraud', target: 'refund', mode: 'normal' },
      },
    ];
    const humanResult = applyGraphOperations(graph, humanEdit).graph;
    expect(validateGraph(humanResult)).toEqual([]);

    const agentOperations: GraphOperation[] = [
      { type: 'remove_edge', edgeId: 'fraud-refund' },
      {
        type: 'add_node',
        node: {
          id: 'human-approval',
          kind: 'human_input',
          label: 'Human Approval',
          position: { x: 880, y: 20 },
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'fraud-low',
          source: 'fraud',
          target: 'refund',
          mode: 'conditional',
          label: 'low_value',
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'fraud-high',
          source: 'fraud',
          target: 'human-approval',
          mode: 'conditional',
          label: 'high_value',
        },
      },
      {
        type: 'add_edge',
        edge: {
          id: 'approval-refund',
          source: 'human-approval',
          target: 'refund',
          mode: 'normal',
        },
      },
    ];
    const proposal = createProposal(humanResult, {
      rationale: 'Require human approval for high-value refunds.',
      operations: agentOperations,
    });
    expect(proposal.proposal?.status).toBe('pending');

    const finalGraph = applyGraphOperations(humanResult, agentOperations).graph;
    expect(validateGraph(finalGraph)).toEqual([]);
    const scenarios = enumerateScenarios({ ...finalGraph, status: 'frozen' });
    expect(scenarios).toHaveLength(4);
    expect(scenarios.flatMap((scenario) => scenario.triggeringConditions.map((item) => item.label))).toEqual(
      expect.arrayContaining(['billing', 'technical', 'unknown', 'low_value', 'high_value']),
    );
  });
});
