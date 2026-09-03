'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import {
  ArrowsClockwiseIcon,
  CubeIcon,
  DatabaseIcon,
  LockSimpleIcon,
  PauseCircleIcon,
  RobotIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import { type Ref, useId, useRef, useState } from 'react';

import { GraphNode } from '@/src/domain';
import {
  type CanvasReviewFocusState,
  useCanvasNodeReviewFocus,
} from './canvas-review-focus';
import { graphNodeVisualKind, NodeVisualIcon, nodeVisualLabels } from './node-visual-taxonomy';
import './contract-node.css';
import './node-boundary.css';

export type StepModifierInspectorSection =
  | 'executor'
  | 'participation'
  | 'hitl'
  | 'sensitive'
  | 'storeAccess'
  | 'retry'
  | 'modifiers';

/** Stable presentation metadata for the Package 1 inspector seam. */
export type StepModifierPresentation = {
  id:
    | 'executor'
    | 'internalTools'
    | 'hitl'
    | 'guardrail'
    | 'sensitive'
    | 'storeRead'
    | 'storeWrite'
    | 'retryFallback'
    | 'opaque'
    | 'readiness';
  label: string;
  accessibleLabel: string;
  tone:
    | 'ai'
    | 'tool'
    | 'human'
    | 'guardrail'
    | 'sensitive'
    | 'store'
    | 'retry'
    | 'opaque'
    | 'readiness';
  inspectorSection: StepModifierInspectorSection;
};

export type ContractNodeData = GraphNode & {
  [key: string]: unknown;
  /** Review-only state projected from a pending graph proposal. */
  proposalState?: 'added' | 'updated' | 'removed';
  /** Projection-only validation state; canonical issues remain domain-owned. */
  invalid?: boolean;
  /** Projection-only frozen presentation; editing authority remains workspace-owned. */
  frozen?: boolean;
  /** Projection-only warning for a node visually inside, but not assigned to, a subgraph. */
  outsideSubgraph?: boolean;
  /** Optional evidence marker; visibility and focus stay in workspace UI state. */
  evidenceMarker?: number;
  onEvidenceActivate?: (nodeId: string) => void;
  /** A canonical Step is the single design-time worker template for Send/map. */
  sendTemplate?: {
    edgeId: string;
    payloadLabel: string;
    mergeNodeId: string;
  };
  /**
   * The projection publishes an inspector target without owning navigation or
   * mutation. Package 1 integration can attach the corresponding focus path.
   */
  onModifierActivate?: (
    nodeId: string,
    modifier: StepModifierPresentation,
  ) => void;
};

export type ContractFlowNode = Node<ContractNodeData, 'contractNode'>;

function executorPresentation(
  node: Extract<GraphNode, { kind: 'step' }>,
): StepModifierPresentation | null {
  switch (node.executor) {
    case 'ai':
      return {
        id: 'executor',
        label: 'AI',
        accessibleLabel: 'AI executor',
        tone: 'ai',
        inspectorSection: 'executor',
      };
    case 'tool':
      return {
        id: 'executor',
        label: 'Tool',
        accessibleLabel: 'Tool executor',
        tone: 'tool',
        inspectorSection: 'executor',
      };
    case 'human':
      return {
        id: 'executor',
        label: 'Human',
        accessibleLabel: 'Human executor',
        tone: 'human',
        inspectorSection: 'executor',
      };
    // Deterministic work is the unmodified Step baseline, not a badge.
    case 'deterministic':
      return null;
  }
}

/**
 * Returns semantic Step presentation in a stable order. Proposal state is
 * deliberately absent: review diffs are an independent canvas overlay.
 */
export function stepModifierPresentations(
  node: Extract<GraphNode, { kind: 'step' }>,
): StepModifierPresentation[] {
  const executor = executorPresentation(node);
  const modifiers: StepModifierPresentation[] = executor ? [executor] : [];

  if (node.participation?.internalTools) {
    modifiers.push({
      id: 'internalTools',
      label: 'Tools',
      accessibleLabel: 'Internal tools',
      tone: 'tool',
      inspectorSection: 'participation',
    });
  }
  if (node.hitl?.enabled) {
    modifiers.push({
      id: 'hitl',
      label: 'HITL',
      accessibleLabel: `Human-in-the-loop gate, ${node.hitl.timing ?? 'before'} execution`,
      tone: 'human',
      inspectorSection: 'hitl',
    });
  }
  if (node.modifiers?.guardrail) {
    modifiers.push({
      id: 'guardrail',
      label: 'Guard',
      accessibleLabel: 'Guardrail',
      tone: 'guardrail',
      inspectorSection: 'modifiers',
    });
  }
  if (node.sensitive) {
    modifiers.push({
      id: 'sensitive',
      label: 'Sensitive',
      accessibleLabel: 'Sensitive effect policy',
      tone: 'sensitive',
      inspectorSection: 'sensitive',
    });
  }
  if (node.storeAccess?.read || node.modifiers?.storeRead) {
    modifiers.push({
      id: 'storeRead',
      label: 'Store R',
      accessibleLabel: 'Store read',
      tone: 'store',
      inspectorSection: 'storeAccess',
    });
  }
  if (node.storeAccess?.write || node.modifiers?.storeWrite) {
    modifiers.push({
      id: 'storeWrite',
      label: 'Store W',
      accessibleLabel: 'Store write',
      tone: 'store',
      inspectorSection: 'storeAccess',
    });
  }
  if (node.retry || node.modifiers?.retryFallback) {
    modifiers.push({
      id: 'retryFallback',
      label: 'Retry',
      accessibleLabel: 'Internal retry policy',
      tone: 'retry',
      inspectorSection: 'retry',
    });
  }
  // Opaque is canonical Step interface metadata. A legacy modifier flag is
  // deliberately not enough to render an Opaque badge: that would imply an
  // interface exists when the contract has not actually declared one.
  if (node.opaque) {
    modifiers.push({
      id: 'opaque',
      label: 'Opaque',
      accessibleLabel: 'Opaque or prebuilt',
      tone: 'opaque',
      inspectorSection: 'modifiers',
    });
  }
  const readiness = node.readiness?.state ?? node.modifiers?.readiness;
  if (readiness && readiness !== 'ready') {
    const label = readiness === 'degraded' ? 'Degraded' : 'Unimplemented';
    modifiers.push({
      id: 'readiness',
      label,
      accessibleLabel: `${label} readiness`,
      tone: 'readiness',
      inspectorSection: 'modifiers',
    });
  }

  return modifiers;
}

function ModifierIcon({ modifier }: { modifier: StepModifierPresentation }) {
  const iconProps = { 'aria-hidden': true, size: 12, weight: 'bold' as const };
  switch (modifier.id) {
    case 'executor':
      if (modifier.tone === 'ai') return <RobotIcon {...iconProps} />;
      if (modifier.tone === 'tool') return <WrenchIcon {...iconProps} />;
      return <NodeVisualIcon kind="human" size={12} weight="bold" />;
    case 'internalTools': return <WrenchIcon {...iconProps} />;
    case 'hitl': return <PauseCircleIcon {...iconProps} />;
    case 'guardrail': return <ShieldCheckIcon {...iconProps} />;
    case 'sensitive': return <LockSimpleIcon {...iconProps} />;
    case 'storeRead':
    case 'storeWrite': return <DatabaseIcon {...iconProps} />;
    case 'retryFallback': return <ArrowsClockwiseIcon {...iconProps} />;
    case 'opaque': return <CubeIcon {...iconProps} />;
    case 'readiness': return <WarningCircleIcon {...iconProps} />;
  }
}

function HitlTimingMarker({ data }: { data: Extract<ContractNodeData, { kind: 'step' }> }) {
  if (!data.hitl?.enabled) return null;
  const timing = data.hitl.timing ?? 'before';
  const modifier: StepModifierPresentation = {
    id: 'hitl',
    label: 'HITL',
    accessibleLabel: `Human-in-the-loop gate, ${timing} execution`,
    tone: 'human',
    inspectorSection: 'hitl',
  };

  return (
    <button
      type="button"
      className={`contract-node-hitl-marker contract-node-hitl-marker--${timing} nodrag nopan`}
      data-hitl-timing={timing}
      aria-label={`${modifier.accessibleLabel}. Focus human input in the inspector.`}
      title={`${timing === 'before' ? 'Pause before execution' : timing === 'inside' ? 'Pause inside this step' : 'Pause after result production'} · configure in inspector`}
      onClick={() => data.onModifierActivate?.(data.id, modifier)}
    >
      <PauseCircleIcon aria-hidden="true" size={17} weight="fill" />
    </button>
  );
}

function ModifierChip({
  modifier,
  nodeId,
  onActivate,
  buttonRef,
}: {
  modifier: StepModifierPresentation;
  nodeId: string;
  onActivate?: ContractNodeData['onModifierActivate'];
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className={`contract-node-modifier-chip contract-node-modifier-chip--${modifier.tone} nodrag nopan`}
      ref={buttonRef}
      data-modifier-id={modifier.id}
      aria-label={`${modifier.accessibleLabel}. Focus ${modifier.inspectorSection} in the inspector.`}
      title={`${modifier.accessibleLabel} · configure in inspector`}
      onClick={() => onActivate?.(nodeId, modifier)}
    >
      <ModifierIcon modifier={modifier} />
      <span>{modifier.label}</span>
    </button>
  );
}

function StepModifierRail({ data }: { data: Extract<ContractNodeData, { kind: 'step' }> }) {
  const modifiers = stepModifierPresentations(data);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowId = useId();
  const firstOverflowModifierRef = useRef<HTMLButtonElement>(null);
  const visible = modifiers.slice(0, 3);
  const overflow = modifiers.slice(3);

  if (modifiers.length === 0) return null;

  const openOverflowForKeyboard = () => {
    setOverflowOpen(true);
    requestAnimationFrame(() => firstOverflowModifierRef.current?.focus());
  };

  return (
    <div className="contract-node-modifier-rail" aria-label="Step modifiers">
      {visible.map((modifier) => (
        <ModifierChip
          key={modifier.id}
          modifier={modifier}
          nodeId={data.id}
          onActivate={data.onModifierActivate}
        />
      ))}
      {overflow.length > 0 && (
        <div className="contract-node-modifier-overflow">
          <button
            type="button"
            className="contract-node-modifier-overflow-button nodrag nopan"
            aria-expanded={overflowOpen}
            aria-controls={overflowId}
            aria-label={`Show ${overflow.length} more modifiers for ${data.label}`}
            onClick={() => setOverflowOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openOverflowForKeyboard();
              }
            }}
          >
            +{overflow.length}
          </button>
          {overflowOpen && (
            <div id={overflowId} className="contract-node-modifier-overflow-menu" role="group" aria-label={`Additional modifiers for ${data.label}`}>
              {overflow.map((modifier) => (
                <ModifierChip
                  key={modifier.id}
                  modifier={modifier}
                  nodeId={data.id}
                  onActivate={data.onModifierActivate}
                  buttonRef={modifier.id === overflow[0]?.id ? firstOverflowModifierRef : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ContractNodeCard({
  data,
  selected = false,
  reviewFocusState = null,
  renderHandles = true,
}: {
  data: ContractNodeData;
  selected?: boolean;
  reviewFocusState?: CanvasReviewFocusState;
  renderHandles?: boolean;
}) {
  const proposalClass = data.proposalState ? `is-proposed-${data.proposalState}` : '';
  const invalid = Boolean(data.invalid);
  // Outer Start/End nodes remain terminal at the canvas boundary. Their
  // parented counterparts are subgraph ingress/egress endpoints, so React
  // Flow needs the otherwise-suppressed handle for their canonical boundary
  // edges to attach.
  const rendersTargetHandle = renderHandles && (data.kind !== 'start' || Boolean(data.parentId));
  const rendersSourceHandle = renderHandles && (data.kind !== 'end' || Boolean(data.parentId));
  const modifierData = data.kind === 'step' ? data : null;
  const visualKind = graphNodeVisualKind(data);
  const sendTemplate = modifierData ? data.sendTemplate : undefined;
  const provenance = data.provenance?.representation ?? 'declared';
  const readiness = modifierData?.readiness?.state ?? modifierData?.modifiers?.readiness ?? 'ready';
  const outcome = data.kind === 'end' ? data.outcome : undefined;
  const outcomeLabel = outcome
    ? outcome.kind === 'domain-specific'
      ? outcome.detail || 'Domain outcome'
      : outcome.kind.replace('-', ' ')
    : undefined;

  return (
    <div
      data-kind={data.kind}
      data-display-kind={visualKind}
      data-executor={modifierData?.executor}
      data-invalid={invalid || undefined}
      data-send-template={sendTemplate ? 'true' : undefined}
      data-provenance={provenance}
      data-readiness={readiness !== 'ready' ? readiness : undefined}
      className={`contract-node-shell ${selected || reviewFocusState === 'active' ? 'is-selected' : ''} ${invalid ? 'is-invalid' : ''} ${proposalClass} ${sendTemplate ? 'is-send-template' : ''} ${reviewFocusState ? `proposal-focus-${reviewFocusState}` : ''} provenance--${provenance}`}
    >
      {modifierData && <HitlTimingMarker data={modifierData} />}
      {data.evidenceMarker && (
        <button
          type="button"
          className="contract-node-evidence-marker nodrag nopan"
          aria-label={`Evidence marker ${data.evidenceMarker} for ${data.label}. Open evidence details.`}
          onClick={(event) => {
            event.stopPropagation();
            data.onEvidenceActivate?.(data.id);
          }}
        >
          {data.evidenceMarker}
        </button>
      )}
      {rendersTargetHandle && (
        <Handle type="target" position={Position.Left} className="contract-node-handle" />
      )}
      <div className="contract-node-heading">
        <span className="contract-node-icon-slot" data-node-visual={visualKind}>
          <NodeVisualIcon kind={visualKind} size={18} weight="bold" />
        </span>
        <div className="contract-node-title-group">
          <p className="contract-node-kind">{nodeVisualLabels[visualKind]}</p>
          <p className="contract-node-title">{data.label}</p>
          {data.description && <p className="contract-node-description">{data.description}</p>}
        </div>
      </div>
      <div className="contract-node-divider" />
      <div className="contract-node-meta" aria-label="Node status and modifiers">
        {modifierData ? <StepModifierRail data={modifierData} /> : <span />}
        <div className="contract-node-statuses">
          {sendTemplate && (
            <span
              className="contract-node-template-status"
              title={`Dynamic worker template; payload ${sendTemplate.payloadLabel || 'not labelled'}`}
            >
              Template ×N
            </span>
          )}
          {provenance !== 'declared' && (
            <span className="contract-node-provenance" aria-label={`${provenance.replace('-', ' ')} provenance`}>
              {provenance === 'runtime-generated' ? 'Runtime' : provenance === 'derived-semantic' ? 'Derived' : 'External'}
            </span>
          )}
          {outcomeLabel && <span className="contract-node-outcome">{outcomeLabel}</span>}
          {readiness !== 'ready' && (
            <span className={`contract-node-status contract-node-status--${readiness}`}>
              <WarningCircleIcon aria-hidden="true" size={12} weight="bold" />
              {readiness === 'degraded' ? 'Degraded' : 'Unimplemented'}
            </span>
          )}
          {invalid && (
            <span className="contract-node-status contract-node-status--invalid">
              <WarningCircleIcon aria-hidden="true" size={12} weight="bold" />
              Invalid
            </span>
          )}
          {data.proposalState && (
            <span className="contract-node-proposal-status">Proposed {data.proposalState}</span>
          )}
          {!invalid && !data.proposalState && readiness === 'ready' && (
            <span className="contract-node-status contract-node-status--ready">Ready</span>
          )}
          {data.outsideSubgraph && (
            <span className="contract-node-membership-status">Outside subgraph</span>
          )}
        </div>
      </div>
      {rendersSourceHandle && (
        <Handle type="source" position={Position.Right} className="contract-node-handle" />
      )}
    </div>
  );
}

export function ContractNode({ data, id, selected }: NodeProps<ContractFlowNode>) {
  const reviewFocusState = useCanvasNodeReviewFocus(id);
  return (
    <ContractNodeCard
      data={data}
      selected={selected}
      reviewFocusState={reviewFocusState}
    />
  );
}
