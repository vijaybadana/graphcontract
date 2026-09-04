'use client';

import {
  Background,
  BackgroundVariant,
  Connection,
  ConnectionLineType,
  ControlButton,
  Controls,
  DefaultEdgeOptions,
  NodeMouseHandler,
  OnSelectionChangeParams,
  OnReconnect,
  ReactFlow,
  SelectionMode,
  EdgeMouseHandler,
  useReactFlow,
} from '@xyflow/react';
import { FrameCorners } from '@phosphor-icons/react';
import { CSSProperties, DragEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

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
import { subgraphResizeLimits } from '@/src/application/subgraph-resize';
import { dynamicWorkerGroupResizeLimits } from '@/src/application/dynamic-worker-layout';
import { validateGraph } from '@/src/domain';
import { AlignmentGuides } from '@/src/features/canvas/interactions/alignment-guides';
import { useCanvasInteractions } from '@/src/features/canvas/interactions/use-canvas-node-interactions';
import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import { type StepModifierPresentation } from '@/src/features/canvas/contract-node';
import type { RuntimeInstanceNodeData } from '@/src/features/canvas/runtime-instance-node';
import { canvasEdgeTypes, canvasNodeTypes } from '@/src/features/canvas/canvas-render-registry';
import {
  NodePalette,
  PaletteKind,
  PalettePayloadKind,
  normalizePalettePreset,
  readDroppedPaletteKind,
} from '@/src/features/canvas/node-palette';
import { useCoalescedFitView } from '@/src/features/canvas/use-coalesced-fit-view';
import {
  ContextInspector,
  type GraphSettingsRequest,
  type InspectorFocusRequest,
} from '@/src/features/inspector/context-inspector';
import { ProposalPanel } from '@/src/features/proposals/proposal-panel';
import {
  proposalReviewEntries,
} from '@/src/features/proposals/proposal-overview';
import {
  proposalCanvasFocusFor,
  proposalInitialCanvasFitNodeIds,
} from '@/src/features/proposals/proposal-canvas-focus';
import { ScenarioPanel } from '@/src/features/scenarios/scenario-panel';
import { scenarioPresentationFor } from '@/src/features/scenarios/scenario-presentation';
import { GraphLibrarySheet } from '@/src/features/library/graph-library-sheet';
import {
  PanelExpandButton,
} from '@/src/features/workspace/panel-collapse-control';
import { PanelResizer } from '@/src/features/workspace/panel-resizer';
import { workspaceSelectionFromCanvas } from '@/src/features/workspace/canvas-selection';
import { useStableEvent } from '@/src/features/workspace/use-stable-event';
import { CanvasStatusStrip } from '@/src/features/workspace/canvas-chrome';
import { GraphOverview } from '@/src/features/workspace/graph-overview';
import {
  resolveWorkspacePanelVisibility,
} from '@/src/features/workspace/panel-visibility';
import type { CompactPanelPreference } from '@/src/features/workspace/panel-visibility';
import { WebMcpStatus, WorkspaceHeader } from '@/src/features/workspace/workspace-header';
import { RuntimeModePanel } from '@/src/features/workspace/runtime-mode-panel';
import { useMediaQuery } from '@/src/features/workspace/use-media-query';
import { runtimeProjectionAvailability } from '@/src/features/workspace/runtime-projection';
import {
  currentWorkspaceTheme,
  setWorkspaceTheme,
  subscribeWorkspaceTheme,
  type WorkspaceTheme,
} from '@/src/features/workspace/workspace-theme';
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
import '@/src/features/proposals/proposal-canvas-focus.css';
import { CanvasReviewFocusProvider } from '@/src/features/canvas/canvas-review-focus';

const snapGrid: [number, number] = [12, 12];
const panOnDrag = [1];
// Manual navigation may pull back farther than automatic fit/focus actions.
// Those actions keep their separate readability floors below.
const canvasMinZoom = 0.08;
const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  pathOptions: { borderRadius: 16, offset: 28 },
};
type ProjectionFitRequest = {
  key: string;
  mode: 'design' | 'proposal';
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
  const layoutPending = useGraphStore((state) => state.layoutPending);
  const reviewRequest = useGraphStore((state) => state.reviewRequest ?? null);
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
  const moveDynamicWorkerGroup = useGraphStore((state) => state.moveDynamicWorkerGroup);
  const resizeDynamicWorkerGroup = useGraphStore((state) => state.resizeDynamicWorkerGroup);
  const setSubgraphCollapsed = useGraphStore((state) => state.setSubgraphCollapsed);
  const updateSubgraph = useGraphStore((state) => state.updateSubgraph);
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
  const requestProposalChanges = useGraphStore((state) => state.requestProposalChanges);
  const rejectProposal = useGraphStore((state) => state.rejectProposal);
  const freezeGraph = useGraphStore((state) => state.freezeGraph);
  const unfreezeGraph = useGraphStore((state) => state.unfreezeGraph);
  const resetGraph = useGraphStore((state) => state.resetGraph);
  const loadGraphLibraryEntry = useGraphStore((state) => state.loadGraphLibraryEntry);
  const clearNotice = useGraphStore((state) => state.clearNotice);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [webMcpStatus, setWebMcpStatus] = useState<WebMcpStatus>('unavailable');
  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(false);
  const [compactPanelPreference, setCompactPanelPreference] = useState<CompactPanelPreference>(null);
  const [paletteWidth, setPaletteWidth] = useState(232);
  const [inspectorWidth, setInspectorWidth] = useState(344);
  const [requestedPresentationMode, setRequestedPresentationMode] =
    useState<WorkspacePresentationMode>('design');
  const [runtimeSelection, setRuntimeSelection] = useState<RuntimeInstanceNodeData | null>(null);
  const [scenarioSelection, setScenarioSelection] = useState<{
    id: string;
    graphId: string;
    graphUpdatedAt: string;
  } | null>(null);
  // These are projection selections, deliberately absent from workspace history/persistence.
  const [evidenceOverlayVisible] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceMarker | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [proposalFocusEntryKey, setProposalFocusEntryKey] = useState<string | null>(null);
  const [projectionFitRequest, setProjectionFitRequest] = useState<ProjectionFitRequest | null>(null);
  const [inspectorFocusRequest, setInspectorFocusRequest] = useState<InspectorFocusRequest | null>(null);
  const [graphSettingsRequest, setGraphSettingsRequest] = useState<GraphSettingsRequest | null>(null);
  const [renderedSelectionRequest, setRenderedSelectionRequest] = useState<{
    nodeIds: string[];
    edgeIds: string[];
    requestId: number;
  } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const theme = useSyncExternalStore<WorkspaceTheme>(
    subscribeWorkspaceTheme,
    currentWorkspaceTheme,
    () => 'classic',
  );
  const clearProjectionSelection = useCallback(() => {
    setRuntimeSelection(null);
    setSelectedEvidence(null);
    setSelectedRelationshipId(null);
    setScenarioSelection(null);
    setProposalFocusEntryKey(null);
  }, []);
  const isCompactWorkspace = useMediaQuery('(max-width: 1099px)');
  const stageRef = useRef<HTMLElement>(null);
  const reconnectingEdgeIdRef = useRef<string | null>(null);
  const completedProjectionFitKeyRef = useRef<string | null>(null);
  const {
    fitView,
    screenToFlowPosition,
  } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();

  const changeTheme = useCallback((nextTheme: WorkspaceTheme) => {
    setWorkspaceTheme(nextTheme);
  }, []);

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
  const proposalEntries = useMemo(
    () => proposalReview?.kind === 'comparable'
      ? proposalReviewEntries(proposalReview, false)
      : [],
    [proposalReview],
  );
  const proposalInitialFitNodeIds = useMemo(() => {
    return proposalInitialCanvasFitNodeIds(proposalReview);
  }, [proposalReview]);
  const proposalEntryByKey = useMemo(
    () => new Map(proposalEntries.map((entry) => [entry.key, entry])),
    [proposalEntries],
  );
  const proposalFocusEntry = proposalFocusEntryKey
    ? proposalEntryByKey.get(proposalFocusEntryKey) ?? null
    : null;
  const proposalCanvasFocus = useMemo(
    () => proposalCanvasFocusFor(
      proposalFocusEntry,
      proposalReview?.kind === 'comparable'
        ? [proposalReview.base, proposalReview.candidate]
        : [graph],
    ),
    [graph, proposalFocusEntry, proposalReview],
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
  const selectSystemRelationship = useCallback((relationshipId: string, revealInspector = true) => {
    if (activeViewMode === 'proposal') {
      const proposalEntry = proposalEntryByKey.get(`relationships:${relationshipId}`);
      if (proposalEntry?.entry.state !== 'unchanged') {
        setProposalFocusEntryKey(proposalEntry.key);
      }
      return;
    }
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
    if (revealInspector) openInspectorForSelection();
  }, [activeViewMode, clearSelection, evidenceMarkerByTarget, evidenceOverlayVisible, graph.relationships, openInspectorForSelection, proposalEntryByKey, relationshipPreviewGraph.relationships]);
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
  const activateDynamicWorkerTemplate = useCallback(
    (nodeId: string) => {
      if (!graph.nodes.some((node) => node.id === nodeId && node.kind === 'step')) return;
      setSelection({
        nodeIds: [nodeId],
        subgraphIds: [],
        edgeIds: [],
        primary: { type: 'node', id: nodeId },
      });
      setRenderedSelectionRequest({
        nodeIds: [nodeId],
        edgeIds: [],
        requestId: Date.now(),
      });
      openInspectorForSelection();
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
  const inspectorSelectionKey = `${graph.status}:${proposal?.id ?? ''}:${activeViewMode}:${selection.primary?.type ?? ''}:${selection.primary?.id ?? ''}:${runtimeSelection?.runtimeId ?? ''}:${selectedRelationship?.id ?? ''}:${selectedEvidence?.number ?? ''}`;
  const toggleSubgraphCollapse = useCallback(
    (subgraphId: string, collapsed: boolean) => {
      if (canvasEditable) setSubgraphCollapsed(subgraphId, collapsed);
    },
    [canvasEditable, setSubgraphCollapsed],
  );
  const resizeSubgraph = useCallback(
    (subgraphId: string, dimensions: { width: number; height: number }) => {
      if (canvasEditable) updateSubgraph(subgraphId, { dimensions });
    },
    [canvasEditable, updateSubgraph],
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
        if (node.type === 'dynamicWorkerGroup') {
          return {
            ...node,
            data: {
              ...node.data,
              onActivate: activateDynamicWorkerTemplate,
              layoutEditable: canvasEditable,
              active: selection.nodeIds.includes(node.data.templateNodeId),
              resizeLimits: canvasEditable
                ? dynamicWorkerGroupResizeLimits(graph, node.data.sendEdgeId)
                : undefined,
              onResize: canvasEditable ? resizeDynamicWorkerGroup : undefined,
            },
          };
        }
        const reviewFocusState = proposalCanvasFocus
          ? proposalCanvasFocus.nodeIds.includes(node.id) ? 'active' : 'dimmed'
          : null;
        if (node.type === 'subgraph') {
          return {
            ...node,
            selected: reviewFocusState === 'active',
            data: {
              ...node.data,
              collapseEditable: canvasEditable,
              onToggleCollapse: canvasEditable ? toggleSubgraphCollapse : undefined,
              resizeLimits: canvasEditable ? subgraphResizeLimits(graph, node.id) : undefined,
              onResize: canvasEditable ? resizeSubgraph : undefined,
            },
          };
        }
        return {
          ...node,
          selected: reviewFocusState === 'active',
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
        const reviewFocusState = proposalCanvasFocus
          ? isCanvasSystemRelationshipEdge(edge)
            ? edge.data.relationship.id === proposalCanvasFocus.relationshipId ? 'active' : 'dimmed'
            : domainEdgeIdsForCanvasEdge(edge).some((id) => proposalCanvasFocus.edgeIds.includes(id))
              ? 'active'
              : 'dimmed'
          : null;
        if (isCanvasSystemRelationshipEdge(edge)) {
          return {
            ...edge,
            selected: reviewFocusState === 'active',
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
        return {
          ...edge,
          selected: reviewFocusState === 'active',
          data: {
            ...edge.data,
            ...(marker ? {
              evidenceMarker: marker.number,
              onEvidenceActivate: (edgeId: string) => activateEvidence('edge', edgeId),
            } : {}),
          },
        };
      }),
    };
  }, [
    activateDynamicWorkerTemplate,
    activateStepModifier,
    canvasEditable,
    graph,
    reviewProjection,
    runtimeProjectionFixture,
    scenarioPresentation,
    toggleSubgraphCollapse,
    resizeSubgraph,
    activeViewMode,
    activateEvidence,
    evidenceMarkerByTarget,
    evidenceOverlayVisible,
    proposalCanvasFocus,
    resizeDynamicWorkerGroup,
    selection.nodeIds,
    selectSystemRelationship,
  ]);
  const commitCanvasPositions = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      const canonicalPositions = { ...positions };
      for (const node of canvas.nodes) {
        if (node.type !== 'dynamicWorkerGroup' || !positions[node.id]) continue;
        moveDynamicWorkerGroup(node.data.sendEdgeId, positions[node.id]);
        delete canonicalPositions[node.id];
      }
      if (Object.keys(canonicalPositions).length > 0) {
        moveCanvasElements(canonicalPositions);
      }
    },
    [canvas.nodes, moveCanvasElements, moveDynamicWorkerGroup],
  );
  const canvasInteractions = useCanvasInteractions({
    projectedNodes: canvas.nodes,
    projectedEdges: canvas.edges,
    selectedNodeIds: proposalCanvasFocus
      ? proposalCanvasFocus.nodeIds
      : [...selection.nodeIds, ...selection.subgraphIds],
    selectedEdgeIds: proposalCanvasFocus ? proposalCanvasFocus.edgeIds : selection.edgeIds,
    editable: canvasEditable,
    onCommitPositions: commitCanvasPositions,
    renderedSelectionRequest,
  });
  const { clearRenderedSelection } = canvasInteractions;
  const resetPresentation = useCallback(
    (mode: Exclude<WorkspacePresentationMode, 'runtime'> = 'design') => {
      clearProjectionSelection();
      clearSelection();
      clearRenderedSelection();
      setRequestedPresentationMode(mode);
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
      setProjectionFitRequest({ key: `proposal:${proposalId}`, mode: 'proposal' });
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
    const reviewedProposalId = proposal?.id;
    rejectProposal();
    resetPresentation();
    if (reviewedProposalId) {
      setProjectionFitRequest({ key: `accepted-after-reject:${reviewedProposalId}`, mode: 'design' });
    }
  }, [proposal?.id, rejectProposal, resetPresentation]);
  const handleRequestProposalChanges = useCallback((feedback: string) => {
    const result = requestProposalChanges(feedback);
    if (result.ok) {
      setRequestedPresentationMode('proposal');
      setShowInspector(true);
      if (isCompactWorkspace) {
        setShowPalette(false);
        setCompactPanelPreference('inspector');
      }
    }
    return result;
  }, [isCompactWorkspace, requestProposalChanges]);
  const handleUnfreeze = useCallback(() => {
    unfreezeGraph();
    resetPresentation();
  }, [resetPresentation, unfreezeGraph]);
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
      if (!loadGraphLibraryEntry(entry)) return;
      resetPresentation();
      setLibraryOpen(false);
    },
    [libraryBlockedReason, loadGraphLibraryEntry, resetPresentation],
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
  // React Flow's fit calculation cannot enclose the whole graph when a
  // readability floor is larger than the zoom available between overlay
  // rails. Let manual/projection fits reach the canvas minimum whenever a
  // desktop rail is open; asymmetric padding still positions the graph in the
  // genuinely usable center. A rail-free canvas keeps the established floor.
  const fitMinZoom = !isCompactWorkspace && (paletteVisible || inspectorVisible)
    ? 0.18
    : isCompactWorkspace
      ? 0.28
      : 0.48;
  const { fitFocus, fitGraph, fitNodes, fitProjection } = useCoalescedFitView<CanvasFlowNode, CanvasFlowEdge>({
    enabled: hasHydrated,
    revision: fitViewRevision,
    padding: fitPadding,
    minZoom: fitMinZoom,
  });

  useEffect(() => {
    if (!inspectorVisible || !selection.primary) return;
    const selectedSubgraph = selection.primary.type === 'subgraph'
      ? graph.subgraphs.find((subgraph) => subgraph.id === selection.primary?.id)
      : undefined;
    const selectedDynamicWorker = selection.primary.type === 'node'
      ? canvas.nodes.find((node) => (
          node.type === 'dynamicWorkerGroup' &&
          node.data.templateNodeId === selection.primary?.id
        ))
      : undefined;
    if ((!selectedSubgraph || selectedSubgraph.collapsed) && !selectedDynamicWorker) return;
    // Expanded frames can be wider than the canvas area that remains after
    // the contextual inspector opens. Refit that one frame through the same
    // asymmetric panel padding so its header and resize handle stay reachable.
    fitNodes([selectedDynamicWorker?.id ?? selectedSubgraph!.id]);
  }, [canvas.nodes, fitNodes, graph.subgraphs, inspectorVisible, selection.primary]);

  useEffect(() => {
    const focus = activeViewMode === 'proposal' ? proposalCanvasFocus : null;
    if (!focus) return;
    const existingNodeIds = new Set(canvas.nodes.map((node) => node.id));
    const fitNodeIds = focus.fitNodeIds.filter((id) => existingNodeIds.has(id));
    fitFocus(fitNodeIds, focus.cameraMode === 'detail');
  }, [activeViewMode, canvas.nodes, fitFocus, proposalCanvasFocus]);

  useEffect(() => {
    if (!projectionFitRequest || projectionFitRequest.mode !== activeViewMode) return;
    if (completedProjectionFitKeyRef.current === projectionFitRequest.key) return;
    if (projectionFitRequest.mode === 'proposal' && (!proposalId || !inspectorVisible)) return;
    if (projectionFitRequest.mode === 'design' && proposalId) return;
    if (projectionFitRequest.mode === 'proposal') {
      if (proposalInitialFitNodeIds.length > 0 && !fitFocus(proposalInitialFitNodeIds)) return;
    } else if (!fitProjection(canvas.nodes)) return;
    completedProjectionFitKeyRef.current = projectionFitRequest.key;
  }, [
    activeViewMode,
    canvas.nodes,
    fitProjection,
    fitFocus,
    inspectorVisible,
    proposalInitialFitNodeIds,
    projectionFitRequest,
    proposalId,
  ]);

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
          return {
            graph: state.graph,
            proposal: state.proposal,
            reviewRequest: state.reviewRequest ?? null,
            scenarios: state.scenarios,
          };
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
      // Proposal selection is a local review projection. It must never be
      // mirrored into the accepted graph's persisted selection.
      if (activeViewMode === 'proposal') return;
      const selectedSystemRelationship = edges.find(isCanvasSystemRelationshipEdge);
      if (selectedSystemRelationship) {
        selectSystemRelationship(selectedSystemRelationship.data.relationship.id, false);
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
      if (activeViewMode === 'proposal') {
        const section = node.type === 'subgraph' ? 'subgraphs' : 'nodes';
        const proposalEntry = proposalEntryByKey.get(`${section}:${node.id}`);
        if (proposalEntry?.entry.state !== 'unchanged') {
          setProposalFocusEntryKey(proposalEntry.key);
        }
        return;
      }
      if (node.type === 'runtimeInstance') {
        setRuntimeSelection(node.data);
        return;
      }
      setRuntimeSelection(null);
      setSelectedRelationshipId(null);
      makePrimary({ type: node.type === 'subgraph' ? 'subgraph' : 'node', id: node.id });
    },
    [activeViewMode, makePrimary, proposalEntryByKey],
  );

  const handleNodeDoubleClick = useCallback<NodeMouseHandler<CanvasFlowNode>>(
    (_, node) => {
      if (activeViewMode === 'proposal') return;
      if (node.type === 'runtimeInstance') {
        setRuntimeSelection(node.data);
      } else {
        setRuntimeSelection(null);
        setSelectedRelationshipId(null);
        makePrimary({ type: node.type === 'subgraph' ? 'subgraph' : 'node', id: node.id });
      }
      openInspectorForSelection();
    },
    [activeViewMode, makePrimary, openInspectorForSelection],
  );

  const handleEdgeClick = useCallback<EdgeMouseHandler<CanvasFlowEdge>>(
    (_, edge) => {
      if (isCanvasSystemRelationshipEdge(edge)) {
        selectSystemRelationship(edge.data.relationship.id, false);
        return;
      }
      const [domainEdgeId] = domainEdgeIdsForCanvasEdge(edge);
      if (activeViewMode === 'proposal') {
        const proposalEntry = domainEdgeId
          ? proposalEntryByKey.get(`native-edges:${domainEdgeId}`)
          : undefined;
        if (proposalEntry?.entry.state !== 'unchanged') {
          setProposalFocusEntryKey(proposalEntry.key);
        }
        return;
      }
      if (domainEdgeId) makePrimary({ type: 'edge', id: domainEdgeId });
    },
    [activeViewMode, makePrimary, proposalEntryByKey, selectSystemRelationship],
  );

  const handleEdgeDoubleClick = useCallback<EdgeMouseHandler<CanvasFlowEdge>>(
    (_, edge) => {
      if (activeViewMode === 'proposal') return;
      if (isCanvasSystemRelationshipEdge(edge)) {
        selectSystemRelationship(edge.data.relationship.id);
        return;
      }
      const [domainEdgeId] = domainEdgeIdsForCanvasEdge(edge);
      if (!domainEdgeId) return;
      makePrimary({ type: 'edge', id: domainEdgeId });
      openInspectorForSelection();
    },
    [activeViewMode, makePrimary, openInspectorForSelection, selectSystemRelationship],
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

  const handleScenarioSelect = (scenarioId: string | null) => {
    setScenarioSelection(scenarioId ? { id: scenarioId, graphId: graph.id, graphUpdatedAt: graph.updatedAt } : null);
    const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
    if (scenario) {
      fitNodes(scenario.orderedPath);
    }
  };

  const selectRuntimeInstance = (instance: RuntimeInstanceNodeData) => {
    setRuntimeSelection(instance);
    void fitView({ nodes: [{ id: `runtime:${instance.runtimeId}` }], duration: 180, padding: 1.4 });
  };

  if (!hasHydrated) {
    return (
      <main className="workspace-loading grid h-dvh place-items-center">
        <div className="text-center">
          <div className="workspace-loading__mark mx-auto grid h-11 w-11 place-items-center rounded-xl text-sm font-bold">GC</div>
          <p className="mt-3 text-xs font-semibold text-black/50">Opening your workflow workspace…</p>
        </div>
      </main>
    );
  }

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
          canFreeze={validationIssues.length === 0 && !proposal && !layoutPending}
          canAutoLayout={editable && !layoutPending}
          scenarioCount={scenarios.length}
          viewMode={activeViewMode}
          runtimeAvailable={runtimeAvailable}
          runtimeUnavailableReason={runtimeUnavailableReason}
          theme={theme}
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
            if (mode === 'scenario' || mode === 'proposal' || mode === 'runtime') {
              setShowInspector(true);
              if (isCompactWorkspace) {
                setShowPalette(false);
                setCompactPanelPreference('inspector');
              }
            }
          }}
          onThemeChange={changeTheme}
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
              onAdd={addAtCenter}
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
          <CanvasReviewFocusProvider focus={activeViewMode === 'proposal' ? proposalCanvasFocus : null}>
          <ReactFlow<CanvasFlowNode, CanvasFlowEdge>
            data-proposal-focus-key={proposalCanvasFocus?.key}
            nodes={activeViewMode === 'proposal' ? canvas.nodes : canvasInteractions.nodes}
            edges={activeViewMode === 'proposal' ? canvas.edges : canvasInteractions.edges}
            nodeTypes={canvasNodeTypes}
            edgeTypes={canvasEdgeTypes}
            onNodesChange={canvasInteractions.onNodesChange}
            onEdgesChange={canvasInteractions.onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onReconnect={onReconnect}
            onReconnectStart={onReconnectStart}
            onReconnectEnd={onReconnectEnd}
            onSelectionChange={handleSelectionChange}
            onSelectionStart={canvasInteractions.onSelectionStart}
            onSelectionEnd={canvasInteractions.onSelectionEnd}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onEdgeClick={handleEdgeClick}
            onEdgeDoubleClick={handleEdgeDoubleClick}
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
            minZoom={canvasMinZoom}
            maxZoom={2.5}
            deleteKeyCode={null}
          >
            <AlignmentGuides guides={canvasInteractions.guides} />
            <Background variant={BackgroundVariant.Lines} gap={24} size={1} color="var(--gc-grid-line)" />
            <GraphOverview />
            <Controls
              showInteractive={false}
              showFitView={false}
              position="bottom-right"
              className="canvas-flow-controls"
            >
              <ControlButton
                aria-label="Fit View"
                title="Fit view"
                onClick={fitGraph}
              >
                <FrameCorners size={14} weight="bold" aria-hidden="true" />
              </ControlButton>
            </Controls>
          </ReactFlow>
          </CanvasReviewFocusProvider>

          <CanvasStatusStrip
            graph={graph}
            issueCount={validationIssues.length}
            proposalPending={Boolean(proposal)}
            scenarioCount={scenarios.length}
          />

          {proposal && <div className="workspace-proposal-banner">Proposal preview · accepted graph locked and unchanged</div>}
          {graph.status === 'frozen' && <div className="workspace-frozen-banner">Frozen contract · {scenarios.length} scenarios</div>}
        </section>

        {inspectorVisible && (
          <aside className="workspace-panel workspace-inspector-panel">
            <div className="workspace-inspector-content">
              {activeViewMode === 'proposal' ? (
                <ProposalPanel
                  proposal={proposal}
                  review={proposalReview}
                  reviewRequest={reviewRequest}
                  activeEntryKey={proposalFocusEntryKey}
                  onEntrySelect={(entry) => setProposalFocusEntryKey(entry?.key ?? null)}
                  onApprove={handleApproveProposal}
                  onRequestChanges={handleRequestProposalChanges}
                  onReject={handleRejectProposal}
                  onCollapse={closeInspector}
                />
              ) : activeViewMode === 'scenario' ? (
                <ScenarioPanel
                  graph={graph}
                  scenarios={scenarios}
                  selectedScenarioId={selectedScenarioId}
                  onScenarioSelect={handleScenarioSelect}
                  onCollapse={closeInspector}
                />
              ) : activeViewMode === 'runtime' ? (
                <RuntimeModePanel
                  graph={graph}
                  fixture={runtimeAvailability.available ? runtimeAvailability.fixture : null}
                  selectedInstance={runtimeSelection}
                  onSelect={selectRuntimeInstance}
                  onFocus={selectRuntimeInstance}
                  onCollapse={closeInspector}
                />
              ) : (
                <ContextInspector
                  key={inspectorSelectionKey}
                  focusRequest={inspectorFocusRequest}
                  graphSettingsRequest={graphSettingsRequest}
                  relationship={selectedRelationship}
                  evidence={selectedEvidence}
                  reviewProjection={reviewProjection}
                  onCollapse={closeInspector}
                />
              )}
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
        confirmationRequired={graph.nodes.length > 0 || graph.edges.length > 0 || graph.subgraphs.length > 0}
        replacementBlockedReason={libraryBlockedReason}
        onRequestOpen={handleOpenLibraryEntry}
        onClose={() => setLibraryOpen(false)}
      />
    </main>
  );
}
