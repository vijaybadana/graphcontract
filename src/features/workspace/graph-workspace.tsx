'use client';

import {
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
} from '@xyflow/react';
import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { projectGraphToCanvas } from '@/src/adapters/react-flow/project-graph';
import { getDocumentModelContext, registerWebMcpTools } from '@/src/adapters/webmcp/register-tools';
import { NodeKind, validateGraph } from '@/src/domain';
import { ContractFlowNode, ContractNode } from '@/src/features/canvas/contract-node';
import { NodePalette, readDroppedNodeKind } from '@/src/features/canvas/node-palette';
import { ContextInspector } from '@/src/features/inspector/context-inspector';
import { ProposalPanel } from '@/src/features/proposals/proposal-panel';
import { ScenarioPanel } from '@/src/features/scenarios/scenario-panel';
import { useGraphStore } from '@/src/state/workspace-store';

type WebMcpStatus = 'unavailable' | 'registering' | 'connected' | 'error';
const nodeTypes = { contractNode: ContractNode };
const FIT_VIEW_OPTIONS = {
  padding: { top: '10%' as const, right: '8%' as const, bottom: '12%' as const, left: '8%' as const },
  minZoom: 0.2,
  maxZoom: 1.15,
  duration: 260,
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
  const moveNode = useGraphStore((state) => state.moveNode);
  const addEdge = useGraphStore((state) => state.addEdge);
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
  const clearNotice = useGraphStore((state) => state.clearNotice);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [webMcpStatus, setWebMcpStatus] = useState<WebMcpStatus>('unavailable');
  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [rightTab, setRightTab] = useState<'review' | 'scenarios'>('review');
  const { screenToFlowPosition, fitView } = useReactFlow<ContractFlowNode, Edge>();
  const nodesInitialized = useNodesInitialized();

  const validationIssues = useMemo(() => validateGraph(graph), [graph]);
  const canvas = useMemo(
    () => projectGraphToCanvas(graph, proposal, selection),
    [graph, proposal, selection],
  );
  const editable = graph.status === 'draft' && !proposal;
  const fitGraph = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        void fitView(FIT_VIEW_OPTIONS);
      });
    });
  }, [fitView]);

  useEffect(() => {
    void Promise.resolve(useGraphStore.persist.rehydrate()).then(() => setHasHydrated(true));
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    const modelContext = getDocumentModelContext();
    if (!modelContext) {
      setWebMcpStatus('unavailable');
      return;
    }
    const controller = new AbortController();
    setWebMcpStatus('registering');
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

  useEffect(() => {
    if (!hasHydrated || !nodesInitialized) return;
    fitGraph();
  }, [fitGraph, fitViewRevision, hasHydrated, nodesInitialized, showInspector, showPalette]);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
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
      if (connection.source && connection.target) addEdge(connection.source, connection.target);
    },
    [addEdge],
  );

  const addAtCenter = (kind: NodeKind) => {
    addNode(
      kind,
      screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    );
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = readDroppedNodeKind(event);
    if (!kind || !editable) return;
    addNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  const handleFreeze = () => {
    const result = freezeGraph();
    if (result.ok) {
      setRightTab('scenarios');
      setShowInspector(true);
    }
  };

  if (!hasHydrated) {
    return (
      <main className="grid h-dvh place-items-center bg-[#f3f2ee] text-[#171918]">
        <div className="text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#18211d] text-sm font-bold text-white">GC</div>
          <p className="mt-3 text-xs font-semibold text-black/50">Opening your workflow workspace…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-hidden bg-[#f3f2ee] text-[#171918]">
      <header className="relative z-30 flex h-14 items-center justify-between border-b border-black/10 bg-[#fbfaf7]/95 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#18211d] text-xs font-bold text-white">GC</div>
          <div>
            <p className="text-sm font-semibold tracking-tight">GraphContract</p>
            <p className="hidden text-[10px] text-black/45 sm:block">Human-approved agent workflow contracts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={webMcpStatus} />
          <span className={`status-badge ${graph.status === 'frozen' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{graph.status}</span>
          {graph.status === 'frozen' ? (
            <button onClick={unfreezeGraph} className="secondary-button">Unfreeze</button>
          ) : (
            <button onClick={handleFreeze} disabled={validationIssues.length > 0 || Boolean(proposal)} className="primary-button">Confirm &amp; freeze</button>
          )}
        </div>
      </header>

      {notice && <div className="fixed left-1/2 top-[4.25rem] z-50 -translate-x-1/2 rounded-full bg-[#18211d] px-4 py-2 text-xs font-semibold text-white shadow-xl">{notice}</div>}

      <section className="flex h-[calc(100dvh-3.5rem)] min-w-0">
        {showPalette && (
          <NodePalette
            graph={graph}
            proposal={proposal}
            disabled={!editable}
            validationIssueCount={validationIssues.length}
            onAdd={addAtCenter}
          />
        )}

        <section className="relative min-w-0 flex-1">
        <ReactFlow<ContractFlowNode, Edge>
          nodes={canvas.nodes}
          edges={canvas.edges}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onSelectionChange={({ nodes, edges }) => {
            const nodeIds = nodes.map((node) => node.id);
            const edgeIds = edges.map((edge) => edge.id);
            const primary = nodeIds.length
              ? { type: 'node' as const, id: nodeIds[nodeIds.length - 1] }
              : edgeIds.length
                ? { type: 'edge' as const, id: edgeIds[edgeIds.length - 1] }
                : null;
            setSelection({ nodeIds, edgeIds, primary });
          }}
          onPaneClick={clearSelection}
          onNodeDragStop={(_, node) => moveNode(node.id, node.position)}
          onDrop={onDrop}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          nodesDraggable={editable}
          nodesConnectable={editable}
          elementsSelectable
          selectionOnDrag
          panOnScroll
          selectionKeyCode="Shift"
          multiSelectionKeyCode={["Meta", "Control"]}
          snapToGrid
          snapGrid={[12, 12]}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          minZoom={0.18}
          maxZoom={2.5}
          deleteKeyCode={null}
        >
          <Background gap={24} size={1} color="#d8d6d0" />
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
            nodeColor={(node) => minimapColors[node.data.kind] ?? '#94a3b8'}
            nodeStrokeColor="#ffffff"
            nodeStrokeWidth={2}
            nodeBorderRadius={10}
            maskColor="rgb(24 33 29 / 10%)"
            className="!h-28 !w-44 !rounded-xl !border !border-black/10 !bg-white"
          />
          <Controls showInteractive={false} position="bottom-center" className="!overflow-hidden !rounded-xl !border-black/10 !shadow-sm" />
        </ReactFlow>

        <div className="workspace-toolbar absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 p-1">
          <ToolButton label="Palette" active={showPalette} onClick={() => setShowPalette((value) => !value)} />
          <ToolButton label="Inspector" active={showInspector} onClick={() => setShowInspector((value) => !value)} />
          <span className="mx-1 h-5 w-px bg-black/10" />
          <ToolButton label="Undo" disabled={!editable || past.length === 0} onClick={undo} />
          <ToolButton label="Redo" disabled={!editable || future.length === 0} onClick={redo} />
          <ToolButton label="Duplicate" disabled={!editable || selection.nodeIds.length === 0} onClick={duplicateSelection} />
          <ToolButton label="Delete" disabled={!editable || selection.nodeIds.length + selection.edgeIds.length === 0} onClick={deleteSelection} />
          <span className="mx-1 h-5 w-px bg-black/10" />
          <ToolButton label="Fit" onClick={fitGraph} />
          <ToolButton label="Reset" onClick={resetGraph} />
        </div>

        {proposal && <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-900 shadow-lg">Proposal preview · accepted graph locked and unchanged</div>}
        {graph.status === 'frozen' && <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#18211d] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">Frozen contract · {scenarios.length} paths</div>}
        </section>

        {showInspector && (
          <aside className="workspace-panel relative z-20 m-3 ml-0 w-[340px] shrink-0 overflow-y-auto p-3">
            <div className="mb-3 grid grid-cols-2 rounded-xl bg-black/5 p-1">
              <button onClick={() => setRightTab('review')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${rightTab === 'review' ? 'bg-white shadow-sm' : 'text-black/50'}`}>Edit &amp; review</button>
              <button onClick={() => setRightTab('scenarios')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${rightTab === 'scenarios' ? 'bg-white shadow-sm' : 'text-black/50'}`}>Scenarios {scenarios.length ? `(${scenarios.length})` : ''}</button>
            </div>
            {rightTab === 'review' ? <div className="space-y-3"><ContextInspector /><ProposalPanel /></div> : <ScenarioPanel graph={graph} scenarios={scenarios} />}
          </aside>
        )}
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: WebMcpStatus }) {
  const presentation = {
    unavailable: ['Browser preview', 'bg-amber-400'],
    registering: ['Connecting WebMCP', 'bg-sky-400'],
    connected: ['WebMCP · 3 tools', 'bg-emerald-500'],
    error: ['WebMCP error', 'bg-rose-500'],
  }[status];
  return <div className="hidden items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-[10px] font-semibold md:flex"><span className={`h-2 w-2 rounded-full ${presentation[1]}`} />{presentation[0]}</div>;
}

function ToolButton({ label, active, disabled, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${active ? 'bg-[#18211d] text-white' : 'hover:bg-black/5'}`}>{label}</button>;
}
