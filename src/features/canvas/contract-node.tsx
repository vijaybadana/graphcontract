'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import {
  Flag,
  HandPalm,
  Lightning,
  Play,
  Robot,
  Wrench,
} from '@phosphor-icons/react';

import { GraphNode } from '@/src/domain';
import './contract-node.css';

export type ContractNodeData = GraphNode & {
  [key: string]: unknown;
  proposalState?: 'added' | 'updated' | 'removed';
  /** Projection-only warning for a node visually inside, but not assigned to, a subgraph. */
  outsideSubgraph?: boolean;
};

export type ContractFlowNode = Node<ContractNodeData, 'contractNode'>;

const kindLabel: Record<GraphNode['kind'], string> = {
  start: 'Start',
  agent: 'Agent',
  action: 'Action',
  tool: 'Tool',
  human_input: 'Human input',
  end: 'End',
};

function nodeKindBadge(node: GraphNode): string {
  // The existing kind/config seam already expresses the Supervisor's intent;
  // keep it compact instead of introducing a second taxonomy.
  if (node.kind === 'agent' && node.config?.capability === 'ai') return 'AI';
  return kindLabel[node.kind];
}

function NodeKindIcon({ kind }: { kind: GraphNode['kind'] }) {
  const iconProps = { 'aria-hidden': true, size: 17, weight: 'bold' as const };

  switch (kind) {
    case 'start':
      return <Play {...iconProps} />;
    case 'agent':
      return <Robot {...iconProps} />;
    case 'action':
      return <Lightning {...iconProps} />;
    case 'tool':
      return <Wrench {...iconProps} />;
    case 'human_input':
      return <HandPalm {...iconProps} />;
    case 'end':
      return <Flag {...iconProps} />;
  }
}

export function ContractNode({ data, selected }: NodeProps<ContractFlowNode>) {
  const proposalClass = data.proposalState ? `is-proposed-${data.proposalState}` : '';
  // Outer Start/End nodes remain terminal at the canvas boundary. Their
  // parented counterparts are subgraph ingress/egress endpoints, so React
  // Flow needs the otherwise-suppressed handle for their canonical boundary
  // edges to attach.
  const rendersTargetHandle = data.kind !== 'start' || Boolean(data.parentId);
  const rendersSourceHandle = data.kind !== 'end' || Boolean(data.parentId);

  return (
    <div
      data-kind={data.kind}
      className={`contract-node-shell ${selected ? 'is-selected' : ''} ${proposalClass}`}
    >
        {rendersTargetHandle && (
          <Handle
            type="target"
            position={Position.Left}
            className="contract-node-handle"
          />
        )}
        <div className="contract-node-heading">
          <span className="contract-node-icon-slot">
            <NodeKindIcon kind={data.kind} />
          </span>
          <div className="contract-node-title-group">
            <p className="contract-node-kind">{kindLabel[data.kind]}</p>
            <p className="contract-node-title">{data.label}</p>
          </div>
        </div>
        <div className="contract-node-divider" />
        <div className="contract-node-meta" aria-label="Node status">
          <span className="contract-node-kind-badge">{nodeKindBadge(data)}</span>
          <div className="contract-node-statuses">
            {data.proposalState && (
              <span className="contract-node-proposal-status">
                Proposed {data.proposalState}
              </span>
            )}
            {data.hitl?.enabled && (
              <span
                title={`Human input ${data.hitl.timing ?? 'before'} · ${data.hitl.inputType ?? 'approval'}`}
                className="contract-node-hitl-status"
              >
                HITL
              </span>
            )}
            {data.outsideSubgraph && (
              <span className="contract-node-membership-status">Outside subgraph</span>
            )}
          </div>
        </div>
        {rendersSourceHandle && (
          <Handle
            type="source"
            position={Position.Right}
            className="contract-node-handle"
          />
        )}
    </div>
  );
}
