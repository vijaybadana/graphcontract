'use client';

import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { useMemo } from 'react';

import {
  type CanvasReviewProjection,
  type CanvasFlowEdge,
  projectGraphToCanvas,
  proposalReviewToCanvasProjection,
} from '@/src/adapters/react-flow/project-graph';
import type {
  ProposalComparison,
  ProposalComparisonEntry,
} from '@/src/application/proposal-comparison';
import type { WorkflowGraph } from '@/src/domain';
import { ContractNode } from '@/src/features/canvas/contract-node';
import { ExternalSystemTile } from '@/src/features/canvas/external-system-tile';
import { MergeNode } from '@/src/features/canvas/merge-node';
import { RoutingEdge } from '@/src/features/canvas/routing-edge';
import { SubgraphNode } from '@/src/features/canvas/subgraph-node';
import { SystemRelationshipEdge } from '@/src/features/canvas/system-relationship-edge';

import './proposal-overview.css';

const nodeTypes = {
  contractNode: ContractNode,
  mergeJunction: MergeNode,
  subgraph: SubgraphNode,
  externalSystemTile: ExternalSystemTile,
};

const edgeTypes = {
  routing: RoutingEdge,
  systemRelationship: SystemRelationshipEdge,
};

type DiffSection = {
  id: string;
  label: string;
  entries: ProposalComparisonEntry<unknown>[];
};

export type ProposalReviewEntry = {
  key: string;
  section: string;
  sectionLabel: string;
  entry: ProposalComparisonEntry<unknown>;
  changeIndex: number | null;
};

function readOnlyProjection(
  graph: WorkflowGraph,
  reviewProjection: CanvasReviewProjection | null,
) {
  const projected = projectGraphToCanvas(graph, reviewProjection);
  return {
    nodes: projected.nodes.map((node) => ({
      ...node,
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
      focusable: false,
      data: {
        ...node.data,
        collapseEditable: false,
        onToggleCollapse: undefined,
        onEvidenceActivate: undefined,
        onModifierActivate: undefined,
      },
    })),
    edges: projected.edges.map((edge): CanvasFlowEdge => ({
      ...edge,
      selectable: false,
      reconnectable: false,
      deletable: false,
      focusable: false,
      data: edge.data
        ? {
            ...edge.data,
            onEvidenceActivate: undefined,
            onRelationshipActivate: undefined,
          }
        : edge.data,
    } as CanvasFlowEdge)),
  };
}

function ProposalGraphOverview({
  graph,
  reviewProjection,
}: {
  graph: WorkflowGraph;
  reviewProjection: CanvasReviewProjection | null;
}) {
  const projection = useMemo(
    () => readOnlyProjection(graph, reviewProjection),
    [graph, reviewProjection],
  );

  return (
    <article className="proposal-overview-graph">
      <div className="proposal-overview-canvas" aria-hidden="true" inert>
        <ReactFlowProvider>
          <ReactFlow
            nodes={projection.nodes}
            edges={projection.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.24, minZoom: 0.05, maxZoom: 0.46 }}
            minZoom={0.05}
            maxZoom={0.46}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
          />
        </ReactFlowProvider>
      </div>
    </article>
  );
}

function entrySummary(entry: ProposalComparisonEntry<unknown>) {
  const fields = entry.state === 'updated' && entry.changedFields.length > 0
    ? ` (${entry.changedFields.join(', ')})`
    : '';
  return `${entry.state} ${entry.id}${fields}`;
}

export function valueAtChangedPath(value: unknown, path: string): unknown {
  if (path === '*') return value;
  const normalizedPath = path
    .replace(/^\*/, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^\./, '');
  if (!normalizedPath) return value;

  return normalizedPath.split('.').reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) return current[Number(segment)];
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
}

function stableSerializableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSerializableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableSerializableValue(nested)]),
    );
  }
  return value;
}

export function accessibleComparisonValue(value: unknown): string {
  if (value === undefined) return 'Not present';
  if (value === null) return 'None';
  if (typeof value === 'string') return value.length > 0 ? value : 'Empty text';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(stableSerializableValue(value));
}

export function changedValueRows(entry: ProposalComparisonEntry<unknown>) {
  const flattenedPaths = (value: unknown, prefix = ''): string[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return prefix ? [prefix] : ['*'];
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return prefix ? [prefix] : ['*'];
    return entries.flatMap(([key, nested]) =>
      flattenedPaths(nested, prefix ? `${prefix}.${key}` : key));
  };
  const configuredPaths = entry.changedFields.length > 0 ? entry.changedFields : ['*'];
  const paths = configuredPaths.length === 1 && configuredPaths[0] === '*'
    ? [...new Set([
        ...flattenedPaths(entry.before),
        ...flattenedPaths(entry.after),
      ])].filter((path) => path !== '*' || !entry.before && !entry.after).sort()
    : configuredPaths;
  return paths.map((path) => ({
    path,
    before: accessibleComparisonValue(valueAtChangedPath(entry.before, path)),
    after: accessibleComparisonValue(valueAtChangedPath(entry.after, path)),
  }));
}

export function proposalReviewEntries(
  comparison: ProposalComparison,
  changedOnly = true,
): ProposalReviewEntry[] {
  const sections: DiffSection[] = [
    { id: 'nodes', label: 'Nodes', entries: Object.values(comparison.nodes) as ProposalComparisonEntry<unknown>[] },
    { id: 'subgraphs', label: 'Subgraphs', entries: Object.values(comparison.subgraphs) as ProposalComparisonEntry<unknown>[] },
    { id: 'native-edges', label: 'Native edges', entries: Object.values(comparison.nativeEdges) as ProposalComparisonEntry<unknown>[] },
    { id: 'relationships', label: 'Non-native relationships', entries: Object.values(comparison.relationships) as ProposalComparisonEntry<unknown>[] },
    { id: 'capabilities', label: 'Capabilities', entries: Object.values(comparison.capabilities) as ProposalComparisonEntry<unknown>[] },
  ];
  const entries = sections.flatMap((section) => section.entries
    .filter((entry) => !changedOnly || entry.state !== 'unchanged')
    .map((entry) => ({
      key: `${section.id}:${entry.id}`,
      section: section.id,
      sectionLabel: section.label,
      entry,
      changeIndex: null,
    })));
  const changedKeys = new Map(entries
    .filter(({ entry }) => entry.state !== 'unchanged')
    .map(({ key }, index) => [key, index]));

  return entries.map((entry) => ({
    ...entry,
    changeIndex: changedKeys.get(entry.key) ?? null,
  }));
}

export function ProposalOverview({
  comparison,
  onChangeSelect,
  changeButtonRef,
}: {
  comparison: ProposalComparison;
  onChangeSelect?: (entry: ProposalReviewEntry, trigger: HTMLButtonElement) => void;
  changeButtonRef?: (entry: ProposalReviewEntry, element: HTMLButtonElement | null) => void;
}) {
  const allEntries = proposalReviewEntries(comparison);
  const total = allEntries.length;
  const added = allEntries.filter(({ entry }) => entry.state === 'added').length;
  const updated = allEntries.filter(({ entry }) => entry.state === 'updated').length;
  const removed = allEntries.filter(({ entry }) => entry.state === 'removed').length;
  const reviewProjection = proposalReviewToCanvasProjection(comparison);

  return (
    <section className="proposal-overview" aria-labelledby="proposal-overview-title">
      <div className="proposal-overview-heading">
        <h3 id="proposal-overview-title">Graph overview</h3>
        <span className="proposal-overview-count">{total} changed</span>
      </div>

      <ProposalGraphOverview graph={comparison.base} reviewProjection={reviewProjection} />

      <div className="proposal-overview-totals" aria-label="Proposal change counts">
        <span data-diff-state="added"><strong>+{added}</strong> Added</span>
        <span data-diff-state="updated"><strong>~{updated}</strong> Updated</span>
        <span data-diff-state="removed"><strong>−{removed}</strong> Removed</span>
      </div>

      <div className="proposal-overview-summary" aria-label="Proposal diff summary">
        <h3>Changes</h3>
        {total === 0 && <p>No effective graph changes</p>}
        <div className="proposal-overview-change-list">
          {allEntries.map((reviewEntry) => {
            const { sectionLabel: section, entry } = reviewEntry;
            return (
            <button
              key={`${section}-${entry.id}`}
              type="button"
              className="proposal-overview-change"
              data-diff-state={entry.state}
              aria-label={`Review ${entry.state} ${entry.id}`}
              ref={(element) => changeButtonRef?.(reviewEntry, element)}
              onClick={(event) => onChangeSelect?.(reviewEntry, event.currentTarget)}
            >
                <span className="proposal-overview-change__mark">{entry.state === 'added' ? '+' : entry.state === 'removed' ? '−' : '~'}</span>
                <span><strong>{entry.id}</strong><small>{section} · {entrySummary(entry)}</small></span>
            </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
