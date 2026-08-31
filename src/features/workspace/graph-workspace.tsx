'use client';

import {
  Background,
  BackgroundVariant,
  Connection,
  ConnectionLineType,
  Controls,
  DefaultEdgeOptions,
  MiniMap,
  NodeMouseHandler,
  OnSelectionChangeParams,
  OnReconnect,
  ReactFlow,
  SelectionMode,
  EdgeMouseHandler,
  useReactFlow,
} from '@xyflow/react';
import { CSSProperties, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  canConnectCanvasEndpoints,
  canReconnectCanvasEdge,
  CanvasFlowEdge,
  domainEdgeIdsForCanvasEdge,
  evidenceMarkersForGraph,
  EvidenceMarker,
  isCanvasSystemRelationshipEdge,
  projectGraphToCanvas,
  proposalReviewToCanvasProjection,
} from '@/src/adapters/react-flow/project-graph';
import { getDocumentModelContext, registerWebMcpTools } from '@/src/adapters/webmcp/register-tools';
import { evaluateConnection } from '@/src/application/connection-policy';
import type { GraphLibraryEntry } from '@/src/application/graph-library-contract';
import { graphLibraryEntries } from '@/src/application/graph-library';
import { deriveProposalComparison } from '@/src/application/proposal-comparison';
import { NodeKind, validateGraph } from '@/src/domain';
import { AlignmentGuides } from '@/src/features/canvas/interactions/alignment-guides';
import { useCanvasInteractions } from '@/src/features/canvas/interactions/use-canvas-node-interactions';
import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import {
  ContractNode,
  type StepModifierPresentation,
} from '@/src/features/canvas/contract-node';
import { MergeNode } from '@/src/features/canvas/merge-node';
import { RuntimeInstanceNode, type RuntimeInstanceNodeData } from '@/src/features/canvas/runtime-instance-node';
import { RoutingEdge } from '@/src/features/canvas/routing-edge';
import { ExternalSystemTile } from '@/src/features/canvas/external-system-tile';
import { SystemRelationshipEdge } from '@/src/features/canvas/system-relationship-edge';
import {
  NodePalette,
  PaletteKind,
  PalettePayloadKind,
  normalizePalettePreset,
  readDroppedPaletteKind,
} from '@/src/features/canvas/node-palette';
import { SubgraphNode } from '@/src/features/canvas/subgraph-node';
import { useCoalescedFitView } from '@/src/features/canvas/use-coalesced-fit-view';
import {
  ContextInspector,
  type GraphSettingsRequest,
  type InspectorFocusRequest,
} from '@/src/features/inspector/context-inspector';
import { ProposalPanel } from '@/src/features/proposals/proposal-panel';
import { ScenarioPanel } from '@/src/features/scenarios/scenario-panel';
import { scenarioPresentationFor } from '@/src/features/scenarios/scenario-presentation';
import { GraphLibrarySheet } from '@/src/features/library/graph-library-sheet';
import {
  PanelExpandButton,
  PanelCollapseButton,
} from '@/src/features/workspace/panel-collapse-control';
import { PanelResizer } from '@/src/features/workspace/panel-resizer';
import { workspaceSelectionFromCanvas } from '@/src/features/workspace/canvas-selection';
import { useStableEvent } from '@/src/features/workspace/use-stable-event';
import { CanvasInstructionStrip, CanvasStatusStrip } from '@/src/features/workspace/canvas-chrome';
import { GraphCapabilityStrip } from '@/src/features/workspace/graph-capability-strip';
import { activeInspectorTabId, InspectorTabs } from '@/src/features/workspace/inspector-tabs';
import {
  resolveWorkspacePanelVisibility,
} from '@/src/features/workspace/panel-visibility';
import type { CompactPanelPreference } from '@/src/features/workspace/panel-visibility';
import { WebMcpStatus, WorkspaceHeader } from '@/src/features/workspace/workspace-header';
import { useMediaQuery } from '@/src/features/workspace/use-media-query';
import { runtimeProjectionAvailability } from '@/src/features/workspace/runtime-projection';
import {
  presentationModeAvailable,
  resolveWorkspacePresentationMode,
  type WorkspacePresentationMode,
} from '@/src/features/workspace/presentation-mode';
import {
  isDomainEdgeProjectedAsCollapsedProxy,
  useGraphStore,
} from '@/src/state/workspace-store';

import './graph-workspace.css';

const nodeTypes = {
  contractNode: ContractNode,
  mergeJunction: MergeNode,
  runtimeInstance: RuntimeInstanceNode,
  subgraph: SubgraphNode,
  externalSystemTile: ExternalSystemTile,
};
const edgeTypes = { routing: RoutingEdge, systemRelationship: SystemRelationshipEdge };
const snapGrid: [number, number] = [12, 12];
const panOnDrag = [1];
const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  pathOptions: { borderRadius: 16, offset: 28 },
};
const minimapColors: Record<NodeKind, string> = {
  start: '#34d399',
  step: '#64748b',
  merge: '#526477',
  end: '#52525b',
};

/**
 * Local canvas selections are not canonical workspace state. Keep only
 * selections whose projection targets still exist after a load, reset, or
 * proposal decision. Deliberately compare evidence by stable target identity,
 * never its marker number or render position.
 */
export function reconcileProjectionSelection(
  selectedEvidence: EvidenceMarker | null,
  selectedRelationshipId: string | null,
  evidenceMarkers: readonly EvidenceMarker[],
  relationships: readonly { id: string }[],
) {
  return {
    evidence: selectedEvidence && evidenceMarkers.some(
      (marker) => marker.target === selectedEvidence.target && marker.id === selectedEvidence.id,
    )
      ? selectedEvidence
      : null,
    relationshipId: selectedRelationshipId && relationships.some(
      (relationship) => relationship.id === selectedRelationshipId,
    )
      ? selectedRelationshipId
      : null,
  };
}

export function GraphWorkspace() {
  const graph = useGraphStore((state) => state.graph);
  const proposal = useGraphStore((state) => state.proposal);
  const scenarios = useGraphStore((state) => state.scenarios);
  const selection = useGraphStore((state) => state.selection);
  const notice = useGraphStore((state) => state.notice);
  const past = useGraphStore((state) => state.past);
  const future = useGraphStore((state) => state.future);
  const fitViewRevision = useGraphStore((state) => state.fitViewRevision);
  const autoLayout = useGraphStore((state) => state.autoLayout);
  const runtimeProjectionFixture = useGraphStore((state) => state.runtimeProjectionFixture);
  const addNode = useGraphStore((state) => state.addNode);
  const createSubgraph = useGraphStore((state) => state.createSubgraph);
  const moveCanvasElements = useGraphStore((state) => state.moveCanvasElements);
  const setSubgraphCollapsed = useGraphStore((state) => state.setSubgraphCollapsed);
  const addEdge = useGraphStore((state) => state.addEdge);
  const updateEdge = useGraphStore((state) => state.updateEdge);
  const setSelection = useGraphStore((state) => state.setSelection);
  const clearSelection = useGraphStore((state) => state.clearSelection);
  const deleteSelection = useGraphStore((state) => state.deleteSelection);
  const copySelection = useGraphStore((state) => state.copySelection);
  const pasteSelection = useGraphStore((state) => state.pasteSelection);
  const duplicateSelection = useGraphStore((state) => state.duplicateSelection);
  const undo = useGraphStore((state) => state.undo);
  const redo = useGraphStore((state) => state.redo);
  const approveProposal = useGraphStore((state) => state.approveProposal);
  const rejectProposal = useGraphStore((state) => state.rejectProposal);
  const freezeGraph = useGraphStore((state) => state.freezeGraph);
  const unfreezeGraph = useGraphStore((state) => state.unfreezeGraph);
  const resetGraph = useGraphStore((state) => state.resetGraph);
  const loadGraphLibraryEntry = useGraphStore((state) => state.loadGraphLibraryEntry);
  const loadResearchSupervisorDemo = useGraphStore((state) => state.loadResearchSupervisorDemo);
  const loadResearchIntakeRoutingDemo = useGraphStore((state) => state.loadResearchIntakeRoutingDemo);
  const loadHumanControlHitlDemo = useGraphStore((state) => state.loadHumanControlHitlDemo);
  const loadDynamicParallelismDemo = useGraphStore((state) => state.loadDynamicParallelismDemo);
  const clearNotice = useGraphStore((state) => state.clearNotice);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [webMcpStatus, setWebMcpStatus] = useState<WebMcpStatus>('unavailable');
  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(false);
  const [compactPanelPreference, setCompactPanelPreference] = useState<CompactPanelPreference>(null);
  const [paletteWidth, setPaletteWidth] = useState(232);
  const [inspectorWidth, setInspectorWidth] = useState(344);
  const [rightTab, setRightTab] = useState<'review' | 'scenarios'>('review');
  const [requestedPresentationMode, setRequestedPresentationMode] =
    useState<WorkspacePresentationMode>('design');
  const [runtimeSelection, setRuntimeSelection] = useState<RuntimeInstanceNodeData | null>(null);
  const [scenarioSelection, setScenarioSelection] = useState<{
    id: string;
    graphId: string;
    graphUpdatedAt: string;
  } | null>(null);
  // These are projection selections, deliberately absent from workspace history/persistence.
  const [evidenceOverlayVisible, setEvidenceOverlayVisible] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceMarker | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [inspectorFocusRequest, setInspectorFocusRequest] = useState<InspectorFocusRequest | null>(null);
  const [graphSettingsRequest, setGraphSettingsRequest] = useState<GraphSettingsRequest | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const clearProjectionSelection = useCallback(() => {
    setRuntimeSelection(null);
    setSelectedEvidence(null);
    setSelectedRelationshipId(null);
    setScenarioSelection(null);
  }, []);
  const isCompactWorkspace = useMediaQuery('(max-width: 1099px)');
  const stageRef = useRef<HTMLElement>(null);
  const reconnectingEdgeIdRef = useRef<string | null>(null);
  const graphSettingsRequestIdRef = useRef(0);
  const { screenToFlowPosition } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();

  const editable = graph.status === 'draft' && !proposal;
  const runtimeAvailability = useMemo(
    () => runtimeProjectionAvailability(graph, runtimeProjectionFixture),
    [graph, runtimeProjectionFixture],
  );
  const runtimeAvailable = runtimeAvailability.available && !proposal;
  const runtimeUnavailableReason = proposal
    ? 'Runtime view is unavailable while a proposal is awaiting human review.'
    : runtimeAvailability.available
      ? undefined
      : runtimeAvailability.reason;
  const presentationAvailability = useMemo(
    () => ({
      scenarioCount: scenarios.length,
      proposalPending: Boolean(proposal),
      runtimeAvailable,
    }),
    [proposal, runtimeAvailable, scenarios.length],
  );
  const activeViewMode = resolveWorkspacePresentationMode(
    requestedPresentationMode,
    presentationAvailability,
  );
  const selectedScenarioId = scenarioSelection?.graphId === graph.id &&
    scenarioSelection.graphUpdatedAt === graph.updatedAt &&
    scenarios.some((scenario) => scenario.id === scenarioSelection.id)
    ? scenarioSelection.id
    : null;
  const selectedScenario = selectedScenarioId
    ? scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null
    : null;
  const scenarioPresentation = useMemo(
    () => activeViewMode === 'scenario' ? scenarioPresentationFor(selectedScenario) : null,
    [activeViewMode, selectedScenario],
  );
  const canvasEditable = editable && activeViewMode === 'design';
  const proposalReview = useMemo(
    () => proposal ? deriveProposalComparison(graph, proposal) : null,
    [graph, proposal],
  );
  const reviewProjection = useMemo(
    () => proposalReviewToCanvasProjection(proposalReview),
    [proposalReview],
  );
  const acceptedReviewGraph = reviewProjection?.accepted ?? graph;
  const relationshipPreviewGraph = useMemo(
    () => reviewProjection?.kind === 'comparable'
      ? reviewProjection.candidate
      : acceptedReviewGraph,
    [acceptedReviewGraph, reviewProjection],
  );
  const relationshipOverlayGraph = useMemo(() => {
    if (relationshipPreviewGraph === acceptedReviewGraph) return acceptedReviewGraph;
    const previewIds = new Set(relationshipPreviewGraph.relationships.map((relationship) => relationship.id));
    return {
      ...relationshipPreviewGraph,
      // Base-only records are proposal removal ghosts. This projection-only
      // union keeps their evidence selectable without reviving them in state.
      relationships: [
        ...relationshipPreviewGraph.relationships,
        ...acceptedReviewGraph.relationships.filter((relationship) => !previewIds.has(relationship.id)),
      ],
    };
  }, [acceptedReviewGraph, relationshipPreviewGraph]);
  const evidenceMarkers = useMemo(
    () => relationshipOverlayGraph.capabilities.provenance.evidenceOverlayAvailable ? evidenceMarkersForGraph(relationshipOverlayGraph) : [],
    [relationshipOverlayGraph],
  );
  const evidenceMarkerByTarget = useMemo(
    () => new Map(evidenceMarkers.map((marker) => [`${marker.target}:${marker.id}`, marker])),
    [evidenceMarkers],
  );
  const selectedRelationship = selectedRelationshipId
    ? relationshipPreviewGraph.relationships.find((relationship) => relationship.id === selectedRelationshipId) ??
      acceptedReviewGraph.relationships.find((relationship) => relationship.id === selectedRelationshipId) ??
      null
    : null;
  const proposalId = proposal?.id ?? null;

  useEffect(() => {
    if (requestedPresentationMode === activeViewMode) return;
    // Deferring avoids a cascading render while ensuring an unavailable local
    // projection never re-enters after proposal, freeze, or evidence changes.
    queueMicrotask(() => {
      setRequestedPresentationMode(activeViewMode);
      setRuntimeSelection(null);
    });
  }, [activeViewMode, requestedPresentationMode]);

  useEffect(() => {
    const reconciled = reconcileProjectionSelection(
      selectedEvidence,
      selectedRelationshipId,
      evidenceMarkers,
      relationshipOverlayGraph.relationships,
    );
    if (reconciled.evidence === selectedEvidence && reconciled.relationshipId === selectedRelationshipId) return;
    // Replacement, approval, reset, and library/demo loading can invalidate
    // local-only projection selections. Defer to avoid a cascading render.
    queueMicrotask(() => {
      setSelectedEvidence((current) => reconcileProjectionSelection(
        current,
        null,
        evidenceMarkers,
        relationshipOverlayGraph.relationships,
      ).evidence);
      setSelectedRelationshipId((current) => reconcileProjectionSelection(
        null,
        current,
        evidenceMarkers,
        relationshipOverlayGraph.relationships,
      ).relationshipId);
    });
  }, [evidenceMarkers, relationshipOverlayGraph.relationships, selectedEvidence, selectedRelationshipId]);
  const openInspectorForSelection = useCallback(() => {
    setRightTab('review');
    setShowInspector(true);
    if (isCompactWorkspace) {
      setShowPalette(false);
      setCompactPanelPreference('inspector');
    }
  }, [isCompactWorkspace]);
  const activateEvidence = useCallback((target: EvidenceMarker['target'], id: string) => {
    const marker = evidenceMarkerByTarget.get(`${target}:${id}`);
    if (!marker) return;
    setRuntimeSelection(null);
    setSelectedEvidence(marker);
    if (target === 'relationship') {
      setSelectedRelationshipId(id);
      clearSelection();
    } else if (target === 'node') {
      setSelectedRelationshipId(null);
      setSelection({ nodeIds: [id], subgraphIds: [], edgeIds: [], primary: { type: 'node', id } });
    } else {
      setSelectedRelationshipId(null);
      setSelection({ nodeIds: [], subgraphIds: [], edgeIds: [id], primary: { type: 'edge', id } });
    }
    openInspectorForSelection();
  }, [clearSelection, evidenceMarkerByTarget, openInspectorForSelection, setSelection]);
  const selectSystemRelationship = useCallback((relationshipId: string) => {
    const relationship = relationshipPreviewGraph.relationships.find((candidate) => candidate.id === relationshipId) ??
      graph.relationships.find((candidate) => candidate.id === relationshipId);
    if (!relationship) return;
    setRuntimeSelection(null);
    setSelectedRelationshipId(relationship.id);
    setSelectedEvidence(
      evidenceOverlayVisible
        ? evidenceMarkerByTarget.get(`relationship:${relationship.id}`) ?? null
        : null,
    );
    clearSelection();
    openInspectorForSelection();
  }, [clearSelection, evidenceMarkerByTarget, evidenceOverlayVisible, graph.relationships, openInspectorForSelection, relationshipPreviewGraph.relationships]);
  const openGraphSettings = useCallback((tab: GraphSettingsRequest['tab'] = 'state') => {
    setRuntimeSelection(null);
    clearSelection();
    openInspectorForSelection();
    setInspectorFocusRequest(null);
    graphSettingsRequestIdRef.current += 1;
    setGraphSettingsRequest({ tab, requestId: graphSettingsRequestIdRef.current });
  }, [clearSelection, openInspectorForSelection]);
  const activateStepModifier = useCallback(
    (nodeId: string, modifier: StepModifierPresentation) => {
      // Projection owns the chip; workspace owns the accepted selection and
      // inspector navigation. Proposal-only ghost nodes intentionally remain
      // review-only because they are absent from the accepted graph.
      if (!graph.nodes.some((node) => node.id === nodeId && node.kind === 'step')) return;
      setSelection({
        nodeIds: [nodeId],
        subgraphIds: [],
        edgeIds: [],
        primary: { type: 'node', id: nodeId },
      });
      openInspectorForSelection();
      setInspectorFocusRequest({
        section: modifier.inspectorSection,
        requestId: Date.now(),
      });
    },
    [graph.nodes, openInspectorForSelection, setSelection],
  );
  const { inspectorVisible, paletteVisible } = resolveWorkspacePanelVisibility({
    compact: isCompactWorkspace,
    paletteRequested: showPalette,
    inspectorRequested: showInspector,
    compactPreference: compactPanelPreference,
    proposalPending: Boolean(proposal),
  });
  const inspectorTab = activeViewMode === 'scenario'
    ? 'scenarios'
    : proposal || selection.primary || selectedRelationship
      ? 'review'
      : rightTab;
  const inspectorSelectionKey = `${graph.status}:${proposal?.id ?? ''}:${activeViewMode}:${selection.primary?.type ?? ''}:${selection.primary?.id ?? ''}:${runtimeSelection?.runtimeId ?? ''}:${selectedRelationship?.id ?? ''}:${selectedEvidence?.number ?? ''}`;
  const toggleSubgraphCollapse = useCallback(
    (subgraphId: string, collapsed: boolean) => {
      if (canvasEditable) setSubgraphCollapsed(subgraphId, collapsed);
    },
    [canvasEditable, setSubgraphCollapsed],
  );
  const validationIssues = useMemo(() => validateGraph(graph), [graph]);
  const canvas = useMemo(() => {
    const projected = projectGraphToCanvas(graph, reviewProjection, {
      mode: activeViewMode === 'runtime' ? 'runtime' : 'design',
      runtimeFixture: runtimeProjectionFixture,
      scenarioPresentation,
    });
    return {
      ...projected,
      nodes: projected.nodes.map((node) => {
        if (node.type === 'subgraph') {
          return {
            ...node,
            data: {
              ...node.data,
              collapseEditable: canvasEditable,
              onToggleCollapse: canvasEditable ? toggleSubgraphCollapse : undefined,
            },
          };
        }
        return {
          ...node,
          data: {
            ...node.data,
            onModifierActivate: activateStepModifier,
            ...(evidenceOverlayVisible && evidenceMarkerByTarget.get(`node:${node.id}`)
              ? {
                  evidenceMarker: evidenceMarkerByTarget.get(`node:${node.id}`)!.number,
                  onEvidenceActivate: (nodeId: string) => activateEvidence('node', nodeId),
                }
              : {}),
          },
        };
      }),
      edges: projected.edges.map((edge) => {
        const target = isCanvasSystemRelationshipEdge(edge)
          ? `relationship:${edge.data.relationship.id}`
          : `edge:${edge.id}`;
        const marker = evidenceOverlayVisible ? evidenceMarkerByTarget.get(target) : undefined;
        if (isCanvasSystemRelationshipEdge(edge)) {
          return {
            ...edge,
            data: {
              ...edge.data,
              onRelationshipActivate: selectSystemRelationship,
              ...(marker
                ? {
                    evidenceMarker: marker.number,
                    onEvidenceActivate: (relationshipId: string) => activateEvidence('relationship', relationshipId),
                  }
                : {}),
            },
          };
        }
        if (!marker) return edge;
        return {
          ...edge,
          data: {
            ...edge.data,
            evidenceMarker: marker.number,
            onEvidenceActivate: (edgeId: string) => activateEvidence('edge', edgeId),
          },
        };
      }),
    };
  }, [
    activateStepModifier,
    canvasEditable,
    graph,
    reviewProjection,
    runtimeProjectionFixture,
    scenarioPresentation,
    toggleSubgraphCollapse,
    activeViewMode,
    activateEvidence,
    evidenceMarkerByTarget,
    evidenceOverlayVisible,
    selectSystemRelationship,
  ]);
  const canvasInteractions = useCanvasInteractions({
    projectedNodes: canvas.nodes,
    projectedEdges: canvas.edges,
    selectedNodeIds: selection.nodeIds,
    selectedEdgeIds: selection.edgeIds,
    editable: canvasEditable,
    onCommitPositions: moveCanvasElements,
  });
  const { clearRenderedSelection } = canvasInteractions;
  const resetPresentation = useCallback(
    (mode: Exclude<WorkspacePresentationMode, 'runtime'> = 'design') => {
      clearProjectionSelection();
      clearSelection();
      clearRenderedSelection();
      setRequestedPresentationMode(mode);
      setRightTab(mode === 'scenario' ? 'scenarios' : 'review');
      setInspectorFocusRequest(null);
      setGraphSettingsRequest(null);
    },
    [clearProjectionSelection, clearRenderedSelection, clearSelection],
  );
  useEffect(() => {
    if (!proposalId) return;
    queueMicrotask(() => {
      resetPresentation('proposal');
      setShowInspector(true);
      if (isCompactWorkspace) {
        setShowPalette(false);
        setCompactPanelPreference('inspector');
      }
    });
  }, [isCompactWorkspace, proposalId, resetPresentation]);
  const handleApproveProposal = useCallback(() => {
    const result = approveProposal();
    if (result.ok) resetPresentation();
  }, [approveProposal, resetPresentation]);
  const handleRejectProposal = useCallback(() => {
    rejectProposal();
    resetPresentation();
  }, [rejectProposal, resetPresentation]);
  const handleUnfreeze = useCallback(() => {
    unfreezeGraph();
    resetPresentation();
  }, [resetPresentation, unfreezeGraph]);
  const replaceWithDemo = useCallback((loadDemo: () => void) => {
    loadDemo();
    resetPresentation();
  }, [resetPresentation]);
  const handleReset = useCallback(() => {
    resetGraph();
    resetPresentation();
  }, [resetGraph, resetPresentation]);
  const currentLibraryEntryId = useMemo(
    () => graphLibraryEntries.find((entry) => entry.graph.id === graph.id)?.id ?? null,
    [graph.id],
  );
  const libraryBlockedReason = proposal
    ? 'Library replacement is blocked while a proposal awaits human review.'
    : graph.status === 'frozen'
      ? 'Unfreeze the contract before opening a library graph.'
      : null;
  const handleOpenLibraryEntry = useCallback(
    (entry: GraphLibraryEntry) => {
      if (libraryBlockedReason) return;
      const nonEmptyGraph = graph.nodes.length > 0 || graph.edges.length > 0 || graph.subgraphs.length > 0;
      if (
        nonEmptyGraph &&
        !window.confirm(
          `Replace the current canvas with “${entry.title}”? This opens an editable normalized template; one Undo restores your current workflow.`,
        )
      ) {
        return;
      }
      if (!loadGraphLibraryEntry(entry)) return;
      resetPresentation();
      setLibraryOpen(false);
    },
    [graph.edges.length, graph.nodes.length, graph.subgraphs.length, libraryBlockedReason, loadGraphLibraryEntry, resetPresentation],
  );
  const fitPadding = useMemo(
    () => ({
      top: '110px' as const,
      right: `${!isCompactWorkspace && inspectorVisible ? inspectorWidth + 32 : 32}px` as const,
      bottom: '94px' as const,
      left: `${!isCompactWorkspace && paletteVisible ? paletteWidth + 32 : 32}px` as const,
    }),
    [inspectorVisible, inspectorWidth, isCompactWorkspace, paletteVisible, paletteWidth],
  );
  const { fitGraph } = useCoalescedFitView<CanvasFlowNode, CanvasFlowEdge>({
    enabled: hasHydrated,
    revision: fitViewRevision,
    padding: fitPadding,
  });

  useEffect(() => {
    void Promise.resolve(useGraphStore.persist.rehydrate()).then(() => setHasHydrated(true));
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    const modelContext = getDocumentModelContext();
    if (!modelContext) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) setWebMcpStatus('registering');
    });
    void registerWebMcpTools(
      modelContext,
      {
        getSnapshot: () => {
          const state = useGraphStore.getState();
          return { graph: state.graph, proposal: state.proposal, scenarios: state.scenarios };
        },
        submitProposal: (input) => useGraphStore.getState().submitProposal(input),
      },
      controller.signal,
    )
      .then(() => setWebMcpStatus('connected'))
      .catch(() => {
        if (!controller.signal.aborted) setWebMcpStatus('error');
      });
    return () => controller.abort();
  }, [hasHydrated]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(clearNotice, 4000);
    return () => window.clearTimeout(timeout);
  }, [notice, clearNotice]);

  const togglePalette = () => {
    const next = !paletteVisible;
    if (next && isCompactWorkspace) {
      setShowInspector(false);
      setCompactPanelPreference('palette');
    } else if (!next) {
      setCompactPanelPreference(null);
    }
    setShowPalette(next);
  };

  const toggleInspector = () => {
    const next = !inspectorVisible;
    if (next && isCompactWorkspace) {
      setShowPalette(false);
      setCompactPanelPreference('inspector');
    } else if (!next) {
      setCompactPanelPreference(null);
    }
    setShowInspector(next);
  };

  const closePalette = () => {
    setShowPalette(false);
    setCompactPanelPreference(null);
  };

  const closeInspector = () => {
    setShowInspector(false);
    setCompactPanelPreference(null);
  };

  const handleInspectorTabChange = useCallback(
    (tab: 'review' | 'scenarios') => {
      setRightTab(tab);
      if (tab === 'scenarios') {
        setRuntimeSelection(null);
        clearSelection();
        clearRenderedSelection();
        if (scenarios.length > 0 && !proposal) setRequestedPresentationMode('scenario');
      } else if (activeViewMode === 'scenario') {
        setScenarioSelection(null);
        setRequestedPresentationMode('design');
      }
    },
    [activeViewMode, clearRenderedSelection, clearSelection, proposal, scenarios.length],
  );

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (!canvasEditable) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (command && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelection();
      } else if (command && event.key.toLowerCase() === 'c') {
        copySelection();
      } else if (command && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteSelection();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [canvasEditable, copySelection, deleteSelection, duplicateSelection, pasteSelection, redo, undo]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        canvasEditable &&
        connection.source &&
        connection.target &&
        canConnectCanvasEndpoints(canvas.nodes, connection.source, connection.target) &&
        evaluateConnection(graph, connection).valid
      ) {
        addEdge(connection.source, connection.target);
      }
    },
    [addEdge, canvas.nodes, canvasEditable, graph],
  );

  const isValidConnection = useCallback(
    (connection: Connection) =>
      canvasEditable &&
      canConnectCanvasEndpoints(canvas.nodes, connection.source, connection.target) &&
      evaluateConnection(graph, connection, {
        reconnectingEdgeId: reconnectingEdgeIdRef.current,
      }).valid,
    [canvas.nodes, canvasEditable, graph],
  );

  const onReconnect = useCallback<OnReconnect<CanvasFlowEdge>>(
    (edge, connection) => {
      if (
        !canvasEditable ||
        !canReconnectCanvasEdge(edge) ||
        !connection.source ||
        !connection.target ||
        !canConnectCanvasEndpoints(canvas.nodes, connection.source, connection.target)
      ) {
        return;
      }
      const [domainEdgeId] = domainEdgeIdsForCanvasEdge(edge);
      if (
        domainEdgeId &&
        evaluateConnection(graph, connection, { reconnectingEdgeId: domainEdgeId }).valid
      ) {
        updateEdge(domainEdgeId, { source: connection.source, target: connection.target });
      }
    },
    [canvas.nodes, canvasEditable, graph, updateEdge],
  );

  const handleSelectionChange = useStableEvent(
    ({ nodes, edges }: OnSelectionChangeParams<CanvasFlowNode, CanvasFlowEdge>) => {
      const selectedSystemRelationship = edges.find(isCanvasSystemRelationshipEdge);
      if (selectedSystemRelationship) {
        selectSystemRelationship(selectedSystemRelationship.data.relationship.id);
        return;
      }
      const selectedRuntimeNode = nodes.find(
        (node): node is Extract<CanvasFlowNode, { type: 'runtimeInstance' }> =>
          node.type === 'runtimeInstance',
      );
      setRuntimeSelection(selectedRuntimeNode?.data ?? null);
      setSelectedRelationshipId(null);
      const nextSelection = workspaceSelectionFromCanvas(
        nodes,
        edges,
        useGraphStore.getState().selection.primary,
      );
      if (nextSelection.primary || selectedRuntimeNode) {
        openInspectorForSelection();
      }
      if (nextSelection.primary?.type === 'node' && evidenceOverlayVisible) {
        setSelectedEvidence(evidenceMarkerByTarget.get(`node:${nextSelection.primary.id}`) ?? null);
      } else if (nextSelection.primary?.type === 'edge' && evidenceOverlayVisible) {
        setSelectedEvidence(evidenceMarkerByTarget.get(`edge:${nextSelection.primary.id}`) ?? null);
      } else {
        setSelectedEvidence(null);
      }
      setSelection(nextSelection);
    },
  );

  const makePrimary = useCallback((primary: { type: 'node' | 'edge' | 'subgraph'; id: string }) => {
    queueMicrotask(() => {
      const currentSelection = useGraphStore.getState().selection;
      const stillSelected =
        primary.type === 'node'
          ? currentSelection.nodeIds.includes(primary.id)
          : primary.type === 'subgraph'
            ? currentSelection.subgraphIds.includes(primary.id)
          : currentSelection.edgeIds.includes(primary.id);
      if (!stillSelected) return;
      useGraphStore.getState().setSelection({ ...currentSelection, primary });
    });
  }, []);

  const handleNodeClick = useCallback<NodeMouseHandler<CanvasFlowNode>>(
    (_, node) => {
      if (node.type === 'runtimeInstance') {
        setRuntimeSelection(node.data);
        openInspectorForSelection();
        return;
      }
      setRuntimeSelection(null);
      setSelectedRelationshipId(null);
      makePrimary({ type: node.type === 'subgraph' ? 'subgraph' : 'node', id: node.id });
    },
    [makePrimary, openInspectorForSelection],
  );

  const handleEdgeClick = useCallback<EdgeMouseHandler<CanvasFlowEdge>>(
    (_, edge) => {
      if (isCanvasSystemRelationshipEdge(edge)) {
        selectSystemRelationship(edge.data.relationship.id);
        return;
      }
      const [domainEdgeId] = domainEdgeIdsForCanvasEdge(edge);
      if (domainEdgeId) makePrimary({ type: 'edge', id: domainEdgeId });
    },
    [makePrimary, selectSystemRelationship],
  );

  const addPalettePayload = useCallback(
    (payload: PalettePayloadKind, position: { x: number; y: number }) => {
      const kind = normalizePalettePreset(payload);
      if (!kind || !canvasEditable) return;
      if (kind === 'subgraph') {
        createSubgraph({ position });
        openInspectorForSelection();
        return;
      }
      addNode(kind, position);
    },
    [addNode, canvasEditable, createSubgraph, openInspectorForSelection],
  );

  const addAtCenter = useCallback(
    (kind: PaletteKind) => {
      const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      addPalettePayload(kind, position);
    },
    [addPalettePayload, screenToFlowPosition],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const payload = readDroppedPaletteKind(event);
      if (!payload) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addPalettePayload(payload, position);
    },
    [addPalettePayload, screenToFlowPosition],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = canvasEditable ? 'move' : 'none';
  }, [canvasEditable]);

  const onReconnectStart = useCallback((_: unknown, edge: CanvasFlowEdge) => {
    reconnectingEdgeIdRef.current = edge.id;
  }, []);

  const onReconnectEnd = useCallback(() => {
    reconnectingEdgeIdRef.current = null;
  }, []);

  const handleFreeze = () => {
    const result = freezeGraph();
    if (result.ok) {
      resetPresentation('scenario');
      setShowInspector(true);
      if (isCompactWorkspace) {
        setShowPalette(false);
        setCompactPanelPreference('inspector');
      }
    }
  };

  if (!hasHydrated) {
    return (
      <main className="grid h-dvh place-items-center bg-[#f7f8f6] text-[#171918]">
        <div className="text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#18211d] text-sm font-bold text-white">GC</div>
          <p className="mt-3 text-xs font-semibold text-black/50">Opening your workflow workspace…</p>
        </div>
      </main>
    );
  }

  const selectionCount =
    selection.nodeIds.length + selection.subgraphIds.length + selection.edgeIds.length + (runtimeSelection ? 1 : 0) + (selectedRelationship ? 1 : 0);
  const hasDeletableSelection =
    selection.nodeIds.length > 0 ||
    selection.subgraphIds.length > 0 ||
    selection.edgeIds.some((edgeId) => !isDomainEdgeProjectedAsCollapsedProxy(graph, edgeId));
  const stageStyle = {
    '--palette-width': `${paletteWidth}px`,
    '--inspector-width': `${inspectorWidth}px`,
  } as CSSProperties;

  return (
    <main className="workspace-root">
      <section
        ref={stageRef}
        className="workspace-stage"
        style={stageStyle}
        data-palette-open={paletteVisible}
        data-inspector-open={inspectorVisible}
      >
        <WorkspaceHeader
          graphName={graph.name}
          graphStatus={graph.status}
          webMcpStatus={webMcpStatus}
          nodeCount={graph.nodes.length}
          edgeCount={graph.edges.length}
          issueCount={validationIssues.length}
          proposalPending={Boolean(proposal)}
          libraryOpen={libraryOpen}
          libraryEntryCount={graphLibraryEntries.length}
          paletteOpen={paletteVisible}
          inspectorOpen={inspectorVisible}
          canUndo={canvasEditable && past.length > 0}
          canRedo={canvasEditable && future.length > 0}
          canDuplicate={canvasEditable && selection.nodeIds.length > 0}
          canDelete={canvasEditable && hasDeletableSelection}
          canFreeze={validationIssues.length === 0 && !proposal}
          canAutoLayout={editable}
          scenarioCount={scenarios.length}
          viewMode={activeViewMode}
          runtimeAvailable={runtimeAvailable}
          runtimeUnavailableReason={runtimeUnavailableReason}
          onTogglePalette={togglePalette}
          onToggleInspector={toggleInspector}
          onOpenLibrary={() => setLibraryOpen(true)}
          onUndo={undo}
          onRedo={redo}
          onDuplicate={duplicateSelection}
          onDelete={deleteSelection}
          onAutoLayout={autoLayout}
          onFit={fitGraph}
          onReset={handleReset}
          onFreeze={handleFreeze}
          onUnfreeze={handleUnfreeze}
          onViewModeChange={(mode) => {
            if (!presentationModeAvailable(mode, presentationAvailability)) return;
            setRuntimeSelection(null);
            setSelectedEvidence(null);
            setSelectedRelationshipId(null);
            clearSelection();
            clearRenderedSelection();
            setRequestedPresentationMode(mode);
            if (mode === 'scenario') {
              setRightTab('scenarios');
              setShowInspector(true);
            } else if (mode === 'proposal') {
              setRightTab('review');
              setShowInspector(true);
            }
          }}
        />

        {notice && <div className="workspace-notice">{notice}</div>}

        {paletteVisible && (
          <div className="workspace-palette-slot">
            <NodePalette
              graph={graph}
              proposal={proposal}
              disabled={!canvasEditable}
              readOnlyReason={
                activeViewMode === 'runtime'
                  ? 'Runtime projection is read-only. Switch to Design view to add or edit contract elements.'
                  : undefined
              }
              validationIssueCount={validationIssues.length}
              onAdd={addAtCenter}
              onLoadResearchSupervisorDemo={() => replaceWithDemo(loadResearchSupervisorDemo)}
              onLoadResearchIntakeRoutingDemo={() => replaceWithDemo(loadResearchIntakeRoutingDemo)}
              onLoadHumanControlHitlDemo={() => replaceWithDemo(loadHumanControlHitlDemo)}
              onLoadDynamicParallelismDemo={() => replaceWithDemo(loadDynamicParallelismDemo)}
              onCollapse={closePalette}
            />
            <PanelResizer
              side="left"
              cssVariable="--palette-width"
              min={196}
              max={320}
              defaultValue={232}
              onCommit={setPaletteWidth}
              targetRef={stageRef}
              ariaLabel="Resize node inventory"
            />
          </div>
        )}
        <section className="workspace-canvas">
          {!paletteVisible && (
            <PanelExpandButton
              side="left"
              label="Palette"
              onExpand={togglePalette}
            />
          )}
          {!inspectorVisible && (
            <PanelExpandButton
              side="right"
              label="Inspector"
              onExpand={toggleInspector}
            />
          )}
          <GraphCapabilityStrip
            graph={relationshipPreviewGraph}
            onOpenSettings={openGraphSettings}
            evidenceOverlayVisible={evidenceOverlayVisible}
            onToggleEvidenceOverlay={() => {
              if (!relationshipPreviewGraph.capabilities.provenance.evidenceOverlayAvailable) return;
              setEvidenceOverlayVisible((visible) => !visible);
              setSelectedEvidence(null);
            }}
          />
          {evidenceOverlayVisible && (
            <aside className="workspace-evidence-legend" aria-label="Evidence overlay legend">
              <strong>Evidence overlay</strong>
              <span>Numbered markers open supplied evidence; they do not change topology.</span>
              <ul>
                <li data-provenance="declared">Declared</li>
                <li data-provenance="runtime-generated">Runtime generated</li>
                <li data-provenance="derived-semantic">Derived semantic</li>
                <li data-provenance="external-orchestration">External orchestration</li>
              </ul>
            </aside>
          )}
          <ReactFlow<CanvasFlowNode, CanvasFlowEdge>
            nodes={canvasInteractions.nodes}
            edges={canvasInteractions.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={canvasInteractions.onNodesChange}
            onEdgesChange={canvasInteractions.onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onReconnect={onReconnect}
            onReconnectStart={onReconnectStart}
            onReconnectEnd={onReconnectEnd}
            onSelectionChange={handleSelectionChange}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={() => {
              setRuntimeSelection(null);
              setSelectedEvidence(null);
              setSelectedRelationshipId(null);
              clearSelection();
            }}
            onNodeDragStart={canvasInteractions.onNodeDragStart}
            onNodeDrag={canvasInteractions.onNodeDrag}
            onNodeDragStop={canvasInteractions.onNodeDragStop}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodesDraggable={canvasEditable}
            nodesConnectable={canvasEditable}
            edgesReconnectable={canvasEditable}
            elementsSelectable={activeViewMode !== 'scenario'}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnScroll
            panOnDrag={panOnDrag}
            autoPanOnNodeDrag
            autoPanOnConnect
            autoPanOnSelection
            autoPanSpeed={18}
            connectionRadius={24}
            nodeDragThreshold={2}
            connectionDragThreshold={3}
            connectionLineType={ConnectionLineType.SmoothStep}
            defaultEdgeOptions={defaultEdgeOptions}
            zoomOnDoubleClick={false}
            selectionKeyCode="Shift"
            multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
            snapToGrid
            snapGrid={snapGrid}
            minZoom={0.18}
            maxZoom={2.5}
            deleteKeyCode={null}
          >
            <AlignmentGuides guides={canvasInteractions.guides} />
            <Background variant={BackgroundVariant.Lines} gap={24} size={1} color="#e2e6e1" />
            <MiniMap
              pannable
              zoomable
              position="bottom-left"
              nodeColor={(node) =>
                node.type === 'contractNode'
                  ? minimapColors[node.data.kind] ?? '#94a3b8'
                  : node.type === 'mergeJunction'
                    ? '#526477'
                    : node.type === 'runtimeInstance'
                      ? '#5969c8'
                      : '#5c8f7d'
              }
              nodeStrokeColor="#ffffff"
              nodeStrokeWidth={2}
              nodeBorderRadius={10}
              maskColor="rgb(24 33 29 / 7%)"
              className="canvas-minimap"
            />
            <Controls
              showInteractive={false}
              position="bottom-right"
              className="canvas-flow-controls"
            />
          </ReactFlow>

          <CanvasInstructionStrip editable={canvasEditable} runtimeMode={activeViewMode === 'runtime'} />
          <CanvasStatusStrip
            graph={graph}
            issueCount={validationIssues.length}
            selectionCount={selectionCount}
            proposalPending={Boolean(proposal)}
            scenarioCount={scenarios.length}
          />

          {proposal && <div className="workspace-proposal-banner">Proposal preview · accepted graph locked and unchanged</div>}
          {graph.status === 'frozen' && <div className="workspace-frozen-banner">Frozen contract · {scenarios.length} paths</div>}
        </section>

        {inspectorVisible && (
          <aside className="workspace-panel workspace-inspector-panel">
            <div className="flex items-center gap-2">
              <InspectorTabs
                active={inspectorTab}
                scenarioCount={scenarios.length}
                onChange={handleInspectorTabChange}
              />
              <PanelCollapseButton
                side="right"
                onCollapse={closeInspector}
                label="Collapse inspector"
              />
            </div>
            <div
              id="graph-inspector-tabpanel"
              role="tabpanel"
              aria-labelledby={activeInspectorTabId(inspectorTab)}
              className="workspace-inspector-content"
            >
              {inspectorTab === 'review' ? <div className="space-y-3"><ContextInspector key={inspectorSelectionKey} focusRequest={inspectorFocusRequest} graphSettingsRequest={graphSettingsRequest} runtimeInstance={activeViewMode === 'runtime' ? runtimeSelection : null} relationship={selectedRelationship} evidence={selectedEvidence} reviewProjection={reviewProjection} readOnly={activeViewMode !== 'design'} /><ProposalPanel proposal={proposal} review={proposalReview} onApprove={handleApproveProposal} onReject={handleRejectProposal} /></div> : <ScenarioPanel graph={graph} scenarios={scenarios} selectedScenarioId={selectedScenarioId} onScenarioSelect={(scenarioId) => setScenarioSelection(scenarioId ? { id: scenarioId, graphId: graph.id, graphUpdatedAt: graph.updatedAt } : null)} />}
            </div>
            <PanelResizer
              side="right"
              cssVariable="--inspector-width"
              min={300}
              max={460}
              defaultValue={344}
              onCommit={setInspectorWidth}
              targetRef={stageRef}
              ariaLabel="Resize inspector"
            />
          </aside>
        )}
      </section>
      <GraphLibrarySheet
        open={libraryOpen}
        entries={graphLibraryEntries}
        currentLoadedId={currentLibraryEntryId}
        replacementBlockedReason={libraryBlockedReason}
        onRequestOpen={handleOpenLibraryEntry}
        onClose={() => setLibraryOpen(false)}
      />
    </main>
  );
}
