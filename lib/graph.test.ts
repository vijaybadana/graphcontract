import { describe, expect, it } from 'vitest';

import {
  applyGraphOperations,
  createProposal,
  enumerateScenarios,
  GraphOperation,
  sampleGraph,
  validateGraph,
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

  it('rejects cycles', () => {
    const graph = cloneSample();
    graph.edges.push({
      id: 'end-classifier',
      source: 'end',
      target: 'classifier',
      mode: 'normal',
    });

    const codes = validateGraph(graph).map((entry) => entry.code);
    expect(codes).toContain('CYCLE_DETECTED');
    expect(codes).toContain('END_HAS_OUTGOING');
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
