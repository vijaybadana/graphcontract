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

const filenameToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'scenario';

const pythonFilenameToken = (value: string) => filenameToken(value).replace(/-/g, '_');

function graphScenariosPayload(
  graph: WorkflowGraph,
  scenarios: BranchScenario[],
) {
  const normalized = normalizeWorkflowGraph(graph);
  return {
    graphId: normalized.id,
    graphName: normalized.name,
    graphUpdatedAt: normalized.updatedAt,
    graphSchemaVersion: normalized.schemaVersion,
    graphCapabilities: normalized.capabilities,
    graphRelationships: normalized.relationships,
    subgraphCapabilityOverrides: normalized.subgraphs.map((subgraph) => ({
      subgraphId: subgraph.id,
      ...(subgraph.capabilityOverrides ? { capabilityOverrides: subgraph.capabilityOverrides } : {}),
    })),
    generatedAt: new Date().toISOString(),
    scenarios,
  };
}

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
  return {
    filename: 'graph-test-scenarios.json',
    content: JSON.stringify(graphScenariosPayload(graph, scenarios), null, 2),
    type: 'application/json;charset=utf-8',
  };
}

export function buildGraphScenarioDownload(
  graph: WorkflowGraph,
  scenario: BranchScenario,
): DownloadArtifact {
  return {
    filename: `graph-test-${filenameToken(scenario.id)}.json`,
    content: JSON.stringify(graphScenariosPayload(graph, [scenario]), null, 2),
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

export function buildPythonScenarioDownload(
  graph: WorkflowGraph,
  scenario: BranchScenario,
): DownloadArtifact {
  return {
    filename: `test_graph_path_${pythonFilenameToken(scenario.id)}.py`,
    content: buildPythonTestSkeleton(graph, [scenario]),
    type: 'text/x-python;charset=utf-8',
  };
}
