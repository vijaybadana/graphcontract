import { buildPythonTestSkeleton, BranchScenario, WorkflowGraph } from '@/src/domain';

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadGraphContract(graph: WorkflowGraph) {
  downloadFile('graph-contract.json', JSON.stringify(graph, null, 2), 'application/json');
}

export function downloadGraphScenarios(graph: WorkflowGraph, scenarios: BranchScenario[]) {
  downloadFile(
    'graph-test-scenarios.json',
    JSON.stringify(
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
    'application/json',
  );
}

export function downloadPythonTests(graph: WorkflowGraph, scenarios: BranchScenario[]) {
  downloadFile(
    'test_graph_paths.py',
    buildPythonTestSkeleton(graph, scenarios),
    'text/x-python',
  );
}
