// @vitest-environment jsdom

import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMemo, useState } from 'react';

import { researchSupervisorGraph, sampleGraph } from '@/src/domain';
import { projectGraphToCanvas } from '@/src/adapters/react-flow/project-graph';
import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import { ScenarioPanel } from '@/src/features/scenarios/scenario-panel';
import { ContractNode } from './contract-node';
import { NodePalette } from './node-palette';
import { SubgraphNode } from './subgraph-node';

const nodeTypes = { contractNode: ContractNode, subgraph: SubgraphNode };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function MountedSubgraphCanvas({
  onSelectionChange,
  onMove,
  onToggle,
}: {
  onSelectionChange: () => void;
  onMove: () => void;
  onToggle: (collapsed: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const nodes = useMemo<CanvasFlowNode[]>(
    () => [
      {
        id: 'review-group',
        type: 'subgraph',
        position: { x: 120, y: 90 },
        width: 640,
        height: 360,
        data: {
          id: 'review-group',
          label: 'Review process',
          position: { x: 120, y: 90 },
          dimensions: { width: 640, height: 360 },
          collapsed,
          collapseEditable: true,
          onToggleCollapse: (_, next) => {
            onToggle(next);
            setCollapsed(next);
          },
        },
      },
    ],
    [collapsed, onToggle],
  );

  return (
    <div style={{ width: 1280, height: 720 }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onSelectionChange={onSelectionChange}
          onMove={onMove}
          nodesDraggable
          panOnDrag={[1]}
        />
      </ReactFlowProvider>
    </div>
  );
}

function InteractiveSubgraphCanvas({ onNodeClick }: { onNodeClick: (id: string) => void }) {
  const nodes = useMemo<CanvasFlowNode[]>(
    () => [
      {
        id: 'review-group',
        type: 'subgraph',
        position: { x: 120, y: 90 },
        width: 640,
        height: 360,
        data: {
          id: 'review-group',
          label: 'Review process',
          position: { x: 120, y: 90 },
          dimensions: { width: 640, height: 360 },
          collapsed: false,
          collapseEditable: true,
        },
      },
      {
        id: 'child-node',
        type: 'contractNode',
        parentId: 'review-group',
        position: { x: 60, y: 120 },
        zIndex: 1,
        data: {
          id: 'child-node',
          kind: 'agent',
          label: 'Child node',
          parentId: 'review-group',
          position: { x: 60, y: 120 },
        },
      },
      {
        id: 'outside-member',
        type: 'contractNode',
        position: { x: 430, y: 240 },
        data: {
          id: 'outside-member',
          kind: 'tool',
          label: 'Outside member',
          position: { x: 430, y: 240 },
          outsideSubgraph: true,
        },
      },
    ],
    [],
  );

  return (
    <div style={{ width: 1280, height: 720 }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onNodeClick(node.id)}
          nodesDraggable
          panOnDrag={[1]}
        />
      </ReactFlowProvider>
    </div>
  );
}

function ResearchSupervisorCanvas() {
  const canvas = useMemo(() => projectGraphToCanvas(researchSupervisorGraph, null), []);

  return (
    <div style={{ width: 1280, height: 720 }}>
      <ReactFlowProvider>
        <ReactFlow nodes={canvas.nodes} edges={canvas.edges} nodeTypes={nodeTypes} />
      </ReactFlowProvider>
    </div>
  );
}

describe('SubgraphNode in React Flow', () => {
  it('renders parented Research Supervisor Start and End handles for canonical boundary edges', async () => {
    render(<ResearchSupervisorCanvas />);

    const entryNode = (await screen.findByText('Research Start')).closest('.react-flow__node');
    const exitNode = screen.getByText('Research Complete').closest('.react-flow__node');

    expect(entryNode?.getAttribute('data-id')).toBe('research-subgraph-start');
    expect(exitNode?.getAttribute('data-id')).toBe('research-subgraph-end');
    expect(entryNode?.querySelector('.react-flow__handle.target')).not.toBeNull();
    expect(exitNode?.querySelector('.react-flow__handle.source')).not.toBeNull();
  });

  it('owns Enter and Space activation without selecting or moving the canvas', async () => {
    const onToggle = vi.fn();
    const onSelectionChange = vi.fn();
    const onMove = vi.fn();
    render(
      <MountedSubgraphCanvas
        onToggle={onToggle}
        onSelectionChange={onSelectionChange}
        onMove={onMove}
      />,
    );

    const button = await waitFor(() =>
      screen.getByRole('button', { name: 'Collapse subgraph Review process' }),
    );
    button.focus();
    const selectionBeforeKeys = onSelectionChange.mock.calls.length;
    const movesBeforeKeys = onMove.mock.calls.length;

    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenLastCalledWith(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.keyDown(button, { key: ' ' });
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenLastCalledWith(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(onSelectionChange).toHaveBeenCalledTimes(selectionBeforeKeys);
    expect(onMove).toHaveBeenCalledTimes(movesBeforeKeys);
  });

  it('keeps child clicks above explicit parent drag surfaces and renders visual-containment status', async () => {
    const onNodeClick = vi.fn();
    render(<InteractiveSubgraphCanvas onNodeClick={onNodeClick} />);

    await screen.findByText('Child node');
    const header = screen.getByText('Review process');
    const boundary = document.querySelector('.subgraph-node-boundary-drag-surface--bottom');

    expect(document.querySelector('.subgraph-node-drag-surface')).not.toBeNull();
    expect(boundary).not.toBeNull();
    expect(screen.getByText('Outside subgraph')).toBeTruthy();

    fireEvent.click(header);
    fireEvent.click(boundary!);
    fireEvent.click(screen.getByText('Child node'));

    expect(onNodeClick.mock.calls.map(([nodeId]) => nodeId)).toEqual([
      'review-group',
      'review-group',
      'child-node',
    ]);
  });

  it('requires a clear confirmation before loading Research Intake Routing', () => {
    const onLoadResearchSupervisorDemo = vi.fn();
    const onLoadResearchIntakeRoutingDemo = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(
      <NodePalette
        graph={sampleGraph}
        proposal={null}
        disabled={false}
        validationIssueCount={0}
        onAdd={vi.fn()}
        onLoadResearchSupervisorDemo={onLoadResearchSupervisorDemo}
        onLoadResearchIntakeRoutingDemo={onLoadResearchIntakeRoutingDemo}
        onCollapse={vi.fn()}
      />,
    );

    const demoButton = screen.getByRole('button', { name: 'Load Research Intake Routing' });
    fireEvent.click(demoButton);
    expect(confirm).toHaveBeenLastCalledWith(
      'Replace the current canvas with Research Intake Routing? This replaces the current workflow; one Undo restores it.',
    );
    expect(onLoadResearchIntakeRoutingDemo).not.toHaveBeenCalled();

    fireEvent.click(demoButton);
    expect(onLoadResearchIntakeRoutingDemo).toHaveBeenCalledOnce();
    expect(onLoadResearchSupervisorDemo).not.toHaveBeenCalled();
  });

  it('prepares native Blob download links and releases their URLs after unmount', () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((() => 'blob:graphcontract-download') as typeof URL.createObjectURL);
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
    const frozenGraph = { ...sampleGraph, status: 'frozen' as const };
    vi.useFakeTimers();
    try {
      const { unmount } = render(<ScenarioPanel graph={frozenGraph} scenarios={[]} />);
      const links = screen.getAllByRole('link', { name: /Download / });

      expect(links).toHaveLength(3);
      expect(createObjectURL).toHaveBeenCalledTimes(3);
      expect(links.map((link) => (link as HTMLAnchorElement).download)).toEqual([
        'graph-contract.json',
        'graph-test-scenarios.json',
        'test_graph_paths.py',
      ]);
      expect(links.every((link) => link.getAttribute('href') === 'blob:graphcontract-download')).toBe(true);

      unmount();
      vi.runOnlyPendingTimers();
      expect(revokeObjectURL).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
