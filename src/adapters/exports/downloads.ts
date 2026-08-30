import {
  buildPythonTestSkeleton,
  BranchScenario,
  normalizeWorkflowGraph,
  WorkflowGraph,
} from '@/src/domain';

export type DownloadArtifact = {
  filename: string;
  content: string;
  type: string;
};

export function buildGraphContractDownload(graph: WorkflowGraph): DownloadArtifact {
  return {
    filename: 'graph-contract.json',
    content: JSON.stringify(normalizeWorkflowGraph(graph), null, 2),
    type: 'application/json;charset=utf-8',
  };
}

export function buildGraphScenariosDownload(
  graph: WorkflowGraph,
  scenarios: BranchScenario[],
): DownloadArtifact {
  const normalized = normalizeWorkflowGraph(graph);
  return {
    filename: 'graph-test-scenarios.json',
    content: JSON.stringify(
      {
        graphId: normalized.id,
        graphName: normalized.name,
        graphUpdatedAt: normalized.updatedAt,
        graphSchemaVersion: normalized.schemaVersion,
        graphCapabilities: normalized.capabilities,
        subgraphCapabilityOverrides: normalized.subgraphs.map((subgraph) => ({
          subgraphId: subgraph.id,
          ...(subgraph.capabilityOverrides ? { capabilityOverrides: subgraph.capabilityOverrides } : {}),
        })),
        generatedAt: new Date().toISOString(),
        scenarios,
      },
      null,
      2,
    ),
    type: 'application/json;charset=utf-8',
  };
}

export function buildPythonTestsDownload(
  graph: WorkflowGraph,
  scenarios: BranchScenario[],
): DownloadArtifact {
  return {
    filename: 'test_graph_paths.py',
    content: buildPythonTestSkeleton(graph, scenarios),
    type: 'text/x-python;charset=utf-8',
  };
}
