'use client';

import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, Position } from '@xyflow/react';
import { ArrowsOutCardinalIcon, PathIcon, PlugsConnectedIcon } from '@phosphor-icons/react';

import type { CanvasSystemRelationshipEdge } from '@/src/adapters/react-flow/project-graph';

import './system-relationship-edge.css';

const relationshipLabel = (kind: CanvasSystemRelationshipEdge['data']['relationship']['kind']) =>
  kind === 'spawned-run'
    ? 'Spawned run'
    : kind === 'spawned-thread'
      ? 'Spawned thread'
      : 'External orchestration';

export function SystemRelationshipEdge({
  id,
  data,
  label,
  selected,
  sourceX,
  sourceY,
  sourcePosition = Position.Right,
  targetX,
  targetY,
  targetPosition = Position.Left,
  markerEnd,
  interactionWidth,
}: EdgeProps<CanvasSystemRelationshipEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
    offset: 34,
  });
  const relationship = data.relationship;
  const external = relationship.kind === 'external-orchestration';
  const readableLabel =
    (typeof label === 'string' && label.trim()) || relationship.label?.trim() || relationshipLabel(relationship.kind);
  const marker = data.evidenceMarker;

  return (
    <>
      {selected && <BaseEdge path={edgePath} className="system-relationship-edge__halo" style={{ strokeWidth: 10 }} />}
      {!external && <BaseEdge path={edgePath} className="system-relationship-edge__portal-back" style={{ strokeWidth: 7 }} />}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth ?? 34}
        className={`system-relationship-edge__path ${external ? 'is-external' : 'is-spawned'}`}
      />
      <EdgeLabelRenderer>
        <div
          className={`system-relationship-edge__label ${external ? 'is-external' : 'is-spawned'}`}
          data-system-relationship-id={relationship.id}
          data-relationship-kind={relationship.kind}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          aria-label={`${relationshipLabel(relationship.kind)}: ${readableLabel}. Not a native control edge.`}
        >
          {external ? <ArrowsOutCardinalIcon aria-hidden="true" size={14} weight="bold" /> : <PlugsConnectedIcon aria-hidden="true" size={15} weight="bold" />}
          <span>{readableLabel}</span>
          {!external && <PathIcon className="system-relationship-edge__portal-icon" aria-hidden="true" size={14} weight="bold" />}
          {marker && (
            <button
              type="button"
              className="system-relationship-edge__evidence-marker nodrag nopan"
              aria-label={`Evidence marker ${marker} for ${readableLabel}. Open evidence details.`}
              onClick={(event) => {
                event.stopPropagation();
                data.onEvidenceActivate?.(relationship.id);
              }}
            >
              {marker}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
