'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { ArrowsInIcon, ClockCountdownIcon, WarningCircleIcon } from '@phosphor-icons/react';

import './merge-node.css';
import './node-boundary.css';
import type { Provenance } from '@/src/domain';
import {
  CANVAS_INPUT_PORT_ID,
  CANVAS_OUTPUT_PORT_ID,
} from '@/src/application/layout-workflow';
import { useCanvasNodeReviewFocus } from './canvas-review-focus';

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

export function MergeNode({ data, id, selected }: NodeProps<MergeFlowNode>) {
  const reviewFocusState = useCanvasNodeReviewFocus(id);
  const reducer = data.merge?.reducer;
  const proposal = data.proposalState ? `Proposed ${data.proposalState}` : undefined;

  return (
    <div
      className={`merge-node-shell ${selected || reviewFocusState === 'active' ? 'is-selected' : ''} ${data.invalid ? 'is-invalid' : ''} ${proposal ? `is-proposed-${data.proposalState}` : ''} ${reviewFocusState ? `proposal-focus-${reviewFocusState}` : ''}`}
      data-kind="merge"
      data-invalid={data.invalid || undefined}
      data-proposal-state={data.proposalState}
    >
      <Handle id={CANVAS_INPUT_PORT_ID} type="target" position={Position.Left} className="merge-node-handle" />
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
      </footer>
      <Handle id={CANVAS_OUTPUT_PORT_ID} type="source" position={Position.Right} className="merge-node-handle" />
    </div>
  );
}
