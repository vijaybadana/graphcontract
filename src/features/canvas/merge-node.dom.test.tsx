// @vitest-environment jsdom

import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MergeFlowNode, MergeNode } from './merge-node';

afterEach(() => cleanup());

describe('MergeNode evidence overlay', () => {
  it('renders the same accessible projection-only evidence marker as a contract node', async () => {
    const onEvidenceActivate = vi.fn();
    const nodes: MergeFlowNode[] = [{
      id: 'merge-evidence',
      type: 'mergeJunction',
      position: { x: 120, y: 80 },
      data: {
        id: 'merge-evidence',
        kind: 'merge',
        label: 'Merge evidence',
        merge: {
          reducer: { name: 'append', aggregateState: 'evidence' },
          completion: { mode: 'all' },
          continuation: { mode: 'once' },
          waitingForDynamicInputs: true,
        },
        provenance: {
          representation: 'derived-semantic',
          evidence: {
            source: 'merge contract',
            evidenceClass: 'Semantic inference',
            confidence: 'high',
          },
        },
        evidenceMarker: 3,
        onEvidenceActivate,
      },
    }];

    render(
      <div style={{ width: 720, height: 360 }}>
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={[]} nodeTypes={{ mergeJunction: MergeNode }} />
        </ReactFlowProvider>
      </div>,
    );

    const marker = document.querySelector<HTMLButtonElement>(
      '[aria-label="Evidence marker 3 for Merge evidence. Open evidence details."]',
    );
    expect(marker).toBeTruthy();
    expect(marker?.classList.contains('merge-node-evidence-marker')).toBe(true);
    fireEvent.click(marker!);
    expect(onEvidenceActivate).toHaveBeenCalledWith('merge-evidence');
  });
});
