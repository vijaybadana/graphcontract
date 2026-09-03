'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { ArrowsInIcon, ClockCountdownIcon, LockSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react';

import './merge-node.css';
import './node-boundary.css';
import type { Provenance } from '@/src/domain';

/**
 * Merge remains a structural canvas element. Keeping its data shape local to
 * the renderer lets the React Flow projection remain presentation-only while
 * the domain owns the persisted Merge contract.
 */
export type MergeNodeData = {
  id: string;
  kind: 'merge';
  label: string;
  description?: string;
  merge?: {
    reducer: { name: string; aggregateState: string };
    completion: { mode: 'all' | 'any' | 'quorum'; quorum?: number };
    continuation: { mode: 'once' | 'per_batch' };
    waitingForDynamicInputs: true;
  };
  proposalState?: 'added' | 'updated' | 'removed';
  invalid?: boolean;
  frozen?: boolean;
  /** Evidence remains an optional projection-only workspace overlay. */
  provenance?: Provenance;
  evidenceMarker?: number;
  onEvidenceActivate?: (nodeId: string) => void;
  [key: string]: unknown;
};

export type MergeFlowNode = Node<MergeNodeData, 'mergeJunction'>;

const completionLabel = (data: MergeNodeData) => {
  const completion = data.merge?.completion;
  if (!completion) return 'Completion needs configuration';
  if (completion.mode === 'quorum') return `Quorum${completion.quorum ? ` · ${completion.quorum}` : ''}`;
  return completion.mode === 'all' ? 'All inputs' : 'Any input';
};

export function MergeNode({ data, selected }: NodeProps<MergeFlowNode>) {
  const reducer = data.merge?.reducer;
  const proposal = data.proposalState ? `Proposed ${data.proposalState}` : undefined;

  return (
    <div
      className={`merge-node-shell ${selected ? 'is-selected' : ''} ${data.invalid ? 'is-invalid' : ''} ${
        data.frozen ? 'is-frozen' : ''
      } ${proposal ? `is-proposed-${data.proposalState}` : ''}`}
      data-kind="merge"
      data-invalid={data.invalid || undefined}
      data-frozen={data.frozen || undefined}
      data-proposal-state={data.proposalState}
    >
      <Handle type="target" position={Position.Left} className="merge-node-handle" />
      <header className="merge-node-heading">
        <span className="merge-node-icon" aria-hidden="true">
          <ArrowsInIcon size={20} weight="bold" />
        </span>
        <span>
          <span className="merge-node-kind">Merge</span>
          <strong className="merge-node-title">{data.label}</strong>
        </span>
      </header>
      {data.evidenceMarker && (
        <button
          type="button"
          className="merge-node-evidence-marker nodrag nopan"
          aria-label={`Evidence marker ${data.evidenceMarker} for ${data.label}. Open evidence details.`}
          onClick={() => data.onEvidenceActivate?.(data.id)}
        >
          {data.evidenceMarker}
        </button>
      )}
      <div className="merge-node-details">
        <span className="merge-node-detail">
          <ClockCountdownIcon size={13} weight="bold" aria-hidden="true" />
          {completionLabel(data)}
        </span>
        <span className="merge-node-detail">
          Reducer · {reducer?.name || 'Unset'}
        </span>
        {reducer?.aggregateState && <span className="merge-node-state">{reducer.aggregateState}</span>}
      </div>
      <footer className="merge-node-statuses">
        <span>Waits for dynamic inputs</span>
        {data.invalid && <WarningCircleIcon size={14} weight="fill" aria-label="Invalid Merge" />}
        {data.frozen && <LockSimpleIcon size={14} weight="bold" aria-label="Frozen Merge" />}
      </footer>
      <Handle type="source" position={Position.Right} className="merge-node-handle" />
    </div>
  );
}
