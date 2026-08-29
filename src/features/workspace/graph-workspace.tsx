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
  projectGraphToCanvas,
} from '@/src/adapters/react-flow/project-graph';
import { getDocumentModelContext, registerWebMcpTools } from '@/src/adapters/webmcp/register-tools';
import { evaluateConnection } from '@/src/application/connection-policy';
import { NodeKind, validateGraph } from '@/src/domain';
import { AlignmentGuides } from '@/src/features/canvas/interactions/alignment-guides';
import { useCanvasInteractions } from '@/src/features/canvas/interactions/use-canvas-node-interactions';
import { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import { ContractNode } from '@/src/features/canvas/contract-node';
import {
  NodePalette,
  PaletteKind,
  readDroppedPaletteKind,
} from '@/src/features/canvas/node-palette';
import { SubgraphNode } from '@/src/features/canvas/subgraph-node';
import { useCoalescedFitView } from '@/src/features/canvas/use-coalesced-fit-view';
import { ContextInspector } from '@/src/features/inspector/context-inspector';
import { ProposalPanel } from '@/src/features/proposals/proposal-panel';
import { ScenarioPanel } from '@/src/features/scenarios/scenario-panel';
import {
  PanelExpandButton,
  PanelCollapseButton,
} from '@/src/features/workspace/panel-collapse-control';
import { PanelResizer } from '@/src/features/workspace/panel-resizer';
import { workspaceSelectionFromCanvas } from '@/src/features/workspace/canvas-selection';
import { CanvasInstructionStrip, CanvasStatusStrip } from '@/src/features/workspace/canvas-chrome';
import { activeInspectorTabId, InspectorTabs } from '@/src/features/workspace/inspector-tabs';
import {
  resolveWorkspacePanelVisibility,
} from '@/src/features/workspace/panel-visibility';
import type { CompactPanelPreference } from '@/src/features/workspace/panel-visibility';
import { WebMcpStatus, WorkspaceHeader } from '@/src/features/workspace/workspace-header';
import { useMediaQuery } from '@/src/features/workspace/use-media-query';
import {
  isDomainEdgeProjectedAsCollapsedProxy,
  useGraphStore,
} from '@/src/state/workspace-store';

import './graph-workspace.css';

const nodeTypes = { contractNode: ContractNode, subgraph: SubgraphNode };
const snapGrid: [number, number] = [12, 12];
const panOnDrag = [1];
const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  pathOptions: { borderRadius: 16, offset: 28 },
};
const minimapColors: Record<NodeKind, string> = {
  start: '#34d399',
  agent: '#d79049',
  action: '#a78bfa',
  tool: '#38bdf8',
  human_input: '#fb7185',
  end: '#52525b',
};

export function GraphWorkspace() {
  const graph = useGraphStore((state) => state.graph);
  const proposal = useGraphStore((state) => state.proposal);
  const scenarios = useGraphStore((state) => state.scenarios);
  const selection = useGraphStore((state) => state.selection);
  const notice = useGraphStore((state) => state.notice);
  const past = useGraphStore((state) => state.past);
  const future = useGraphStore((state) => state.future);
  const fitViewRevision = useGraphStore((state) => state.fitViewRevision);
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
  const freezeGraph = useGraphStore((state) => state.freezeGraph);
  const unfreezeGraph = useGraphStore((state) => state.unfreezeGraph);
  const resetGraph = useGraphStore((state) => state.resetGraph);
  const loadResearchSupervisorDemo = useGraphStore((state) => state.loadResearchSupervisorDemo);
  const clearNotice = useGraphStore((state) => state.clearNotice);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [webMcpStatus, setWebMcpStatus] = useState<WebMcpStatus>('unavailable');
  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(false);
  const [compactPanelPreference, setCompactPanelPreference] = useState<CompactPanelPreference>(null);
  const [paletteWidth, setPaletteWidth] = useState(232);
  const [inspectorWidth, setInspectorWidth] = useState(344);
  const [rightTab, setRightTab] = useState<'review' | 'scenarios'>('review');
  const isCompactWorkspace = useMediaQuery('(max-width: 1099px)');
  const stageRef = useRef<HTMLElement>(null);
  const reconnectingEdgeIdRef = useRef<string | null>(null);
  const { screenToFlowPosition } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();

  const editable = graph.status === 'draft' && !proposal;
  const { inspectorVisible, paletteVisible } = resolveWorkspacePanelVisibility({
    compact: isCompactWorkspace,
    paletteRequested: showPalette,
    inspectorRequested: showInspector,
    compactPreference: compactPanelPreference,
    proposalPending: Boolean(proposal),
    scenariosActive: rightTab === 'scenarios' && scenarios.length > 0,
  });
  const inspectorTab = proposal || selection.primary ? 'review' : rightTab;
  const toggleSubgraphCollapse = useCallback(
    (subgraphId: string, collapsed: boolean) => {
      if (editable) setSubgraphCollapsed(subgraphId, collapsed);
    },
    [editable, setSubgraphCollapsed],
  );
  const validationIssues = useMemo(() => validateGraph(graph), [graph]);
  const canvas = useMemo(() => {
    const projected = projectGraphToCanvas(graph, proposal);
    return {
      ...projected,
      nodes: projected.nodes.map((node) =>
        node.type === 'subgraph'
          ? {
              ...node,
              data: {
                ...node.data,
                collapseEditable: editable,
                onToggleCollapse: editable ? toggleSubgraphCollapse : undefined,
              },
            }
          : node,
      ),
    };
  }, [editable, graph, proposal, toggleSubgraphCollapse]);
  const canvasInteractions = useCanvasInteractions({
    projectedNodes: canvas.nodes,
    projectedEdges: canvas.edges,
    selectedNodeIds: selection.nodeIds,
    selectedEdgeIds: selection.edgeIds,
    editable,
    onCommitPositions: moveCanvasElements,
  });
  const { clearRenderedSelection } = canvasInteractions;
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
        clearSelection();
        clearRenderedSelection();
      }
    },
    [clearRenderedSelection, clearSelection],
  );

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
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
  }, [copySelection, deleteSelection, duplicateSelection, pasteSelection, redo, undo]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        connection.source &&
        connection.target &&
        canConnectCanvasEndpoints(canvas.nodes, connection.source, connection.target)
      ) {
        addEdge(connection.source, connection.target);
      }
    },
    [addEdge, canvas.nodes],
  );

  const isValidConnection = useCallback(
    (connection: Connection) =>
      editable &&
      canConnectCanvasEndpoints(canvas.nodes, connection.source, connection.target) &&
      evaluateConnection(graph, connection, {
        reconnectingEdgeId: reconnectingEdgeIdRef.current,
      }).valid,
    [canvas.nodes, editable, graph],
  );

  const onReconnect = useCallback<OnReconnect<CanvasFlowEdge>>(
    (edge, connection) => {
      if (
        !editable ||
        !canReconnectCanvasEdge(edge) ||
        !connection.source ||
        !connection.target ||
        !canConnectCanvasEndpoints(canvas.nodes, connection.source, connection.target)
      ) {
        return;
      }
      const [domainEdgeId] = domainEdgeIdsForCanvasEdge(edge);
      if (domainEdgeId) {
        updateEdge(domainEdgeId, { source: connection.source, target: connection.target });
      }
    },
    [canvas.nodes, editable, updateEdge],
  );

  const handleSelectionChange = useCallback(
    ({ nodes, edges }: OnSelectionChangeParams<CanvasFlowNode, CanvasFlowEdge>) => {
      const nextSelection = workspaceSelectionFromCanvas(
        nodes,
        edges,
        useGraphStore.getState().selection.primary,
      );
      if (nextSelection.primary) {
        setRightTab('review');
        setShowInspector(true);
        if (isCompactWorkspace) {
          setShowPalette(false);
          setCompactPanelPreference('inspector');
        }
      }
      setSelection(nextSelection);
    },
    [isCompactWorkspace, setSelection],
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
    (_, node) =>
      makePrimary({ type: node.type === 'subgraph' ? 'subgraph' : 'node', id: node.id }),
    [makePrimary],
  );

  const handleEdgeClick = useCallback<EdgeMouseHandler<CanvasFlowEdge>>(
    (_, edge) => {
      const [domainEdgeId] = domainEdgeIdsForCanvasEdge(edge);
      if (domainEdgeId) makePrimary({ type: 'edge', id: domainEdgeId });
    },
    [makePrimary],
  );

  const addAtCenter = useCallback(
    (kind: PaletteKind) => {
      const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      if (kind === 'subgraph') {
        createSubgraph({ position });
        return;
      }
      addNode(kind, position);
    },
    [addNode, createSubgraph, screenToFlowPosition],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kind = readDroppedPaletteKind(event);
      if (!kind || !editable) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (kind === 'subgraph') {
        createSubgraph({ position });
        return;
      }
      addNode(kind, position);
    },
    [addNode, createSubgraph, editable, screenToFlowPosition],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onReconnectStart = useCallback((_: unknown, edge: CanvasFlowEdge) => {
    reconnectingEdgeIdRef.current = edge.id;
  }, []);

  const onReconnectEnd = useCallback(() => {
    reconnectingEdgeIdRef.current = null;
  }, []);

  const handleFreeze = () => {
    const result = freezeGraph();
    if (result.ok) {
      clearRenderedSelection();
      setRightTab('scenarios');
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
    selection.nodeIds.length + selection.subgraphIds.length + selection.edgeIds.length;
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
          paletteOpen={paletteVisible}
          inspectorOpen={inspectorVisible}
          canUndo={editable && past.length > 0}
          canRedo={editable && future.length > 0}
          canDuplicate={editable && selection.nodeIds.length > 0}
          canDelete={editable && hasDeletableSelection}
          canFreeze={validationIssues.length === 0 && !proposal}
          onTogglePalette={togglePalette}
          onToggleInspector={toggleInspector}
          onUndo={undo}
          onRedo={redo}
          onDuplicate={duplicateSelection}
          onDelete={deleteSelection}
          onFit={fitGraph}
          onReset={resetGraph}
          onFreeze={handleFreeze}
          onUnfreeze={unfreezeGraph}
        />

        {notice && <div className="workspace-notice">{notice}</div>}

        {paletteVisible && (
          <div className="workspace-palette-slot">
            <NodePalette
              graph={graph}
              proposal={proposal}
              disabled={!editable}
              validationIssueCount={validationIssues.length}
              onAdd={addAtCenter}
              onLoadResearchSupervisorDemo={loadResearchSupervisorDemo}
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
          <ReactFlow<CanvasFlowNode, CanvasFlowEdge>
            nodes={canvasInteractions.nodes}
            edges={canvasInteractions.edges}
            nodeTypes={nodeTypes}
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
            onPaneClick={clearSelection}
            onNodeDragStart={canvasInteractions.onNodeDragStart}
            onNodeDrag={canvasInteractions.onNodeDrag}
            onNodeDragStop={canvasInteractions.onNodeDragStop}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodesDraggable={editable}
            nodesConnectable={editable}
            edgesReconnectable={editable}
            elementsSelectable
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

          <CanvasInstructionStrip editable={editable} />
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
              {inspectorTab === 'review' ? <div className="space-y-3"><ContextInspector /><ProposalPanel /></div> : <ScenarioPanel graph={graph} scenarios={scenarios} />}
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
    </main>
  );
}
