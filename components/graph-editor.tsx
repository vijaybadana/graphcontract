'use client';

import {
  Background,
  Connection,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { ContractFlowNode, ContractNode } from '@/components/contract-node';
import {
  applyGraphOperations,
  BranchScenario,
  buildPythonTestSkeleton,
  enumerateScenarios,
  GraphEdge,
  GraphNode,
  GraphOperation,
  NodeKind,
  nodeKinds,
  validateGraph,
} from '@/lib/graph';
import { useGraphStore } from '@/lib/store';

type WebMcpStatus = 'unavailable' | 'registering' | 'connected' | 'error';

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
};

const nodeTypes = { contractNode: ContractNode };

const palette: Array<{ kind: NodeKind; label: string; color: string }> = [
  { kind: 'start', label: 'Start', color: 'bg-emerald-500' },
  { kind: 'agent', label: 'Agent', color: 'bg-[#d79049]' },
  { kind: 'action', label: 'Action / function', color: 'bg-violet-500' },
  { kind: 'tool', label: 'Tool', color: 'bg-sky-500' },
  { kind: 'human_input', label: 'Human Input', color: 'bg-rose-500' },
  { kind: 'end', label: 'End', color: 'bg-zinc-700' },
];

const operationSchema = {
  oneOf: [
    {
      type: 'object',
      required: ['type', 'node'],
      properties: {
        type: { const: 'add_node' },
        node: {
          type: 'object',
          required: ['id', 'kind', 'label', 'position'],
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: nodeKinds },
            label: { type: 'string' },
            description: { type: 'string' },
            position: {
              type: 'object',
              required: ['x', 'y'],
              properties: { x: { type: 'number' }, y: { type: 'number' } },
            },
            hitl: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                timing: { enum: ['before', 'after', 'conditional'] },
                inputType: { enum: ['approval', 'text', 'selection'] },
              },
            },
          },
        },
      },
    },
    {
      type: 'object',
      required: ['type', 'nodeId', 'patch'],
      properties: {
        type: { const: 'update_node' },
        nodeId: { type: 'string' },
        patch: { type: 'object' },
      },
    },
    {
      type: 'object',
      required: ['type', 'nodeId'],
      properties: { type: { const: 'remove_node' }, nodeId: { type: 'string' } },
    },
    {
      type: 'object',
      required: ['type', 'edge'],
      properties: {
        type: { const: 'add_edge' },
        edge: {
          type: 'object',
          required: ['id', 'source', 'target', 'mode'],
          properties: {
            id: { type: 'string' },
            source: { type: 'string' },
            target: { type: 'string' },
            mode: { enum: ['normal', 'conditional', 'fallback'] },
            label: { type: 'string' },
            condition: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'object',
      required: ['type', 'edgeId', 'patch'],
      properties: {
        type: { const: 'update_edge' },
        edgeId: { type: 'string' },
        patch: { type: 'object' },
      },
    },
    {
      type: 'object',
      required: ['type', 'edgeId'],
      properties: { type: { const: 'remove_edge' }, edgeId: { type: 'string' } },
    },
  ],
};

function proposalDecoratedGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  operations: GraphOperation[] | undefined,
) {
  if (!operations) return { nodes, edges };
  const graph = {
    schemaVersion: '1' as const,
    id: 'preview',
    name: 'Preview',
    nodes,
    edges,
    status: 'draft' as const,
    updatedAt: '',
  };
  return applyGraphOperations(graph, operations).graph;
}

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function GraphEditor() {
  const graph = useGraphStore((state) => state.graph);
  const proposal = useGraphStore((state) => state.proposal);
  const scenarios = useGraphStore((state) => state.scenarios);
  const selection = useGraphStore((state) => state.selection);
  const notice = useGraphStore((state) => state.notice);
  const addNode = useGraphStore((state) => state.addNode);
  const moveNode = useGraphStore((state) => state.moveNode);
  const addEdge = useGraphStore((state) => state.addEdge);
  const setSelection = useGraphStore((state) => state.setSelection);
  const clearSelection = useGraphStore((state) => state.clearSelection);
  const freezeGraph = useGraphStore((state) => state.freezeGraph);
  const unfreezeGraph = useGraphStore((state) => state.unfreezeGraph);
  const resetGraph = useGraphStore((state) => state.resetGraph);
  const clearNotice = useGraphStore((state) => state.clearNotice);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [webMcpStatus, setWebMcpStatus] = useState<WebMcpStatus>('unavailable');
  const [rightTab, setRightTab] = useState<'review' | 'scenarios'>('review');
  const { screenToFlowPosition, fitView } = useReactFlow<ContractFlowNode, Edge>();

  const validationIssues = useMemo(() => validateGraph(graph), [graph]);
  const proposed = useMemo(
    () => proposalDecoratedGraph(graph.nodes, graph.edges, proposal?.operations),
    [graph.nodes, graph.edges, proposal],
  );

  const displayNodes = useMemo<ContractFlowNode[]>(() => {
    const updates = new Map(
      (proposal?.operations ?? [])
        .filter((operation): operation is Extract<GraphOperation, { type: 'update_node' }> => operation.type === 'update_node')
        .map((operation) => [operation.nodeId, operation.patch]),
    );
    const baseNodeIds = new Set(graph.nodes.map((node) => node.id));
    const sourceNodes = [...graph.nodes];
    for (const node of proposed.nodes) {
      if (!baseNodeIds.has(node.id)) sourceNodes.push(node);
    }

    return sourceNodes.map((node) => {
      const patched = updates.has(node.id) ? { ...node, ...updates.get(node.id) } : node;
      const diff = proposal?.diff;
      const proposalState = diff?.addedNodeIds.includes(node.id)
        ? 'added'
        : diff?.removedNodeIds.includes(node.id)
          ? 'removed'
          : diff?.updatedNodeIds.includes(node.id)
            ? 'updated'
            : undefined;
      return {
        id: patched.id,
        type: 'contractNode',
        position: patched.position,
        data: { ...patched, proposalState },
        selected: selection?.type === 'node' && selection.id === patched.id,
      };
    });
  }, [graph.nodes, proposed.nodes, proposal, selection]);

  const displayEdges = useMemo<Edge[]>(() => {
    const baseEdgeIds = new Set(graph.edges.map((edge) => edge.id));
    const sourceEdges = [...graph.edges];
    for (const edge of proposed.edges) {
      if (!baseEdgeIds.has(edge.id)) sourceEdges.push(edge);
    }
    const updates = new Map(
      (proposal?.operations ?? [])
        .filter((operation): operation is Extract<GraphOperation, { type: 'update_edge' }> => operation.type === 'update_edge')
        .map((operation) => [operation.edgeId, operation.patch]),
    );

    return sourceEdges.map((edge) => {
      const patched = updates.has(edge.id) ? { ...edge, ...updates.get(edge.id) } : edge;
      const added = proposal?.diff.addedEdgeIds.includes(edge.id);
      const removed = proposal?.diff.removedEdgeIds.includes(edge.id);
      const updated = proposal?.diff.updatedEdgeIds.includes(edge.id);
      const color = added ? '#159160' : removed ? '#db4b55' : updated ? '#c47b24' : '#676b68';
      return {
        id: patched.id,
        source: patched.source,
        target: patched.target,
        label: patched.label || (patched.mode === 'fallback' ? 'fallback' : undefined),
        markerEnd: { type: MarkerType.ArrowClosed, color },
        selected: selection?.type === 'edge' && selection.id === patched.id,
        animated: Boolean(added),
        style: {
          stroke: color,
          strokeWidth: added || removed || updated ? 2.5 : 1.7,
          strokeDasharray: removed ? '6 5' : undefined,
          opacity: removed ? 0.65 : 1,
        },
        labelStyle: { fill: '#494c49', fontSize: 11, fontWeight: 700 },
        labelBgStyle: { fill: '#fbfaf7', fillOpacity: 0.92 },
        labelBgPadding: [5, 3] as [number, number],
        data: patched,
      };
    });
  }, [graph.edges, proposed.edges, proposal, selection]);

  useEffect(() => {
    void Promise.resolve(useGraphStore.persist.rehydrate()).then(() => setHasHydrated(true));
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext) {
      return;
    }

    const controller = new AbortController();
    const register = async () => {
      try {
        await Promise.all([
          modelContext.registerTool(
            {
              name: 'get_graph',
              title: 'Read the accepted workflow graph',
              description:
                'Returns the current accepted GraphContract graph, freeze state, validation issues, and pending-proposal summary. It never treats proposed changes as accepted.',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
              annotations: { readOnlyHint: true, destructiveHint: false },
              execute: async () => {
                const state = useGraphStore.getState();
                const issues = validateGraph(state.graph);
                return JSON.stringify({
                  ok: true,
                  graph: state.graph,
                  validation: { validForFreeze: issues.length === 0, issues },
                  pendingProposal: state.proposal
                    ? {
                        id: state.proposal.id,
                        status: state.proposal.status,
                        rationale: state.proposal.rationale,
                        createdAt: state.proposal.createdAt,
                      }
                    : undefined,
                });
              },
            },
            { signal: controller.signal },
          ),
          modelContext.registerTool(
            {
              name: 'propose_graph_changes',
              title: 'Propose structured workflow changes',
              description:
                'Creates a review-only proposal from ordered graph operations and a rationale. It cannot apply, approve, reject, or freeze changes. Read the graph first and use its IDs.',
              inputSchema: {
                type: 'object',
                required: ['operations', 'rationale'],
                properties: {
                  operations: { type: 'array', minItems: 1, items: operationSchema },
                  rationale: { type: 'string', minLength: 1 },
                  expectedGraphUpdatedAt: { type: 'string' },
                },
                additionalProperties: false,
              },
              annotations: { readOnlyHint: false, destructiveHint: false },
              execute: async (input) => JSON.stringify(useGraphStore.getState().submitProposal(input)),
            },
            { signal: controller.signal },
          ),
          modelContext.registerTool(
            {
              name: 'get_branch_scenarios',
              title: 'Read frozen graph branch scenarios',
              description:
                'Returns every reachable Start-to-End scenario for the accepted graph. The human must freeze a valid graph in the UI first.',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
              annotations: { readOnlyHint: true, destructiveHint: false },
              execute: async () => {
                const state = useGraphStore.getState();
                if (state.graph.status !== 'frozen') {
                  return JSON.stringify({ ok: false, error: { code: 'GRAPH_NOT_FROZEN', message: 'The human has not frozen the graph.' } });
                }
                const issues = validateGraph(state.graph);
                if (issues.length > 0) {
                  return JSON.stringify({ ok: false, error: { code: 'GRAPH_INVALID', message: 'The frozen graph is invalid.', issues } });
                }
                return JSON.stringify({
                  ok: true,
                  graphId: state.graph.id,
                  scenarios: state.scenarios.length > 0 ? state.scenarios : enumerateScenarios(state.graph),
                });
              },
            },
            { signal: controller.signal },
          ),
        ]);
        setWebMcpStatus('connected');
      } catch {
        if (!controller.signal.aborted) setWebMcpStatus('error');
      }
    };

    void register();
    return () => controller.abort();
  }, [hasHydrated]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(clearNotice, 4000);
    return () => window.clearTimeout(timeout);
  }, [notice, clearNotice]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) addEdge(connection.source, connection.target);
    },
    [addEdge],
  );

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
    event.dataTransfer.setData('application/graphcontract-node', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/graphcontract-node') as NodeKind;
    if (!nodeKinds.includes(kind) || graph.status === 'frozen') return;
    addNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  const handleFreeze = () => {
    const result = freezeGraph();
    if (result.ok) setRightTab('scenarios');
  };

  const exportGraph = () => downloadFile('graph-contract.json', JSON.stringify(graph, null, 2), 'application/json');
  const exportScenarios = () =>
    downloadFile(
      'graph-test-scenarios.json',
      JSON.stringify({
        graphId: graph.id,
        graphName: graph.name,
        graphUpdatedAt: graph.updatedAt,
        generatedAt: new Date().toISOString(),
        scenarios,
      }, null, 2),
      'application/json',
    );
  const exportPython = () => downloadFile('test_graph_paths.py', buildPythonTestSkeleton(graph, scenarios), 'text/x-python');

  if (!hasHydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f2ee] text-[#171918]">
        <div className="text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#18211d] text-sm font-bold text-white">GC</div>
          <p className="mt-3 text-xs font-semibold text-black/50">Opening your workflow workspace…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f2ee] text-[#171918]">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-[#fbfaf7] px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#18211d] text-sm font-bold text-white">GC</div>
          <div>
            <p className="text-sm font-semibold tracking-tight">GraphContract</p>
            <p className="text-[11px] text-black/50">Human-approved workflow contracts</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={webMcpStatus} />
          <button
            onClick={() => {
              resetGraph();
              window.setTimeout(() => fitView({ padding: 0.15 }), 50);
            }}
            className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold hover:border-black/25"
          >
            Reset sample
          </button>
          {graph.status === 'frozen' ? (
            <button onClick={unfreezeGraph} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-semibold">Unfreeze to edit</button>
          ) : (
            <button
              onClick={handleFreeze}
              disabled={validationIssues.length > 0 || proposal?.status === 'pending'}
              className="rounded-lg bg-[#18211d] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm &amp; freeze
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-[#18211d] px-4 py-2 text-xs font-semibold text-white shadow-xl">
          {notice}
        </div>
      )}

      <section className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)_320px]">
        <aside className="border-b border-black/10 bg-[#fbfaf7] p-4 lg:border-b-0 lg:border-r">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-black/45">Node palette</p>
          <p className="mb-4 text-[11px] leading-4 text-black/45">Drag onto the canvas or click to add.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {palette.map((item) => {
              const singletonExists =
                (item.kind === 'start' || item.kind === 'end') && graph.nodes.some((node) => node.kind === item.kind);
              return (
                <button
                  key={item.kind}
                  draggable={!singletonExists && graph.status === 'draft'}
                  disabled={singletonExists || graph.status === 'frozen'}
                  onDragStart={(event) => onDragStart(event, item.kind)}
                  onClick={() => addNode(item.kind)}
                  className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-left text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Contract health</span>
              <span className={validationIssues.length ? 'text-amber-700' : 'text-emerald-700'}>
                {validationIssues.length ? `${validationIssues.length} issues` : 'Valid'}
              </span>
            </div>
            {validationIssues.length > 0 && (
              <ul className="mt-3 space-y-2 text-[11px] leading-4 text-black/55">
                {validationIssues.slice(0, 4).map((entry, index) => (
                  <li key={`${entry.code}-${index}`} className="rounded-lg bg-amber-50 px-2.5 py-2">{entry.message}</li>
                ))}
                {validationIssues.length > 4 && <li>+ {validationIssues.length - 4} more</li>}
              </ul>
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-[#18211d] p-3 text-white">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Demo tip</p>
            <p className="mt-2 text-[11px] leading-5 text-white/75">Add Fraud Check, remove Billing → Refund, then connect Billing → Fraud Check → Refund.</p>
          </div>
        </aside>

        <section className="flex min-h-[610px] min-w-0 flex-col p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider ${graph.status === 'frozen' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{graph.status}</span>
                <span className="text-[11px] text-black/40">{graph.nodes.length} nodes · {graph.edges.length} edges</span>
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">{graph.name}</h1>
            </div>
            {proposal && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">Proposal overlay · accepted graph unchanged</div>
            )}
          </div>

          <div className="relative min-h-[520px] flex-1 overflow-hidden rounded-2xl border border-black/10 bg-[#fbfaf7] shadow-sm">
            {graph.status === 'frozen' && (
              <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-[#18211d] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">Frozen contract</div>
            )}
            <ReactFlow<ContractFlowNode, Edge>
              nodes={displayNodes}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelection({ type: 'node', id: node.id })}
              onEdgeClick={(_, edge) => setSelection({ type: 'edge', id: edge.id })}
              onPaneClick={clearSelection}
              onNodeDragStop={(_, node) => moveNode(node.id, node.position)}
              onDrop={onDrop}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              nodesDraggable={graph.status === 'draft'}
              nodesConnectable={graph.status === 'draft'}
              elementsSelectable
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.35}
              maxZoom={1.6}
              deleteKeyCode={null}
            >
              <Background gap={24} size={1} color="#d8d6d0" />
              <MiniMap pannable zoomable className="!rounded-xl !border !border-black/10 !bg-white" />
              <Controls showInteractive={false} className="!overflow-hidden !rounded-xl !border-black/10 !shadow-sm" />
            </ReactFlow>
          </div>
        </section>

        <aside className="border-t border-black/10 bg-[#fbfaf7] p-4 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-2 rounded-xl bg-black/5 p-1">
            <button onClick={() => setRightTab('review')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${rightTab === 'review' ? 'bg-white shadow-sm' : 'text-black/50'}`}>Edit &amp; review</button>
            <button onClick={() => setRightTab('scenarios')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${rightTab === 'scenarios' ? 'bg-white shadow-sm' : 'text-black/50'}`}>Scenarios {scenarios.length > 0 ? `(${scenarios.length})` : ''}</button>
          </div>

          {rightTab === 'review' ? (
            <div className="mt-4 space-y-4"><Inspector /><ProposalPanel /></div>
          ) : (
            <ScenarioPanel scenarios={scenarios} frozen={graph.status === 'frozen'} onExportGraph={exportGraph} onExportScenarios={exportScenarios} onExportPython={exportPython} />
          )}
        </aside>
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
  return (
    <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold">
      <span className={`h-2 w-2 rounded-full ${presentation[1]}`} />{presentation[0]}
    </div>
  );
}

function Inspector() {
  const graph = useGraphStore((state) => state.graph);
  const selection = useGraphStore((state) => state.selection);
  const updateNode = useGraphStore((state) => state.updateNode);
  const removeNode = useGraphStore((state) => state.removeNode);
  const updateEdge = useGraphStore((state) => state.updateEdge);
  const removeEdge = useGraphStore((state) => state.removeEdge);
  const node = selection?.type === 'node' ? graph.nodes.find((item) => item.id === selection.id) : undefined;
  const edge = selection?.type === 'edge' ? graph.edges.find((item) => item.id === selection.id) : undefined;

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-black/40">Inspector</p>
      {!node && !edge && <p className="mt-3 text-xs leading-5 text-black/50">Select a node or edge to configure it. Connect nodes by dragging between their handles.</p>}
      {node && (
        <div className="mt-3 space-y-3">
          <Field label="Label"><input value={node.label} disabled={graph.status === 'frozen'} onChange={(event) => updateNode(node.id, { label: event.target.value })} className="input" /></Field>
          <Field label="Description"><textarea value={node.description ?? ''} disabled={graph.status === 'frozen'} onChange={(event) => updateNode(node.id, { description: event.target.value })} className="input min-h-16 resize-y" placeholder="What happens at this step?" /></Field>
          {['agent', 'action', 'tool'].includes(node.kind) && (
            <div className="rounded-xl border border-black/8 bg-[#f7f6f2] p-3">
              <label className="flex items-center justify-between gap-3 text-xs font-semibold">
                Embedded human input
                <input
                  type="checkbox"
                  checked={Boolean(node.hitl?.enabled)}
                  disabled={graph.status === 'frozen'}
                  onChange={(event) => updateNode(node.id, { hitl: { enabled: event.target.checked, timing: node.hitl?.timing ?? 'before', inputType: node.hitl?.inputType ?? 'approval' } })}
                />
              </label>
              {node.hitl?.enabled && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Field label="Timing">
                    <select className="input" value={node.hitl.timing ?? 'before'} onChange={(event) => updateNode(node.id, { hitl: { ...node.hitl!, timing: event.target.value as NonNullable<GraphNode['hitl']>['timing'] } })}>
                      <option value="before">Before</option><option value="after">After</option><option value="conditional">Conditional</option>
                    </select>
                  </Field>
                  <Field label="Input">
                    <select className="input" value={node.hitl.inputType ?? 'approval'} onChange={(event) => updateNode(node.id, { hitl: { ...node.hitl!, inputType: event.target.value as NonNullable<GraphNode['hitl']>['inputType'] } })}>
                      <option value="approval">Approval</option><option value="text">Text</option><option value="selection">Selection</option>
                    </select>
                  </Field>
                </div>
              )}
            </div>
          )}
          <button disabled={graph.status === 'frozen'} onClick={() => removeNode(node.id)} className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40">Remove node</button>
        </div>
      )}
      {edge && (
        <div className="mt-3 space-y-3">
          <Field label="Routing mode">
            <select
              value={edge.mode}
              disabled={graph.status === 'frozen'}
              onChange={(event) => updateEdge(edge.id, { mode: event.target.value as GraphEdge['mode'], label: event.target.value === 'normal' ? undefined : edge.label })}
              className="input"
            >
              <option value="normal">Normal</option><option value="conditional">Conditional</option><option value="fallback">Fallback</option>
            </select>
          </Field>
          {edge.mode !== 'normal' && <Field label={edge.mode === 'fallback' ? 'Fallback label' : 'Unique branch label'}><input value={edge.label ?? ''} disabled={graph.status === 'frozen'} onChange={(event) => updateEdge(edge.id, { label: event.target.value })} className="input" placeholder={edge.mode === 'fallback' ? 'fallback' : 'e.g. high_value'} /></Field>}
          {edge.mode === 'conditional' && <Field label="Trigger condition (optional)"><input value={edge.condition ?? ''} disabled={graph.status === 'frozen'} onChange={(event) => updateEdge(edge.id, { condition: event.target.value })} className="input" placeholder="refund_total > 500" /></Field>}
          <button disabled={graph.status === 'frozen'} onClick={() => removeEdge(edge.id)} className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40">Remove edge</button>
        </div>
      )}
    </section>
  );
}

function ProposalPanel() {
  const proposal = useGraphStore((state) => state.proposal);
  const approveProposal = useGraphStore((state) => state.approveProposal);
  const rejectProposal = useGraphStore((state) => state.rejectProposal);

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-black/40">Agent proposal</p>
        {proposal && <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase ${proposal.status === 'pending' ? 'bg-amber-100 text-amber-800' : proposal.status === 'invalid' ? 'bg-rose-100 text-rose-800' : 'bg-zinc-100 text-zinc-700'}`}>{proposal.status}</span>}
      </div>
      {!proposal ? (
        <div className="mt-3 rounded-xl border border-dashed border-black/15 bg-[#f7f6f2] p-3">
          <p className="text-xs font-semibold">No proposal waiting</p>
          <p className="mt-2 text-[11px] leading-5 text-black/50">Ask your external agent to call <code>get_graph</code>, then <code>propose_graph_changes</code>.</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-semibold leading-5">{proposal.rationale}</p>
          <p className="mt-2 text-[11px] text-black/45">{proposal.operations.length} ordered operations · accepted graph unchanged</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
            {proposal.diff.addedNodeIds.map((id) => <DiffPill key={`an-${id}`} label={`+ node ${id}`} tone="green" />)}
            {proposal.diff.updatedNodeIds.map((id) => <DiffPill key={`un-${id}`} label={`~ node ${id}`} tone="amber" />)}
            {proposal.diff.removedNodeIds.map((id) => <DiffPill key={`rn-${id}`} label={`− node ${id}`} tone="red" />)}
            {proposal.diff.addedEdgeIds.map((id) => <DiffPill key={`ae-${id}`} label={`+ edge ${id}`} tone="green" />)}
            {proposal.diff.updatedEdgeIds.map((id) => <DiffPill key={`ue-${id}`} label={`~ edge ${id}`} tone="amber" />)}
            {proposal.diff.removedEdgeIds.map((id) => <DiffPill key={`re-${id}`} label={`− edge ${id}`} tone="red" />)}
          </div>
          {proposal.validationErrors && <ul className="mt-3 space-y-1.5 text-[11px] leading-4 text-rose-700">{proposal.validationErrors.slice(0, 4).map((entry, index) => <li key={`${entry.code}-${index}`} className="rounded-lg bg-rose-50 px-2.5 py-2">{entry.message}</li>)}</ul>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button disabled={proposal.status !== 'pending'} onClick={() => approveProposal()} className="rounded-lg bg-[#18211d] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">Approve</button>
            <button onClick={rejectProposal} className="rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-semibold">Reject</button>
          </div>
          <p className="mt-3 text-[10px] leading-4 text-black/45">These actions are intentionally UI-only and are not exposed as WebMCP tools.</p>
        </div>
      )}
    </section>
  );
}

function DiffPill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' }) {
  const toneClass = { green: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-800', red: 'bg-rose-50 text-rose-800' }[tone];
  return <span className={`rounded-md px-2 py-1 ${toneClass}`}>{label}</span>;
}

function ScenarioPanel({ scenarios, frozen, onExportGraph, onExportScenarios, onExportPython }: { scenarios: BranchScenario[]; frozen: boolean; onExportGraph: () => void; onExportScenarios: () => void; onExportPython: () => void }) {
  return (
    <section className="mt-4">
      {!frozen ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-5 text-center">
          <p className="text-sm font-semibold">Freeze a valid contract</p>
          <p className="mt-2 text-xs leading-5 text-black/50">GraphContract will enumerate every reachable Start-to-End path and unlock the downloads.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-[#18211d] p-4 text-white">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/50">Frozen contract</p>
            <p className="mt-2 text-2xl font-semibold">{scenarios.length} paths</p>
            <p className="mt-1 text-[11px] leading-5 text-white/60">Every reachable execution path is represented below.</p>
          </div>
          <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {scenarios.map((scenario) => (
              <article key={scenario.id} className="rounded-xl border border-black/10 bg-white p-3">
                <p className="text-xs font-semibold leading-5">{scenario.name}</p>
                {scenario.triggeringConditions.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{scenario.triggeringConditions.map((condition) => <span key={condition.edgeId} className="rounded bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-800">{condition.label}</span>)}</div>}
              </article>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <button onClick={onExportGraph} className="download-button">Download graph-contract.json</button>
            <button onClick={onExportScenarios} className="download-button">Download graph-test-scenarios.json</button>
            <button onClick={onExportPython} className="download-button">Download test_graph_paths.py</button>
          </div>
        </>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[10px] font-bold uppercase tracking-wider text-black/45">{label}<div className="mt-1.5 normal-case tracking-normal text-black">{children}</div></label>;
}
