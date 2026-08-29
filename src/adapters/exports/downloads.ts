import { buildPythonTestSkeleton, BranchScenario, WorkflowGraph } from '@/src/domain';

export type DownloadArtifact = {
  filename: string;
  content: string;
  type: string;
};

export function buildGraphContractDownload(graph: WorkflowGraph): DownloadArtifact {
  return {
    filename: 'graph-contract.json',
    content: JSON.stringify(graph, null, 2),
    type: 'application/json;charset=utf-8',
  };
}

export function buildGraphScenariosDownload(
  graph: WorkflowGraph,
  scenarios: BranchScenario[],
): DownloadArtifact {
  return {
    filename: 'graph-test-scenarios.json',
    content: JSON.stringify(
      {
        graphId: graph.id,
        graphName: graph.name,
        graphUpdatedAt: graph.updatedAt,
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
