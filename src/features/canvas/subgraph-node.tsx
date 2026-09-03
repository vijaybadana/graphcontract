'use client';

import {
  Handle,
  Node,
  NodeProps,
  NodeResizeControl,
  Position,
  ResizeControlVariant,
} from '@xyflow/react';
import { useCallback, type KeyboardEvent, type PointerEvent } from 'react';

import { EffectiveGraphCapabilities, GraphSubgraph } from '@/src/domain';
import {
  CANVAS_INPUT_PORT_ID,
  CANVAS_OUTPUT_PORT_ID,
} from '@/src/application/layout-workflow';
import {
  constrainSubgraphDimensions,
  type SubgraphResizeLimits,
} from '@/src/application/subgraph-resize';
import { useCanvasNodeReviewFocus } from './canvas-review-focus';
import './subgraph-node.css';
import './node-boundary.css';

export type SubgraphNodeData = GraphSubgraph & {
  /** Effective scope is projection data; canonical capability ownership stays on the graph. */
  durability?: Pick<EffectiveGraphCapabilities, 'state' | 'checkpointer' | 'store'>;
  /** Review-only state projected from a pending graph proposal. */
  proposalState?: 'added' | 'updated' | 'removed';
  /**
   * The canvas projection accepts this callback without owning the workspace
   * mutation. The workspace seam supplies it when subgraph editing is wired.
   */
  onToggleCollapse?: (subgraphId: string, collapsed: boolean) => void;
  /** Shared application constraints for the bottom-right canvas resize seam. */
  resizeLimits?: SubgraphResizeLimits;
  onResize?: (subgraphId: string, dimensions: GraphSubgraph['dimensions']) => void;
  /** Projection-only edit affordance; it never belongs to the canonical graph. */
  collapseEditable?: boolean;
  [key: string]: unknown;
};

export type SubgraphFlowNode = Node<SubgraphNodeData, 'subgraph'>;

export function SubgraphNode({ data, id, selected }: NodeProps<SubgraphFlowNode>) {
  const reviewFocusState = useCanvasNodeReviewFocus(id);
  const resizeLimits = data.resizeLimits;
  const onResize = data.onResize;
  const subgraphId = data.id;
  const action = data.collapsed ? 'Expand' : 'Collapse';
  const proposalClass = data.proposalState ? `is-proposed-${data.proposalState}` : '';
  const removed = data.proposalState === 'removed';
  const toggleCollapse = () => data.onToggleCollapse?.(data.id, !data.collapsed);
  const constrainedResize = useCallback(
    (dimensions: GraphSubgraph['dimensions']) =>
      resizeLimits
        ? constrainSubgraphDimensions(dimensions, resizeLimits)
        : dimensions,
    [resizeLimits],
  );
  const allowResize = useCallback(
    (_: unknown, dimensions: GraphSubgraph['dimensions']) => {
      const constrained = constrainedResize(dimensions);
      return constrained.width === dimensions.width && constrained.height === dimensions.height;
    },
    [constrainedResize],
  );
  const finishResize = useCallback(
    (_: unknown, dimensions: GraphSubgraph['dimensions']) => {
      onResize?.(subgraphId, constrainedResize(dimensions));
    },
    [constrainedResize, onResize, subgraphId],
  );
  const stopCanvasPointer = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const handleToggleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    // React Flow also listens for keyboard interaction on its node wrapper.
    // Own these activation keys at the native button so one press cannot both
    // toggle the canonical state and select/pan the canvas.
    event.preventDefault();
    event.stopPropagation();
    toggleCollapse();
  };
  const durabilityCues = data.durability
    ? [
        {
          id: 'state',
          label: 'State',
          status: data.durability.state.value.enabled
            ? `${data.durability.state.value.schema.fields.length} fields`
            : 'off',
          source: data.durability.state.source,
        },
        {
          id: 'checkpoint',
          label: 'Checkpoint',
          status: data.durability.checkpointer.value.enabled ? 'on' : 'off',
          source: data.durability.checkpointer.source,
        },
        {
          id: 'store',
          label: 'Store',
          status: data.durability.store.value.available ? 'available' : 'off',
          source: data.durability.store.source,
        },
      ] as const
    : [];

  return (
    <div
      className={`subgraph-node-shell ${data.collapsed ? 'is-collapsed subgraph-node-drag-surface' : 'is-expanded'} ${selected || reviewFocusState === 'active' ? 'is-selected' : ''} ${proposalClass} ${reviewFocusState ? `proposal-focus-${reviewFocusState}` : ''}`}
      data-collapsed={data.collapsed}
      data-proposal-state={data.proposalState}
    >
      {selected && data.collapseEditable && !data.collapsed && resizeLimits && (
        <NodeResizeControl
          position="bottom-right"
          variant={ResizeControlVariant.Handle}
          minWidth={resizeLimits.minWidth}
          minHeight={resizeLimits.minHeight}
          maxWidth={resizeLimits.maxWidth}
          maxHeight={resizeLimits.maxHeight}
          shouldResize={allowResize}
          onResizeEnd={finishResize}
          className="subgraph-node-resize-control nodrag nopan"
        >
          <span aria-hidden="true" />
        </NodeResizeControl>
      )}
      {!removed && (
        <Handle
          type="target"
          id={CANVAS_INPUT_PORT_ID}
          position={Position.Left}
          className="subgraph-node-handle"
        />
      )}
      {!data.collapsed && (
        <div className="subgraph-node-body-drag-surface subgraph-node-drag-surface" aria-hidden="true" />
      )}
      <div className="subgraph-node-header subgraph-node-drag-surface">
        <div className="subgraph-node-heading">
          <span className="subgraph-node-indicator">Subgraph</span>
          <p className="subgraph-node-title">{data.label}</p>
          {durabilityCues.length > 0 && (
            <ul className="subgraph-node-capabilities" aria-label="Effective durability capabilities">
              {durabilityCues.map((cue) => (
                <li key={cue.id} data-source={cue.source}>
                  <strong>{cue.label}</strong>
                  <span>{cue.status} · {cue.source === 'overridden' ? 'override' : 'inherits'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className="subgraph-node-toggle nodrag nopan"
          disabled={removed || !data.collapseEditable}
          aria-expanded={!data.collapsed}
          aria-label={`${action} subgraph ${data.label}`}
          onPointerDownCapture={stopCanvasPointer}
          onKeyDownCapture={handleToggleKey}
          onClick={(event) => {
            event.stopPropagation();
            toggleCollapse();
          }}
        >
          {action}
        </button>
      </div>
      {!data.collapsed && (
        <p className="subgraph-node-description">Container for related workflow steps</p>
      )}
      {!removed && (
        <Handle
          type="source"
          id={CANVAS_OUTPUT_PORT_ID}
          position={Position.Right}
          className="subgraph-node-handle"
        />
      )}
    </div>
  );
}
