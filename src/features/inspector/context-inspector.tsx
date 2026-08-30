import { useReactFlow } from '@xyflow/react';
import {
  ArrowBendUpLeft,
  GitBranch,
  Lightning,
  LockSimple,
  Shield,
  WarningCircle,
} from '@phosphor-icons/react';
import { ReactNode, useEffect, useRef, useState } from 'react';

import './context-inspector.css';

import {
  applyGraphOperations,
  GraphEdge,
  GraphNode,
  GraphProposal,
  GraphSubgraph,
  HumanOutcome,
  HitlResponseContract,
  HumanSelectionChoice,
  SensitiveEffectPolicy,
  SendMapConfig,
  StepExecutor,
  StepModifierSummary,
  ValidationIssue,
  validateGraph,
  WorkflowGraph,
} from '@/src/domain';
import { topologyDerivedLoopEdgeIds } from '@/src/adapters/react-flow/project-graph';
import { evaluateConnection } from '@/src/application/connection-policy';
import type { StepModifierInspectorSection } from '@/src/features/canvas/contract-node';
import type { RuntimeInstanceNodeData } from '@/src/features/canvas/runtime-instance-node';
import {
  InspectorSelect,
  InspectorSelectOption,
} from '@/src/features/inspector/inspector-select';
import { useGraphStore } from '@/src/state/workspace-store';
import { PreviewInputRequestSheet } from '@/src/features/hitl/preview-input-request';
import {
  GraphDurabilitySettings,
  type GraphDurabilityTab,
  StepDurabilitySettings,
  SubgraphDurabilityOverrides,
} from '@/src/features/inspector/durability-settings';

type StepNode = Extract<GraphNode, { kind: 'step' }>;
type StepHitlConfig = NonNullable<StepNode['hitl']>;
type StepReadiness = NonNullable<StepNode['modifiers']>['readiness'];
type StepHitlResponse = NonNullable<StepHitlConfig['response']>;

const executorOptions: readonly InspectorSelectOption<StepExecutor>[] = [
  { value: 'deterministic', label: 'Deterministic' },
  { value: 'ai', label: 'AI' },
  { value: 'tool', label: 'Tool' },
  { value: 'human', label: 'Human' },
];
const hitlTimingOptions: readonly InspectorSelectOption<
  NonNullable<StepHitlConfig['timing']>
>[] = [
  { value: 'before', label: 'Before' },
  { value: 'inside', label: 'Inside' },
  { value: 'after', label: 'After' },
];
const hitlInputOptions: readonly InspectorSelectOption<
  StepHitlResponse['type']
>[] = [
  { value: 'approval', label: 'Approval' },
  { value: 'text', label: 'Text' },
  { value: 'selection', label: 'Selection' },
];
const edgeModeOptions: readonly InspectorSelectOption<GraphEdge['mode']>[] = [
  { value: 'normal', label: 'Edge' },
  { value: 'conditional', label: 'Conditional edge' },
  { value: 'command', label: 'Command' },
  { value: 'fallback', label: 'Fallback' },
  { value: 'send', label: 'Send/map · dynamic workers' },
];
const mergeCompletionOptions: readonly InspectorSelectOption<'all' | 'any' | 'quorum'>[] = [
  { value: 'all', label: 'All dynamic inputs' },
  { value: 'any', label: 'Any input' },
  { value: 'quorum', label: 'Quorum' },
];
const mergeContinuationOptions: readonly InspectorSelectOption<'once' | 'per_batch'>[] = [
  { value: 'once', label: 'Continue once' },
  { value: 'per_batch', label: 'Continue per batch' },
];

const noParentSubgraphValue = '__no_subgraph__';

const defaultSensitiveEffectPolicy = (): SensitiveEffectPolicy => ({
  target: 'Describe the sensitive effect target',
  authorization: 'Specify required authorization',
  approvalRequired: false,
  idempotency: 'Describe the idempotency strategy',
});

const stableOutcomeId = (edge: GraphEdge) => `outcome:${edge.id}`;

function defaultHitlResponse(graph: WorkflowGraph, nodeId: string): HitlResponseContract {
  return {
    type: 'approval',
    allowedOutcomes: graph.edges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => ({
        id: stableOutcomeId(edge),
        label: edge.label?.trim() || graph.nodes.find((candidate) => candidate.id === edge.target)?.label || edge.target,
        resumeNodeId: edge.target,
      })),
  };
}

function responseForType(response: StepHitlResponse, type: StepHitlResponse['type']): StepHitlResponse {
  if (type === 'selection') {
    return {
      ...response,
      type,
      selectionChoices: response.selectionChoices?.length
        ? response.selectionChoices
        : response.allowedOutcomes.map(({ id, label }) => ({ id, label })),
    };
  }
  const withoutChoices = { ...response };
  delete withoutChoices.selectionChoices;
  return { ...withoutChoices, type };
}

const localId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;

export type InspectorFocusRequest = {
  section: StepModifierInspectorSection;
  requestId: number;
};

export type GraphSettingsRequest = {
  tab: GraphDurabilityTab;
  requestId: number;
};

export function subgraphParentOptions(
  subgraphs: GraphSubgraph[],
): readonly InspectorSelectOption<string>[] {
  return [
    { value: noParentSubgraphValue, label: 'No subgraph' },
    ...subgraphs.map((subgraph) => ({ value: subgraph.id, label: subgraph.label })),
  ];
}

const normalizedDimension = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(160, Math.round(parsed)) : fallback;
};

const edgeValidationIssues = (graph: WorkflowGraph, edge: GraphEdge): ValidationIssue[] => {
  const routePath = `edges.${edge.id}`;
  const sourcePath = `nodes.${edge.source}`;
  const sourceLabel = graph.nodes.find((node) => node.id === edge.source)?.label;
  const sourceScopedCodes = new Set([
    'MIXED_ROUTING',
    'OUTGOING_REQUIRED',
    'MULTIPLE_NORMAL_EDGES',
    'CONDITIONAL_EDGE_COUNT',
    'MULTIPLE_FALLBACKS',
    'FALLBACK_WITHOUT_CONDITIONS',
    'CONDITIONAL_LABEL_REQUIRED',
    'DUPLICATE_CONDITIONAL_LABEL',
    'COMMAND_LABEL_REQUIRED',
  ]);
  return validateGraph(graph).filter(
    (issue) =>
      issue.path === routePath ||
      issue.path?.startsWith(`${routePath}.`) ||
      issue.path === sourcePath ||
      (Boolean(sourceLabel) &&
        sourceScopedCodes.has(issue.code) &&
        issue.message.includes(`“${sourceLabel}”`)),
  );
};

const edgeProposalState = (
  proposal: GraphProposal | null,
  edgeId: string,
): 'added' | 'updated' | 'removed' | undefined => {
  if (!proposal) return undefined;
  if (proposal.diff.removedEdgeIds.includes(edgeId)) return 'removed';
  if (proposal.diff.addedEdgeIds.includes(edgeId)) return 'added';
  if (proposal.diff.updatedEdgeIds.includes(edgeId)) return 'updated';
  return undefined;
};

function edgeDestinationOptions(
  graph: WorkflowGraph,
  edge: GraphEdge,
): readonly InspectorSelectOption<string>[] {
  const destinations = graph.nodes
    .filter(
      (node) =>
        node.id === edge.target ||
        evaluateConnection(
          graph,
          { source: edge.source, target: node.id },
          { reconnectingEdgeId: edge.id },
        ).valid,
    )
    .map((node) => ({
      value: node.id,
      label: `${node.label} · ${node.kind}`,
    }));
  return destinations.some((destination) => destination.value === edge.target)
    ? destinations
    : [{ value: edge.target, label: `Missing target · ${edge.target}` }, ...destinations];
}

function sendDestinationOptions(
  graph: WorkflowGraph,
  edge: GraphEdge,
): readonly InspectorSelectOption<string>[] {
  const source = graph.nodes.find((node) => node.id === edge.source);
  const destinations = graph.nodes
    .filter(
      (node) =>
        node.kind === 'step' &&
        node.parentId === source?.parentId,
    )
    .map((node) => ({ value: node.id, label: `${node.label} · worker template` }));
  return destinations.some((destination) => destination.value === edge.target)
    ? destinations
    : [{ value: edge.target, label: `Invalid template · ${edge.target}` }, ...destinations];
}

function defaultSendConfig(graph: WorkflowGraph, edge: GraphEdge, target: string): SendMapConfig {
  const source = graph.nodes.find((node) => node.id === edge.source);
  const merge = graph.nodes.find(
    (node) => node.kind === 'merge' && node.parentId === source?.parentId,
  );
  return {
    destinationTemplateId: target,
    multiplicity: 'dynamic',
    payloadLabel: 'payload',
    mergeNodeId: merge?.id ?? '',
  };
}

export type RuntimeInstanceInspectorSelection = RuntimeInstanceNodeData;

export function ContextInspector({
  focusRequest,
  graphSettingsRequest,
  runtimeInstance,
  readOnly = false,
}: {
  focusRequest?: InspectorFocusRequest | null;
  graphSettingsRequest?: GraphSettingsRequest | null;
  runtimeInstance?: RuntimeInstanceInspectorSelection | null;
  readOnly?: boolean;
}) {
  const graph = useGraphStore((state) => state.graph);
  const proposal = useGraphStore((state) => state.proposal);
  const selection = useGraphStore((state) => state.selection);
  const updateNode = useGraphStore((state) => state.updateNode);
  const updateSubgraph = useGraphStore((state) => state.updateSubgraph);
  const setSubgraphCollapsed = useGraphStore((state) => state.setSubgraphCollapsed);
  const assignNodesToSubgraph = useGraphStore((state) => state.assignNodesToSubgraph);
  const assignNodeToSubgraph = useGraphStore((state) => state.assignNodesToSubgraph);
  const removeNodeFromSubgraph = useGraphStore((state) => state.removeNodeFromSubgraph);
  const dissolveSubgraph = useGraphStore((state) => state.dissolveSubgraph);
  const removeNode = useGraphStore((state) => state.removeNode);
  const duplicateSelection = useGraphStore((state) => state.duplicateSelection);
  const updateEdge = useGraphStore((state) => state.updateEdge);
  const removeEdge = useGraphStore((state) => state.removeEdge);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const editable = graph.status === 'draft' && !proposal && !readOnly;
  const { fitView } = useReactFlow();
  const primary = selection.primary;
  const node = primary?.type === 'node' ? graph.nodes.find((item) => item.id === primary.id) : undefined;
  const subgraph =
    primary?.type === 'subgraph'
      ? graph.subgraphs.find((item) => item.id === primary.id)
      : undefined;
  const proposalPreview = proposal?.status === 'pending' || proposal?.status === 'invalid';
  const previewGraph = proposal && proposalPreview
    ? applyGraphOperations(graph, proposal.operations).graph
    : graph;
  const acceptedEdge =
    primary?.type === 'edge' ? graph.edges.find((item) => item.id === primary.id) : undefined;
  const previewEdge =
    primary?.type === 'edge' ? previewGraph.edges.find((item) => item.id === primary.id) : undefined;
  const edge = previewEdge ?? acceptedEdge;
  const edgeGraph = previewEdge ? previewGraph : graph;
  const edgeTarget = edge ? edgeGraph.nodes.find((node) => node.id === edge.target) : undefined;
  const edgeIssues = edge ? edgeValidationIssues(edgeGraph, edge) : [];
  const edgeIsLoop = edge ? topologyDerivedLoopEdgeIds(edgeGraph).has(edge.id) : false;
  const edgePreviewState = edge ? edgeProposalState(proposal, edge.id) : undefined;
  const edgeDestinations = edge ? edgeDestinationOptions(edgeGraph, edge) : [];
  const sendDestinations = edge ? sendDestinationOptions(edgeGraph, edge) : [];
  const selectedNodeIds = selection.nodeIds.filter((nodeId) =>
    graph.nodes.some((node) => node.id === nodeId),
  );
  const parentOptions = subgraphParentOptions(graph.subgraphs);
  const stepSectionRefs = useRef<
    Partial<Record<StepModifierInspectorSection, HTMLElement>>
  >({});

  useEffect(() => {
    if (!focusRequest || node?.kind !== 'step') return;
    const frame = requestAnimationFrame(() => {
      stepSectionRefs.current[focusRequest.section]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, node?.id, node?.kind]);

  const previewNode = previewNodeId === node?.id ? node : undefined;
  const previewIsCurrent =
    Boolean(previewNodeId) &&
    graph.status === 'draft' &&
    !proposal &&
    previewNode?.kind === 'step' &&
    previewNode.hitl?.enabled &&
    Boolean(previewNode.hitl.response);

  const updateModifierFlag = (
    key: Exclude<keyof StepModifierSummary, 'readiness' | 'storeRead' | 'storeWrite' | 'retryFallback'>,
    enabled: boolean,
  ) => {
    if (node?.kind !== 'step') return;
    const modifiers = { ...node.modifiers };
    if (enabled) modifiers[key] = true;
    else delete modifiers[key];
    updateNode(node.id, { modifiers });
  };

  const updateReadiness = (readiness: StepReadiness | 'ready') => {
    if (node?.kind !== 'step') return;
    const modifiers = { ...node.modifiers };
    if (readiness === 'ready') delete modifiers.readiness;
    else modifiers.readiness = readiness;
    updateNode(node.id, { modifiers });
  };

  const updateHitlResponse = (response: StepHitlResponse) => {
    if (node?.kind !== 'step' || !node.hitl) return;
    updateNode(node.id, { hitl: { ...node.hitl, response } });
  };

  const updateOutcome = (outcomeId: string, patch: Partial<HumanOutcome>) => {
    if (node?.kind !== 'step' || !node.hitl?.response) return;
    updateHitlResponse({
      ...node.hitl.response,
      allowedOutcomes: node.hitl.response.allowedOutcomes.map((outcome) =>
        outcome.id === outcomeId ? { ...outcome, ...patch } : outcome,
      ),
    });
  };

  const updateSelectionChoice = (choiceId: string, patch: Partial<HumanSelectionChoice>) => {
    if (node?.kind !== 'step' || !node.hitl?.response) return;
    updateHitlResponse({
      ...node.hitl.response,
      selectionChoices: (node.hitl.response.selectionChoices ?? []).map((choice) =>
        choice.id === choiceId ? { ...choice, ...patch } : choice,
      ),
    });
  };

  return (
    <section className="context-inspector" aria-label="Context inspector">
      <header className="context-inspector__header">
        <p className="context-inspector__eyebrow">Context</p>
        <h2>Inspector</h2>
      </header>
      {!runtimeInstance && !node && !subgraph && !edge && (
        <div className="context-inspector__content">
          <p className="context-inspector__empty">
            Select a node, subgraph, or edge to configure it. Shift-click or drag-select multiple nodes.
          </p>
          <GraphDurabilitySettings
            key={graphSettingsRequest?.requestId ?? 'default'}
            graph={graph}
            editable={editable}
            initialTab={graphSettingsRequest?.tab}
            focusInitialTab={Boolean(graphSettingsRequest)}
          />
        </div>
      )}
      {selection.nodeIds.length + selection.subgraphIds.length + selection.edgeIds.length > 1 && (
        <p className="context-inspector__selection-summary" role="status" aria-live="polite">
          {selection.nodeIds.length + selection.subgraphIds.length + selection.edgeIds.length} elements selected
        </p>
      )}
      {runtimeInstance && (
        <div className="context-inspector__content">
          <section className="context-inspector__group context-inspector__group--tinted" aria-labelledby="runtime-instance-heading">
            <h3 id="runtime-instance-heading">Observed runtime instance</h3>
            <div className="context-inspector__fields">
              <Field label="Instance"><p className="context-inspector__read-only-value">{runtimeInstance.label}</p></Field>
              <Field label="Runtime ID"><p className="context-inspector__read-only-value">{runtimeInstance.runtimeId}</p></Field>
              <Field label="Template"><p className="context-inspector__read-only-value">{runtimeInstance.templateNodeId}</p></Field>
              <Field label="Send relationship"><p className="context-inspector__read-only-value">{runtimeInstance.sendEdgeId}</p></Field>
            </div>
            <p className="context-inspector__read-only" role="status">
              Observed trace projection — read-only. This instance is not part of the accepted graph and cannot change the contract.
            </p>
          </section>
        </div>
      )}
      {subgraph && (
        <div className="context-inspector__content">
          <section className="context-inspector__group" aria-labelledby="subgraph-details-heading">
            <h3 id="subgraph-details-heading">Subgraph details</h3>
            <div className="context-inspector__fields">
              <Field label="Label">
                <input
                  value={subgraph.label}
                  disabled={!editable}
                  onChange={(event) => updateSubgraph(subgraph.id, { label: event.target.value })}
                  className="input"
                />
              </Field>
              <label className="context-inspector__toggle-label">
                <span>Collapsed on canvas</span>
                <input
                  type="checkbox"
                  checked={subgraph.collapsed}
                  disabled={!editable}
                  onChange={(event) => setSubgraphCollapsed(subgraph.id, event.target.checked)}
                />
              </label>
              <button
                type="button"
                disabled={!editable}
                aria-expanded={!subgraph.collapsed}
                aria-label={`${subgraph.collapsed ? 'Expand' : 'Collapse'} subgraph ${subgraph.label}`}
                onClick={() => setSubgraphCollapsed(subgraph.id, !subgraph.collapsed)}
                className="secondary-button"
              >
                {subgraph.collapsed ? 'Expand subgraph' : 'Collapse subgraph'}
              </button>
              <div className="context-inspector__two-column-fields">
                <Field label="Width">
                  <input
                    type="number"
                    min="160"
                    step="12"
                    inputMode="numeric"
                    value={subgraph.dimensions.width}
                    disabled={!editable}
                    onChange={(event) =>
                      updateSubgraph(subgraph.id, {
                        dimensions: {
                          ...subgraph.dimensions,
                          width: normalizedDimension(event.target.value, subgraph.dimensions.width),
                        },
                      })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Height">
                  <input
                    type="number"
                    min="160"
                    step="12"
                    inputMode="numeric"
                    value={subgraph.dimensions.height}
                    disabled={!editable}
                    onChange={(event) =>
                      updateSubgraph(subgraph.id, {
                        dimensions: {
                          ...subgraph.dimensions,
                          height: normalizedDimension(event.target.value, subgraph.dimensions.height),
                        },
                      })
                    }
                    className="input"
                  />
                </Field>
              </div>
            </div>
          </section>
          <SubgraphDurabilityOverrides graph={graph} subgraph={subgraph} editable={editable} />
          <section className="context-inspector__group context-inspector__group--tinted" aria-labelledby="subgraph-members-heading">
            <div className="context-inspector__toggle-row">
              <h3 id="subgraph-members-heading">Member nodes</h3>
              <span className="context-inspector__member-count">{graph.nodes.filter((node) => node.parentId === subgraph.id).length}</span>
            </div>
            <p className="context-inspector__help">Add a Start and End node before freezing this subgraph.</p>
            <button
              type="button"
              disabled={!editable || selectedNodeIds.length === 0}
              onClick={() => assignNodesToSubgraph(subgraph.id, selectedNodeIds)}
              className="secondary-button context-inspector__member-action"
            >
              Add selected nodes ({selectedNodeIds.length})
            </button>
            <ul className="context-inspector__member-list">
              {graph.nodes
                .filter((node) => node.parentId === subgraph.id)
                .map((member) => (
                  <li key={member.id}>
                    <span>
                      <strong>{member.label}</strong>
                      <small>{member.kind}</small>
                    </span>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => removeNodeFromSubgraph(member.id)}
                      className="secondary-button"
                    >
                      Remove from group
                    </button>
                  </li>
                ))}
              {graph.nodes.every((node) => node.parentId !== subgraph.id) && (
                <li className="context-inspector__member-empty">No member nodes yet.</li>
              )}
            </ul>
          </section>
          <div className="context-inspector__actions">
            <button
              type="button"
              onClick={() => void fitView({ nodes: [{ id: subgraph.id }], duration: 180, padding: 1.4 })}
              className="secondary-button"
            >
              Focus subgraph
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={() => dissolveSubgraph(subgraph.id)}
              className="danger-button"
            >
              Dissolve subgraph — keep child nodes and edges
            </button>
          </div>
        </div>
      )}
      {node && (
        <div className="context-inspector__content">
          <section className="context-inspector__group" aria-labelledby="node-details-heading">
            <h3 id="node-details-heading">Node details</h3>
            <div className="context-inspector__fields">
              <Field label="Label">
                <input value={node.label} disabled={!editable} onChange={(event) => updateNode(node.id, { label: event.target.value })} className="input" />
              </Field>
              <Field label="Description">
                <textarea value={node.description ?? ''} disabled={!editable} onChange={(event) => updateNode(node.id, { description: event.target.value })} className="input min-h-16 resize-y" placeholder="What happens at this step?" />
              </Field>
              <Field label="Parent subgraph">
                <InspectorSelect
                  value={node.parentId ?? noParentSubgraphValue}
                  options={parentOptions}
                  disabled={!editable}
                  onChange={(subgraphId) => {
                    if (subgraphId === noParentSubgraphValue) {
                      removeNodeFromSubgraph(node.id);
                    } else {
                      assignNodeToSubgraph(subgraphId, [node.id]);
                    }
                  }}
                />
                <p className="context-inspector__help">Choose a group or remove this node while keeping its canvas position. Dragging outside a group does not ungroup it.</p>
              </Field>
            </div>
          </section>
          {node.kind === 'step' && (
            <>
            <section
              ref={(element) => { stepSectionRefs.current.executor = element ?? undefined; }}
              id="inspector-step-executor"
              data-inspector-section="executor"
              tabIndex={-1}
              className="context-inspector__group context-inspector__group--tinted"
              aria-labelledby="step-executor-heading"
            >
              <h3 id="step-executor-heading">Executor</h3>
              <div className="context-inspector__fields">
                <Field label="Step executor">
                  <InspectorSelect
                    value={node.executor}
                    options={executorOptions}
                    disabled={!editable}
                    ariaLabel="Step executor"
                    onChange={(executor) => updateNode(node.id, { executor })}
                  />
                </Field>
              </div>
            </section>
            <section
              ref={(element) => { stepSectionRefs.current.participation = element ?? undefined; }}
              id="inspector-step-participation"
              data-inspector-section="participation"
              tabIndex={-1}
              className="context-inspector__group context-inspector__group--tinted"
              aria-labelledby="step-participation-heading"
            >
              <div className="context-inspector__toggle-row">
                <h3 id="step-participation-heading">Participation</h3>
                <label className="context-inspector__toggle-label">
                  <span>Internal tools</span>
                  <input
                    type="checkbox"
                    checked={Boolean(node.participation?.internalTools)}
                    disabled={!editable}
                    onChange={(event) =>
                      updateNode(node.id, {
                        participation: event.target.checked ? { internalTools: true } : {},
                      })
                    }
                  />
                </label>
              </div>
              <p className="context-inspector__help">Internal calls do not change the Step executor.</p>
            </section>
            <section
              ref={(element) => { stepSectionRefs.current.hitl = element ?? undefined; }}
              id="inspector-step-hitl"
              data-inspector-section="hitl"
              tabIndex={-1}
              className="context-inspector__group context-inspector__group--tinted"
              aria-labelledby="human-input-heading"
            >
              <div className="context-inspector__toggle-row">
                <h3 id="human-input-heading">Human input gate</h3>
                <label className="context-inspector__toggle-label">
                  <span>Enabled</span>
                  <input
                    type="checkbox"
                    aria-label="HITL enabled"
                    checked={Boolean(node.hitl?.enabled)}
                    disabled={!editable}
                    onChange={(event) => updateNode(node.id, {
                      hitl: event.target.checked
                        ? {
                            enabled: true,
                            timing: node.hitl?.timing ?? 'before',
                            response: node.hitl?.response ?? defaultHitlResponse(graph, node.id),
                            ...(node.hitl?.activation ? { activation: node.hitl.activation } : {}),
                          }
                        : { ...node.hitl, enabled: false },
                    })}
                  />
                </label>
              </div>
              <p className="context-inspector__help">HITL pauses this Step; it does not change whether the Step is AI, Tool, deterministic, or human-owned.</p>
              {node.hitl?.enabled && (
                <div className="context-inspector__fields">
                  <div className="context-inspector__two-column-fields">
                    <Field label="Timing">
                      <InspectorSelect
                        disabled={!editable}
                        value={node.hitl.timing ?? 'before'}
                        options={hitlTimingOptions}
                        ariaLabel="HITL timing"
                        onChange={(timing) =>
                          updateNode(node.id, { hitl: { ...node.hitl!, timing } })
                        }
                      />
                    </Field>
                    <Field label="Response type">
                      <InspectorSelect
                        disabled={!editable}
                        value={node.hitl.response?.type ?? 'approval'}
                        options={hitlInputOptions}
                        ariaLabel="HITL response type"
                        onChange={(type) => updateHitlResponse(responseForType(node.hitl!.response!, type))}
                      />
                    </Field>
                  </div>
                  <Field label="Gate reason">
                    <input
                      aria-label="Human input gate reason"
                      value={node.hitl.activation?.reason ?? ''}
                      disabled={!editable}
                      onChange={(event) => {
                        const reason = event.target.value;
                        const withoutActivation = { ...node.hitl! };
                        delete withoutActivation.activation;
                        updateNode(node.id, {
                          hitl: {
                            ...withoutActivation,
                            ...(reason.trim() ? { activation: { reason } } : {}),
                          },
                        });
                      }}
                      className="input"
                      placeholder="Why does a person need to respond?"
                    />
                  </Field>
                  <div className="context-inspector__contract-list">
                    <div className="context-inspector__toggle-row">
                      <strong>Allowed outcomes</strong>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!editable || !graph.edges.some((edge) => edge.source === node.id)}
                        onClick={() => {
                          const edge = graph.edges.find((candidate) => candidate.source === node.id);
                          if (!edge) return;
                          updateHitlResponse({
                            ...node.hitl!.response!,
                            allowedOutcomes: [
                              ...node.hitl!.response!.allowedOutcomes,
                              {
                                id: localId('outcome'),
                                label: graph.nodes.find((candidate) => candidate.id === edge.target)?.label ?? edge.target,
                                resumeNodeId: edge.target,
                              },
                            ],
                          });
                        }}
                      >
                        Add outcome
                      </button>
                    </div>
                    {node.hitl.response?.allowedOutcomes.map((outcome, index) => {
                      const destinations = graph.edges
                        .filter((edge) => edge.source === node.id)
                        .map((edge) => ({
                          value: edge.target,
                          label: `${graph.nodes.find((candidate) => candidate.id === edge.target)?.label ?? edge.target} · ${edge.target}`,
                        }));
                      return (
                        <div key={`${outcome.id}-${index}`} className="context-inspector__contract-item">
                          <Field label={`Outcome ${index + 1} label`}>
                            <input aria-label={`Outcome ${index + 1} label`} value={outcome.label} disabled={!editable} onChange={(event) => updateOutcome(outcome.id, { label: event.target.value })} className="input" />
                          </Field>
                          <Field label={`Outcome ${index + 1} ID`}>
                            <input aria-label={`Outcome ${index + 1} ID`} value={outcome.id} disabled={!editable} onChange={(event) => updateOutcome(outcome.id, { id: event.target.value })} className="input" />
                          </Field>
                          <Field label={`Outcome ${index + 1} resume destination`}>
                            <InspectorSelect value={outcome.resumeNodeId} options={destinations} disabled={!editable} ariaLabel={`Outcome ${index + 1} resume destination`} onChange={(resumeNodeId) => updateOutcome(outcome.id, { resumeNodeId })} />
                          </Field>
                          <button type="button" disabled={!editable} className="secondary-button" onClick={() => updateHitlResponse({ ...node.hitl!.response!, allowedOutcomes: node.hitl!.response!.allowedOutcomes.filter((candidate) => candidate.id !== outcome.id) })}>
                            Remove outcome
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {node.hitl.response?.type === 'selection' && (
                    <div className="context-inspector__contract-list">
                      <div className="context-inspector__toggle-row">
                        <strong>Selection choices</strong>
                        <button type="button" className="secondary-button" disabled={!editable} onClick={() => updateHitlResponse({ ...node.hitl!.response!, selectionChoices: [...(node.hitl!.response!.selectionChoices ?? []), { id: localId('choice'), label: 'New choice' }] })}>Add choice</button>
                      </div>
                      {node.hitl.response.selectionChoices?.map((choice, index) => (
                        <div key={`${choice.id}-${index}`} className="context-inspector__contract-item">
                          <Field label={`Choice ${index + 1} label`}>
                            <input aria-label={`Choice ${index + 1} label`} value={choice.label} disabled={!editable} onChange={(event) => updateSelectionChoice(choice.id, { label: event.target.value })} className="input" />
                          </Field>
                          <Field label={`Choice ${index + 1} ID`}>
                            <input aria-label={`Choice ${index + 1} ID`} value={choice.id} disabled={!editable} onChange={(event) => updateSelectionChoice(choice.id, { id: event.target.value })} className="input" />
                          </Field>
                          <button type="button" disabled={!editable} className="secondary-button" onClick={() => updateHitlResponse({ ...node.hitl!.response!, selectionChoices: node.hitl!.response!.selectionChoices?.filter((candidate) => candidate.id !== choice.id) })}>Remove choice</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    ref={previewTriggerRef}
                    type="button"
                    className="secondary-button"
                    disabled={!editable}
                    onClick={() => setPreviewNodeId(node.id)}
                  >
                    Preview input request
                  </button>
                </div>
              )}
            </section>
            <section
              ref={(element) => { stepSectionRefs.current.sensitive = element ?? undefined; }}
              id="inspector-step-sensitive"
              data-inspector-section="sensitive"
              tabIndex={-1}
              className="context-inspector__group context-inspector__group--tinted"
              aria-labelledby="sensitive-policy-heading"
            >
              <div className="context-inspector__toggle-row">
                <h3 id="sensitive-policy-heading">Sensitive effect policy</h3>
                <label className="context-inspector__toggle-label">
                  <span>Enabled</span>
                  <input type="checkbox" aria-label="Sensitive effect policy enabled" checked={Boolean(node.sensitive)} disabled={!editable} onChange={(event) => updateNode(node.id, { sensitive: event.target.checked ? node.sensitive ?? defaultSensitiveEffectPolicy() : null })} />
                </label>
              </div>
              <p className="context-inspector__help">This policy is independent from HITL. Requiring approval never creates a gate automatically.</p>
              {node.sensitive && (
                <div className="context-inspector__fields">
                  <Field label="Mutation target"><input aria-label="Sensitive mutation target" value={node.sensitive.target} disabled={!editable} onChange={(event) => updateNode(node.id, { sensitive: { ...node.sensitive!, target: event.target.value } })} className="input" /></Field>
                  <Field label="Authorization"><input aria-label="Sensitive authorization" value={node.sensitive.authorization} disabled={!editable} onChange={(event) => updateNode(node.id, { sensitive: { ...node.sensitive!, authorization: event.target.value } })} className="input" /></Field>
                  <label className="context-inspector__toggle-label"><span>Approval required</span><input type="checkbox" checked={node.sensitive.approvalRequired} disabled={!editable} onChange={(event) => updateNode(node.id, { sensitive: { ...node.sensitive!, approvalRequired: event.target.checked } })} /></label>
                  <Field label="Idempotency"><input aria-label="Sensitive idempotency" value={node.sensitive.idempotency} disabled={!editable} onChange={(event) => updateNode(node.id, { sensitive: { ...node.sensitive!, idempotency: event.target.value } })} className="input" /></Field>
                </div>
              )}
            </section>
            <StepDurabilitySettings
              graph={graph}
              node={node}
              editable={editable}
              storeAccessRef={(element) => { stepSectionRefs.current.storeAccess = element ?? undefined; }}
              retryRef={(element) => { stepSectionRefs.current.retry = element ?? undefined; }}
            />
            <section
              ref={(element) => { stepSectionRefs.current.modifiers = element ?? undefined; }}
              id="inspector-step-modifiers"
              data-inspector-section="modifiers"
              tabIndex={-1}
              className="context-inspector__group context-inspector__group--tinted"
              aria-labelledby="step-modifiers-heading"
            >
              <h3 id="step-modifiers-heading">Modifier summary</h3>
              <div className="context-inspector__fields">
                <label className="context-inspector__toggle-label">
                  <span>Guardrail</span>
                  <input type="checkbox" checked={Boolean(node.modifiers?.guardrail)} disabled={!editable} onChange={(event) => updateModifierFlag('guardrail', event.target.checked)} />
                </label>
                <label className="context-inspector__toggle-label">
                  <span>Opaque or prebuilt</span>
                  <input type="checkbox" checked={Boolean(node.modifiers?.opaque)} disabled={!editable} onChange={(event) => updateModifierFlag('opaque', event.target.checked)} />
                </label>
                <Field label="Readiness">
                  <select
                    aria-label="Readiness"
                    value={node.modifiers?.readiness ?? 'ready'}
                    disabled={!editable}
                    onChange={(event) => updateReadiness(event.target.value as StepReadiness | 'ready')}
                    className="input"
                  >
                    <option value="ready">Ready</option>
                    <option value="degraded">Degraded</option>
                    <option value="unimplemented">Unimplemented</option>
                  </select>
                </Field>
              </div>
            </section>
            </>
          )}
          {node.kind === 'merge' && (
            <section className="context-inspector__group context-inspector__group--tinted" aria-labelledby="merge-configuration-heading">
              <h3 id="merge-configuration-heading">Merge reducer</h3>
              <p className="context-inspector__help">Merge waits for dynamic Send inputs. It is a structural junction, not a work Step.</p>
              <div className="context-inspector__fields">
                <Field label="Reducer name">
                  <input
                    aria-label="Merge reducer name"
                    value={node.merge.reducer.name}
                    disabled={!editable}
                    onChange={(event) => updateNode(node.id, {
                      merge: { ...node.merge, reducer: { ...node.merge.reducer, name: event.target.value } },
                    })}
                    className="input"
                  />
                </Field>
                <Field label="Aggregate state">
                  <input
                    aria-label="Merge aggregate state"
                    value={node.merge.reducer.aggregateState}
                    disabled={!editable}
                    onChange={(event) => updateNode(node.id, {
                      merge: { ...node.merge, reducer: { ...node.merge.reducer, aggregateState: event.target.value } },
                    })}
                    className="input"
                  />
                </Field>
                <div className="context-inspector__two-column-fields">
                  <Field label="Completion">
                    <InspectorSelect
                      value={node.merge.completion.mode}
                      options={mergeCompletionOptions}
                      disabled={!editable}
                      ariaLabel="Merge completion policy"
                      onChange={(mode) => updateNode(node.id, {
                        merge: {
                          ...node.merge,
                          completion: mode === 'quorum'
                            ? { mode, quorum: node.merge.completion.quorum ?? 1 }
                            : { mode },
                        },
                      })}
                    />
                  </Field>
                  <Field label="Continuation">
                    <InspectorSelect
                      value={node.merge.continuation.mode}
                      options={mergeContinuationOptions}
                      disabled={!editable}
                      ariaLabel="Merge continuation policy"
                      onChange={(mode) => updateNode(node.id, {
                        merge: { ...node.merge, continuation: { mode } },
                      })}
                    />
                  </Field>
                </div>
                {node.merge.completion.mode === 'quorum' && (
                  <Field label="Quorum">
                    <input
                      aria-label="Merge quorum"
                      type="number"
                      min={1}
                      value={node.merge.completion.quorum ?? 1}
                      disabled={!editable}
                      onChange={(event) => updateNode(node.id, {
                        merge: {
                          ...node.merge,
                          completion: {
                            mode: 'quorum',
                            quorum: Math.max(1, Math.trunc(Number(event.target.value) || 1)),
                          },
                        },
                      })}
                      className="input"
                    />
                  </Field>
                )}
              </div>
            </section>
          )}
          <div className="context-inspector__actions">
            <button
              type="button"
              onClick={() => void fitView({ nodes: [{ id: node.id }], duration: 180, padding: 1.4 })}
              className="secondary-button"
            >
              Focus node
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={duplicateSelection}
              className="secondary-button"
            >
              Duplicate selection
            </button>
            <button disabled={!editable} onClick={() => removeNode(node.id)} className="danger-button">Remove node</button>
          </div>
        </div>
      )}
      {previewNode?.kind === 'step' && previewNode.hitl?.enabled && previewNode.hitl.response && previewIsCurrent && (
        <PreviewInputRequestSheet
          graph={graph}
          node={previewNode}
          onClose={() => setPreviewNodeId(null)}
          restoreFocusTo={previewTriggerRef}
        />
      )}
      {edge && (
        <div className="context-inspector__content">
          <section className="context-inspector__group" aria-labelledby="edge-routing-heading">
            <h3 id="edge-routing-heading">Edge routing</h3>
            <div className="context-inspector__fields">
              <Field label="Routing mode">
                <InspectorSelect
                  value={edge.mode}
                  options={edgeModeOptions}
                  disabled={!editable}
                  ariaLabel="Routing mode"
                  onChange={(mode) => {
                    if (mode === 'send') {
                      const destination = sendDestinations.find((option) => option.value === edge.target)?.value ?? sendDestinations[0]?.value ?? edge.target;
                      updateEdge(edge.id, {
                        mode,
                        target: destination,
                        send: defaultSendConfig(edgeGraph, edge, destination),
                      });
                      return;
                    }
                    updateEdge(edge.id, { mode });
                  }}
                />
              </Field>
              <Field label="Destination">
                <InspectorSelect
                  value={edge.target}
                  options={edge.mode === 'send' ? sendDestinations : edgeDestinations}
                  disabled={!editable}
                  ariaLabel="Destination"
                  onChange={(target) => updateEdge(
                    edge.id,
                    edge.mode === 'send'
                      ? { target, send: { ...edge.send, destinationTemplateId: target } }
                      : { target },
                  )}
                />
                <p className="context-inspector__help">
                  {edge.mode === 'send'
                    ? `Canonical worker template: ${edgeTarget?.label ?? 'Missing Step'} · ${edge.target}`
                    : `Canonical target: ${edgeTarget?.label ?? 'Missing node'} · ${edge.target}`}
                </p>
              </Field>
              <Field label={edge.mode === 'send' ? 'Relationship label' : edge.mode === 'fallback' ? 'Fallback label' : 'Route label'}>
                <input
                  aria-label={edge.mode === 'send' ? 'Send relationship label' : edge.mode === 'fallback' ? 'Fallback label' : 'Route label'}
                  value={edge.label ?? ''}
                  disabled={!editable}
                  onChange={(event) => updateEdge(edge.id, { label: event.target.value })}
                  className="input"
                  placeholder={
                    edge.mode === 'send'
                      ? 'Optional label'
                      : edge.mode === 'fallback'
                      ? 'fallback'
                      : edge.mode === 'normal'
                        ? 'Optional label'
                        : 'Required readable label'
                  }
                />
                {(edge.mode === 'conditional' || edge.mode === 'command') && (
                  <p className="context-inspector__help">A readable label is required for this route.</p>
                )}
              </Field>
              {(edge.mode === 'conditional' || edge.mode === 'command') && (
                <Field label="Condition">
                  <input
                    aria-label="Condition"
                    value={edge.condition ?? ''}
                    disabled={!editable}
                    onChange={(event) => updateEdge(edge.id, { condition: event.target.value })}
                    className="input"
                    placeholder="Optional executable condition"
                  />
                  <p className="context-inspector__help">Leave blank or enter a readable condition for the route.</p>
                </Field>
              )}
              {edge.mode === 'send' && (
                <>
                  <Field label="Payload label">
                    <input
                      aria-label="Send payload label"
                      value={edge.send.payloadLabel}
                      disabled={!editable}
                      onChange={(event) => updateEdge(edge.id, {
                        send: { ...edge.send, payloadLabel: event.target.value },
                      })}
                      className="input"
                      placeholder="query"
                    />
                  </Field>
                  <Field label="Payload schema reference">
                    <input
                      aria-label="Send payload schema reference"
                      value={edge.send.payloadSchemaRef ?? ''}
                      disabled={!editable}
                      onChange={(event) => {
                        const payloadSchemaRef = event.target.value;
                        const send = { ...edge.send };
                        if (payloadSchemaRef.trim()) send.payloadSchemaRef = payloadSchemaRef;
                        else delete send.payloadSchemaRef;
                        updateEdge(edge.id, { send });
                      }}
                      className="input"
                      placeholder="Optional schema reference"
                    />
                  </Field>
                  <Field label="Merge destination">
                    <InspectorSelect
                      value={edge.send.mergeNodeId}
                      options={edgeGraph.nodes
                        .filter(
                          (node) =>
                            node.kind === 'merge' &&
                            node.parentId === edgeGraph.nodes.find((candidate) => candidate.id === edge.source)?.parentId,
                        )
                        .map((node) => ({ value: node.id, label: `${node.label} · reducer` }))}
                      disabled={!editable}
                      ariaLabel="Send merge destination"
                      onChange={(mergeNodeId) => updateEdge(edge.id, {
                        send: { ...edge.send, mergeNodeId },
                      })}
                    />
                    <p className="context-inspector__help">Multiplicity is dynamic. Concrete workers appear only in runtime evidence.</p>
                  </Field>
                </>
              )}
              {edgeIsLoop && (
                <Field label="Loop cap">
                  <input
                    aria-label="Loop cap"
                    type="number"
                    min={1}
                    max={10}
                    value={edge.loopCap ?? ''}
                    disabled={!editable}
                    onChange={(event) => {
                      const value = event.target.value.trim();
                      updateEdge(edge.id, { loopCap: value ? Math.max(1, Math.min(10, Math.trunc(Number(value) || 1))) : undefined });
                    }}
                    className="input"
                    placeholder="Required for a loop containing Send"
                  />
                  <p className="context-inspector__help">Topology loops containing Send need an explicit cap from 1 through 10.</p>
                </Field>
              )}
            </div>
          </section>
          <section className="context-inspector__group context-inspector__group--tinted" aria-labelledby="edge-presentation-heading">
            <h3 id="edge-presentation-heading">Presentation</h3>
            <ul className="context-inspector__route-cues">
              <li>
                {edge.mode === 'conditional' && <GitBranch size={15} weight="bold" aria-hidden="true" />}
                {edge.mode === 'command' && <Lightning size={15} weight="fill" aria-hidden="true" />}
                {edge.mode === 'fallback' && <Shield size={15} weight="bold" aria-hidden="true" />}
                {edge.mode === 'send' && <GitBranch size={15} weight="bold" aria-hidden="true" />}
                <span>
                  {edge.mode === 'normal'
                    ? 'Edge'
                    : edge.mode === 'conditional'
                      ? 'Conditional edge'
                    : edge.mode === 'command'
                      ? 'Command'
                      : edge.mode === 'send'
                        ? 'Send ×N · dynamic worker template'
                        : 'Fallback'}
                </span>
              </li>
              {edge.mode === 'fallback' && (
                <li>
                  <Shield size={15} weight="bold" aria-hidden="true" />
                  <span>Fallback route: used after the source’s conditional routes do not match. One fallback is allowed per source.</span>
                </li>
              )}
              {edgeIsLoop && (
                <li>
                  <ArrowBendUpLeft size={15} weight="bold" aria-hidden="true" />
                  <span>Derived loop: this route returns to an earlier reachable node.</span>
                </li>
              )}
              {edgePreviewState && (
                <li>
                  <Shield size={15} weight="bold" aria-hidden="true" />
                  <span>Proposal preview: {edgePreviewState} route. Human approval or rejection is required.</span>
                </li>
              )}
              {graph.status === 'frozen' && (
                <li>
                  <LockSimple size={15} weight="bold" aria-hidden="true" />
                  <span>Frozen: this route is read-only.</span>
                </li>
              )}
            </ul>
          </section>
          <section className="context-inspector__group" aria-labelledby="edge-validation-heading">
            <h3 id="edge-validation-heading">Validation</h3>
            {edgeIssues.length > 0 ? (
              <div className="context-inspector__validation context-inspector__validation--invalid" role="alert">
                <WarningCircle size={16} weight="fill" aria-hidden="true" />
                <div>
                  <strong>Needs attention</strong>
                  <ul>
                    {edgeIssues.map((issue) => <li key={`${issue.code}-${issue.path}`}>{issue.message}</li>)}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="context-inspector__validation context-inspector__validation--valid" role="status">
                Valid route configuration.
              </p>
            )}
          </section>
          {!editable && (
            <p className="context-inspector__read-only" role="status">
              {readOnly
                ? 'Runtime projection is read-only. Switch to Design view to edit the accepted graph.'
                : proposal
                ? 'Proposal preview is read-only. A human must approve or reject the proposal before editing the accepted graph.'
                : 'Frozen contract: route editing is unavailable until the graph is unfrozen.'}
            </p>
          )}
          <div className="context-inspector__actions">
            <button disabled={!editable} onClick={() => removeEdge(edge.id)} className="danger-button">Remove edge</button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="context-inspector__field"><span>{label}</span><div>{children}</div></label>;
}
