import { createDefaultGraphCapabilities, type RuntimeProjectionFixture, type WorkflowGraph } from '@/src/domain';

/** An authored Package 3 contract; concrete workers live only in its fixture. */
export const dynamicParallelismDemoGraph: WorkflowGraph = {
  schemaVersion: '6',
  id: 'dynamic-parallelism-merge-demo',
  name: 'Parallel research · Send ×N',
  status: 'draft',
  updatedAt: '2026-08-30T00:00:00.000Z',
  capabilities: createDefaultGraphCapabilities(),
  nodes: [
    { id: 'parallel-start', kind: 'start', label: 'Start', position: { x: 48, y: 244 } },
    {
      id: 'generate-queries',
      kind: 'step',
      executor: 'ai',
      label: 'Generate queries',
      description: 'Produces a dynamic set of research queries.',
      position: { x: 250, y: 230 },
    },
    {
      id: 'search-evidence',
      kind: 'step',
      executor: 'tool',
      label: 'Search evidence',
      description: 'Worker template for each generated query.',
      position: { x: 520, y: 230 },
    },
    {
      id: 'merge-evidence',
      kind: 'merge',
      label: 'Merge evidence',
      position: { x: 810, y: 230 },
      merge: {
        reducer: { name: 'concatenate', aggregateState: 'evidence' },
        completion: { mode: 'all' },
        continuation: { mode: 'once' },
        waitingForDynamicInputs: true,
      },
    },
    {
      id: 'reflect',
      kind: 'step',
      executor: 'ai',
      label: 'Reflect',
      position: { x: 1080, y: 230 },
    },
    { id: 'parallel-end', kind: 'end', label: 'End', position: { x: 1320, y: 244 } },
  ],
  edges: [
    { id: 'parallel-start-generate', source: 'parallel-start', target: 'generate-queries', mode: 'normal' },
    {
      id: 'parallel-send-search',
      source: 'generate-queries',
      target: 'search-evidence',
      mode: 'send',
      send: {
        destinationTemplateId: 'search-evidence',
        multiplicity: 'dynamic',
        payloadLabel: 'query',
        mergeNodeId: 'merge-evidence',
        payloadSchemaRef: 'ResearchQuery',
      },
    },
    { id: 'parallel-search-merge', source: 'search-evidence', target: 'merge-evidence', mode: 'normal' },
    { id: 'parallel-merge-reflect', source: 'merge-evidence', target: 'reflect', mode: 'normal' },
    { id: 'parallel-reflect-end', source: 'reflect', target: 'parallel-end', mode: 'normal' },
  ],
  subgraphs: [],
  relationships: [],
};

/** Bound to the currently accepted demo revision at projection time. */
export function runtimeFixtureForLoadedDynamicParallelismDemo(
  graph: WorkflowGraph,
): RuntimeProjectionFixture | null {
  if (graph.id !== dynamicParallelismDemoGraph.id) return null;
  return {
    graphId: graph.id,
    graphUpdatedAt: graph.updatedAt,
    instances: [
      { id: 'research-worker-1', sendEdgeId: 'parallel-send-search', templateNodeId: 'search-evidence', label: 'Search evidence · query 1', ordinal: 1 },
      { id: 'research-worker-2', sendEdgeId: 'parallel-send-search', templateNodeId: 'search-evidence', label: 'Search evidence · query 2', ordinal: 2 },
      { id: 'research-worker-3', sendEdgeId: 'parallel-send-search', templateNodeId: 'search-evidence', label: 'Search evidence · query 3', ordinal: 3 },
    ],
  };
}
