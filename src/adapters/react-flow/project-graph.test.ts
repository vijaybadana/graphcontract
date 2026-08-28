import { describe, expect, it } from 'vitest';

import { projectGraphToCanvas } from '@/src/adapters/react-flow/project-graph';
import { createProposal, sampleGraph } from '@/src/domain';

const emptySelection = { nodeIds: [], edgeIds: [], primary: null };

describe('projectGraphToCanvas', () => {
  it('keeps node dimensions stable while previewing proposal badges', () => {
    const graph = structuredClone(sampleGraph);
    const proposal = createProposal(graph, {
      operations: [
        { type: 'update_node', nodeId: 'diagnostic', patch: { label: 'Technical Review' } },
      ],
      rationale: 'Preview a node update.',
    }).proposal!;

    const acceptedCanvas = projectGraphToCanvas(graph, null, emptySelection);
    const proposalCanvas = projectGraphToCanvas(graph, proposal, emptySelection);
    const acceptedNode = acceptedCanvas.nodes.find((node) => node.id === 'diagnostic');
    const proposedNode = proposalCanvas.nodes.find((node) => node.id === 'diagnostic');

    expect(proposedNode?.data.proposalState).toBe('updated');
    expect(proposedNode?.initialWidth).toBe(acceptedNode?.initialWidth);
    expect(proposedNode?.initialHeight).toBe(acceptedNode?.initialHeight);
  });
});
