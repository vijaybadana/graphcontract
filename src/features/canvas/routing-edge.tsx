'use client';

import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
  Position,
} from '@xyflow/react';
import {
  GitFork,
  GitBranch,
  Lightning,
  Shield,
  WarningCircle,
} from '@phosphor-icons/react';
import type { CSSProperties } from 'react';

import type {
  CanvasEdgePresentation,
  CanvasNativeEdge,
} from '@/src/adapters/react-flow/project-graph';
import { resolveRoutingEdgePresentation } from './routing-edge-presentation';
import { useCanvasEdgeReviewFocus } from './canvas-review-focus';

import './routing-edge.css';

/** @deprecated import resolveRoutingEdgePresentation from routing-edge-presentation. */
export const routingEdgeTokens = resolveRoutingEdgePresentation;

function cubicPoint(
  start: number,
  controlOne: number,
  controlTwo: number,
  end: number,
  t: number,
) {
  const inverse = 1 - t;
  return inverse ** 3 * start +
    3 * inverse ** 2 * t * controlOne +
    3 * inverse * t ** 2 * controlTwo +
    t ** 3 * end;
}

export function loopPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): [string, number, number] {
  const left = Math.min(sourceX, targetX);
  const right = Math.max(sourceX, targetX);
  const arcHeight = Math.max(76, Math.abs(sourceY - targetY) * 0.55 + 44);
  const controlX = right + Math.max(56, (right - left) * 0.22);
  const controlOneY = sourceY + 22;
  const controlTwoY = targetY - arcHeight;
  // Keep the route pill centered on the actual cubic instead of estimating a
  // point above it. This remains correct when layout direction or span changes.
  const labelT = 0.5;
  const labelX = cubicPoint(sourceX, controlX, controlX, targetX, labelT);
  const labelY = cubicPoint(sourceY, controlOneY, controlTwoY, targetY, labelT);
  return [
    `M ${sourceX},${sourceY} C ${controlX},${controlOneY} ${controlX},${controlTwoY} ${targetX},${targetY}`,
    labelX,
    labelY,
  ];
}

function semanticName(presentation: CanvasEdgePresentation): string {
  if (presentation.loop) return `Loop ${presentation.mode} edge`;
  if (presentation.runtimeInstance) return 'Observed runtime projection link';
  if (presentation.mode === 'send') return 'Send/map edge';
  if (presentation.mode === 'conditional') return 'Conditional edge';
  if (presentation.mode === 'command') return 'Command edge';
  if (presentation.mode === 'fallback') return 'Fallback edge';
  return 'Edge';
}

function provenanceName(presentation: CanvasEdgePresentation): string | undefined {
  // Pre-schema-v6 canvas projections do not carry provenance. Treat them as
  // declared edges so legacy fixtures and persisted workspace previews do not
  // gain a misleading badge or crash while rendering.
  if (!presentation.provenance || presentation.provenance === 'declared') return undefined;
  return presentation.provenance.replace('-', ' ');
}

function proposalDescription(presentation: CanvasEdgePresentation): string | undefined {
  return presentation.proposalState ? `Proposed ${presentation.proposalState}` : undefined;
}

export function RoutingEdge({
  id,
  data,
  label,
  markerEnd,
  selected,
  sourceX,
  sourceY,
  sourcePosition = Position.Right,
  style,
  targetX,
  targetY,
  targetPosition = Position.Left,
  interactionWidth,
}: EdgeProps<CanvasNativeEdge>) {
  const contextReviewFocusState = useCanvasEdgeReviewFocus(data.domainEdgeIds);
  const reviewFocusState = contextReviewFocusState ?? data.reviewFocusState;
  const presentation = data.presentation;
  const [edgePath, labelX, labelY] = presentation.loop
    ? loopPath(sourceX, sourceY, targetX, targetY)
    : getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 16,
        offset: 28,
      });
  const tokens = routingEdgeTokens(presentation);
  const routeLabel = typeof label === 'string' ? label.trim() : '';
  const displayLabel = routeLabel || (presentation.loop ? 'continue' : '');
  const semantic = semanticName(presentation);
  const proposal = proposalDescription(presentation);
  const provenance = provenanceName(presentation);
  const showSourceDot = presentation.mode !== 'normal' && !presentation.loop && !presentation.runtimeInstance;
  const showLabel = Boolean(
    !presentation.runtimeInstance &&
      (displayLabel ||
      presentation.mode !== 'normal' ||
      presentation.invalid ||
      proposal ||
      provenance ||
      data.evidenceMarker),
  );
  const pathStyle = {
    ...style,
    stroke: tokens.color,
    strokeDasharray: tokens.dasharray ?? style?.strokeDasharray,
    '--routing-edge-color': tokens.color,
    '--routing-edge-width': typeof style?.strokeWidth === 'number'
      ? `${style.strokeWidth}px`
      : style?.strokeWidth ?? '1.8px',
  } as CSSProperties;

  return (
    <>
      <path
        d={edgePath}
        className="routing-edge__hover-halo"
        fill="none"
        vectorEffect="non-scaling-stroke"
        aria-hidden="true"
        style={{
          stroke: tokens.haloColor,
          strokeDasharray: tokens.dasharray ?? style?.strokeDasharray,
          strokeWidth: 2.9,
        }}
      />
      {selected && (
        <path
          d={edgePath}
          className="routing-edge__selection-halo"
          fill="none"
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
          style={{
            stroke: 'color-mix(in srgb, var(--gc-focus) 42%, transparent)',
            strokeDasharray: tokens.dasharray ?? style?.strokeDasharray,
            strokeWidth: 3.3,
          }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth ?? 28}
          className={`routing-edge__path routing-edge--${presentation.mode} ${
          presentation.loop ? 'routing-edge--loop' : ''
        } ${presentation.invalid ? 'routing-edge--invalid' : ''} ${proposal ? `routing-edge--proposal-${presentation.proposalState}` : ''} ${reviewFocusState ? `proposal-focus-${reviewFocusState}` : ''} provenance--${presentation.provenance}`}
        style={pathStyle}
      />
      {presentation.scenarioState === 'active' && (
        <path
          d={edgePath}
          className="routing-edge__scenario-motion"
          fill="none"
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
          style={{ stroke: tokens.color }}
        />
      )}
      {showSourceDot && (
        <circle
          className="routing-edge__branch-dot"
          cx={sourceX}
          cy={sourceY}
          r="4"
          fill={tokens.color}
          aria-hidden="true"
        />
      )}
      {(showLabel || data.evidenceMarker) && (
        <EdgeLabelRenderer>
          <div
            className={`routing-edge-label routing-edge-label--${presentation.mode} ${
              presentation.loop ? 'routing-edge-label--loop' : ''
            } ${presentation.invalid ? 'routing-edge-label--invalid' : ''} ${
              presentation.scenarioState ? `scenario-state--${presentation.scenarioState}` : ''} ${
              reviewFocusState ? `proposal-focus-${reviewFocusState}` : ''}`}
            data-review-focus={reviewFocusState}
            data-edge-id={id}
            data-mode={presentation.mode}
            data-loop={presentation.loop || undefined}
            data-invalid={presentation.invalid || undefined}
            data-proposal-state={presentation.proposalState}
            data-provenance={presentation.provenance}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            aria-label={[
              semantic,
              displayLabel ? `route ${displayLabel}` : undefined,
              presentation.invalid ? 'invalid' : undefined,
              proposal,
              provenance,
            ]
              .filter(Boolean)
              .join(', ')}
          >
            <span className="routing-edge-label__surface">
              {presentation.mode === 'conditional' && (
                <GitBranch size={13} weight="bold" aria-hidden="true" />
              )}
              {presentation.mode === 'send' && (
                <GitFork size={14} weight="bold" aria-hidden="true" />
              )}
              {presentation.mode === 'command' && (
                <span className="routing-edge-label__icon-chip" title="Command route">
                  <Lightning size={15} weight="fill" aria-hidden="true" />
                </span>
              )}
              {presentation.mode === 'fallback' && (
                <Shield size={14} weight="bold" aria-hidden="true" />
              )}
              {presentation.invalid && (
                <WarningCircle size={15} weight="fill" aria-hidden="true" />
              )}
              <span className="routing-edge-label__text">{displayLabel || semantic}</span>
              {presentation.loop && <span className="routing-edge-label__cue">Loop</span>}
              {proposal && <span className="routing-edge-label__proposal">{proposal}</span>}
              {provenance && <span className="routing-edge-label__provenance">{provenance}</span>}
              {presentation.invalid && <span className="routing-edge-label__state">Invalid</span>}
              {data.evidenceMarker && (
                <button
                  type="button"
                  className="routing-edge-label__evidence-marker nodrag nopan"
                  aria-label={`Evidence marker ${data.evidenceMarker} for ${displayLabel || semantic}. Open evidence details.`}
                  onClick={(event) => {
                    event.stopPropagation();
                    data.onEvidenceActivate?.(id);
                  }}
                >
                  {data.evidenceMarker}
                </button>
              )}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
