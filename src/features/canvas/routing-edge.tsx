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
  LockSimple,
  Shield,
  WarningCircle,
} from '@phosphor-icons/react';

import type {
  CanvasEdgePresentation,
  CanvasFlowEdge,
} from '@/src/adapters/react-flow/project-graph';

import './routing-edge.css';

type RoutingEdgeTokens = {
  color: string;
  haloColor: string;
  dasharray?: string;
};

/** Exported for focused component coverage and to keep state precedence explicit. */
export function routingEdgeTokens(presentation: CanvasEdgePresentation): RoutingEdgeTokens {
  if (presentation.runtimeInstance) {
    return { color: '#5969c8', haloColor: 'rgb(89 105 200 / 25%)', dasharray: '4 4' };
  }
  if (presentation.frozen) {
    return { color: '#9ca3af', haloColor: 'rgb(156 163 175 / 30%)', dasharray: '5 5' };
  }
  if (presentation.invalid) {
    return { color: '#e0353d', haloColor: 'rgb(224 53 61 / 30%)', dasharray: '4 3' };
  }
  if (presentation.loop) {
    return { color: '#ea6a18', haloColor: 'rgb(234 106 24 / 28%)' };
  }
  if (presentation.mode === 'command') {
    return { color: '#3346c8', haloColor: 'rgb(51 70 200 / 28%)', dasharray: '7 5' };
  }
  if (presentation.mode === 'conditional') {
    return { color: '#7136cc', haloColor: 'rgb(113 54 204 / 28%)' };
  }
  if (presentation.mode === 'fallback') {
    return { color: '#8b55d8', haloColor: 'rgb(139 85 216 / 28%)', dasharray: '6 5' };
  }
  if (presentation.proposalState === 'added') {
    return { color: '#159160', haloColor: 'rgb(21 145 96 / 28%)' };
  }
  if (presentation.proposalState === 'updated') {
    return { color: '#c47b24', haloColor: 'rgb(196 123 36 / 28%)' };
  }
  if (presentation.proposalState === 'removed') {
    return { color: '#db4b55', haloColor: 'rgb(219 75 85 / 28%)', dasharray: '6 5' };
  }
  return { color: '#303a35', haloColor: 'rgb(37 99 235 / 30%)' };
}

function loopPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): [string, number, number] {
  const left = Math.min(sourceX, targetX);
  const right = Math.max(sourceX, targetX);
  const arcHeight = Math.max(76, Math.abs(sourceY - targetY) * 0.55 + 44);
  const controlX = right + Math.max(56, (right - left) * 0.22);
  const labelX = (sourceX + targetX) / 2 + Math.max(26, (right - left) * 0.1);
  const labelY = Math.min(sourceY, targetY) - arcHeight * 0.58;
  return [
    `M ${sourceX},${sourceY} C ${controlX},${sourceY + 22} ${controlX},${targetY - arcHeight} ${targetX},${targetY}`,
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
}: EdgeProps<CanvasFlowEdge>) {
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
  const showSourceDot = presentation.mode !== 'normal' && !presentation.loop && !presentation.runtimeInstance;
  const showLabel = Boolean(
    !presentation.runtimeInstance &&
      (displayLabel ||
      presentation.mode !== 'normal' ||
      presentation.invalid ||
      presentation.frozen ||
      proposal),
  );
  const pathStyle = {
    ...style,
    stroke: tokens.color,
    strokeDasharray: tokens.dasharray ?? style?.strokeDasharray,
  };

  return (
    <>
      {selected && (
        <BaseEdge
          path={edgePath}
          className="routing-edge__selection-halo"
          style={{ stroke: tokens.haloColor, strokeWidth: 8 }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth ?? 28}
        className={`routing-edge__path routing-edge--${presentation.mode} ${
          presentation.loop ? 'routing-edge--loop' : ''
        } ${presentation.invalid ? 'routing-edge--invalid' : ''} ${
          presentation.frozen ? 'routing-edge--frozen' : ''
        } ${proposal ? `routing-edge--proposal-${presentation.proposalState}` : ''}`}
        style={pathStyle}
      />
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
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className={`routing-edge-label routing-edge-label--${presentation.mode} ${
              presentation.loop ? 'routing-edge-label--loop' : ''
            } ${presentation.invalid ? 'routing-edge-label--invalid' : ''} ${
              presentation.frozen ? 'routing-edge-label--frozen' : ''}`}
            data-edge-id={id}
            data-mode={presentation.mode}
            data-loop={presentation.loop || undefined}
            data-invalid={presentation.invalid || undefined}
            data-frozen={presentation.frozen || undefined}
            data-proposal-state={presentation.proposalState}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            aria-label={[
              semantic,
              displayLabel ? `route ${displayLabel}` : undefined,
              presentation.invalid ? 'invalid' : undefined,
              presentation.frozen ? 'frozen' : undefined,
              proposal,
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
              {presentation.frozen && (
                <LockSimple size={14} weight="bold" aria-hidden="true" />
              )}
              <span className="routing-edge-label__text">{displayLabel || semantic}</span>
              {presentation.loop && <span className="routing-edge-label__cue">Loop</span>}
              {proposal && <span className="routing-edge-label__proposal">{proposal}</span>}
              {presentation.invalid && <span className="routing-edge-label__state">Invalid</span>}
              {presentation.frozen && <span className="routing-edge-label__state">Frozen</span>}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
