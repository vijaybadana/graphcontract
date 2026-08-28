'use client';

import { NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import type { PointerEvent } from 'react';

import { GraphNode } from '@/src/domain';
import { useGraphStore } from '@/src/state/workspace-store';
import type { ContractFlowNode } from './contract-node';

const hitlKinds = new Set<GraphNode['kind']>(['agent', 'action', 'tool']);

export function ContractNodeToolbar({ node, selected }: { node: GraphNode; selected: boolean }) {
  const graphStatus = useGraphStore((state) => state.graph.status);
  const proposal = useGraphStore((state) => state.proposal);
  const selectedNodeCount = useGraphStore((state) => state.selection.nodeIds.length);
  const duplicateSelection = useGraphStore((state) => state.duplicateSelection);
  const deleteSelection = useGraphStore((state) => state.deleteSelection);
  const updateNode = useGraphStore((state) => state.updateNode);
  const { fitView } = useReactFlow<ContractFlowNode>();
  const visible = selected && selectedNodeCount === 1 && graphStatus === 'draft' && !proposal;

  const stopPointer = (event: PointerEvent) => event.stopPropagation();
  return (
    <NodeToolbar
      nodeId={node.id}
      isVisible={visible}
      position={Position.Top}
      offset={12}
      className="node-action-toolbar nodrag nopan"
    >
      <button
        type="button"
        onPointerDown={stopPointer}
        onClick={() => void fitView({ nodes: [{ id: node.id }], duration: 180, padding: 1.4 })}
      >
        Focus
      </button>
      <button type="button" onPointerDown={stopPointer} onClick={duplicateSelection}>
        Duplicate
      </button>
      {hitlKinds.has(node.kind) && (
        <button
          type="button"
          onPointerDown={stopPointer}
          onClick={() =>
            updateNode(node.id, {
              hitl: {
                ...node.hitl,
                enabled: !node.hitl?.enabled,
                timing: node.hitl?.timing ?? 'before',
                inputType: node.hitl?.inputType ?? 'approval',
              },
            })
          }
        >
          {node.hitl?.enabled ? 'Disable HITL' : 'Add HITL'}
        </button>
      )}
      <button type="button" onPointerDown={stopPointer} onClick={deleteSelection} className="danger">
        Delete
      </button>
    </NodeToolbar>
  );
}
