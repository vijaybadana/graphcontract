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

type ComparisonCollection = ProposalComparison['nodes'];

type DiffSection = {
  id: string;
  label: string;
  entries: ProposalComparisonEntry<unknown>[];
};

const changedEntries = (
  collection: ComparisonCollection | ProposalComparison['capabilities'],
) => Object.values(collection)
  .filter((entry) => entry.state !== 'unchanged') as ProposalComparisonEntry<unknown>[];

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
  label,
  graph,
  reviewProjection,
}: {
  label: string;
  graph: WorkflowGraph;
  reviewProjection: CanvasReviewProjection | null;
}) {
  const projection = useMemo(
    () => readOnlyProjection(graph, reviewProjection),
    [graph, reviewProjection],
  );

  return (
    <article className="proposal-overview-graph">
      <h4>{label}</h4>
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

function valueAtChangedPath(value: unknown, path: string): unknown {
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

function accessibleComparisonValue(value: unknown): string {
  if (value === undefined) return 'Not present';
  if (value === null) return 'None';
  if (typeof value === 'string') return value.length > 0 ? value : 'Empty text';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(stableSerializableValue(value));
}

function changedValueRows(entry: ProposalComparisonEntry<unknown>) {
  const paths = entry.changedFields.length > 0 ? entry.changedFields : ['*'];
  return paths.map((path) => ({
    path,
    before: accessibleComparisonValue(valueAtChangedPath(entry.before, path)),
    after: accessibleComparisonValue(valueAtChangedPath(entry.after, path)),
  }));
}

export function ProposalOverview({
  comparison,
}: {
  comparison: ProposalComparison;
}) {
  const sections: DiffSection[] = [
    { id: 'nodes', label: 'Nodes', entries: changedEntries(comparison.nodes) },
    { id: 'subgraphs', label: 'Subgraphs', entries: changedEntries(comparison.subgraphs) },
    { id: 'native-edges', label: 'Native edges', entries: changedEntries(comparison.nativeEdges) },
    { id: 'relationships', label: 'Non-native relationships', entries: changedEntries(comparison.relationships) },
    { id: 'capabilities', label: 'Capabilities', entries: changedEntries(comparison.capabilities) },
  ].filter((section) => section.entries.length > 0);
  const total = sections.reduce((count, section) => count + section.entries.length, 0);
  const reviewProjection = proposalReviewToCanvasProjection(comparison);

  return (
    <section className="proposal-overview" aria-labelledby="proposal-overview-title">
      <div className="proposal-overview-heading">
        <div>
          <p className="eyebrow">Read-only comparison</p>
          <h3 id="proposal-overview-title">Before / Proposed</h3>
        </div>
        <span className="proposal-overview-count">{total} changed</span>
      </div>

      <div className="proposal-overview-graphs">
        <ProposalGraphOverview label="Before" graph={comparison.base} reviewProjection={null} />
        <ProposalGraphOverview label="Proposed" graph={comparison.base} reviewProjection={reviewProjection} />
      </div>

      <div className="proposal-overview-summary" aria-label="Proposal diff summary">
        <strong>{total === 0 ? 'No effective graph changes' : `${total} effective graph changes`}</strong>
        {sections.length > 0 && (
          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <div className="proposal-overview-summary__section-heading">
                  <span>{section.label}</span>
                  <span>{section.entries.map(entrySummary).join('; ')}</span>
                </div>
                <div className="proposal-overview-summary__values">
                  {section.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="proposal-overview-summary__entry"
                      aria-label={`Changed values for ${entry.id}`}
                    >
                      <strong>{entry.id}</strong>
                      <dl>
                        {changedValueRows(entry).map((row) => (
                          <div key={row.path}>
                            <dt>{row.path === '*' ? 'Value' : row.path}</dt>
                            <dd>
                              <span>Before: {row.before}</span>
                              <span>Proposed: {row.after}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
