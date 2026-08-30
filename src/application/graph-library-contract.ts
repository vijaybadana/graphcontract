import type { BranchScenario, WorkflowGraph } from '@/src/domain';

export const GRAPH_LIBRARY_ENTRY_COUNT = 10;
export const GRAPH_LIBRARY_DISCLAIMER = 'Normalized — no source code copied';

export type GraphLibraryComplexity = 'foundational' | 'intermediate' | 'advanced';

export type GraphLibrarySource = {
  owner: string;
  repository: string;
  url: `https://github.com/${string}`;
  /** Records concepts intentionally omitted because the active schema cannot represent them truthfully. */
  note?: string;
};

/**
 * Author-owned metadata and a canonical schema-v6 fixture. Repository metadata
 * is presentation-only and never participates in graph identity or loading.
 */
export type GraphLibraryDefinition = {
  id: string;
  title: string;
  outcome: string;
  domain: string;
  complexity: GraphLibraryComplexity;
  concepts: readonly string[];
  source: GraphLibrarySource;
  graph: WorkflowGraph;
};

/** Derived data is built through the same scenario service used by the workspace. */
export type GraphLibraryEntry = GraphLibraryDefinition & {
  scenarioSummary: {
    pathCount: number;
    scenarios: readonly BranchScenario[];
  };
};

export function graphLibrarySourceLabel(source: GraphLibrarySource) {
  return `Inspired by ${source.owner}/${source.repository}`;
}

/** Every open receives a private graph copy; registry fixtures remain immutable inputs. */
export function cloneGraphLibraryGraph(entry: Pick<GraphLibraryEntry, 'graph'>): WorkflowGraph {
  return structuredClone(entry.graph);
}
