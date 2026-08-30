'use client';

import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { useMemo } from 'react';

import {
  type CanvasFlowEdge,
  projectGraphToCanvas,
} from '@/src/adapters/react-flow/project-graph';
import type {
  ProposalComparison,
  ProposalComparisonEntry,
  ProposalComparisonState,
} from '@/src/application/proposal-comparison';
import type { GraphProposal } from '@/src/domain';
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

const idsWithState = <T,>(
  collection: Record<string, ProposalComparisonEntry<T>>,
  state: ProposalComparisonState,
) => Object.values(collection)
  .filter((entry) => entry.state === state)
  .map((entry) => entry.id);

function comparisonDiff(
  comparison: ProposalComparison,
  source: GraphProposal['diff'],
): GraphProposal['diff'] {
  return {
    ...source,
    addedNodeIds: idsWithState(comparison.nodes, 'added'),
    updatedNodeIds: idsWithState(comparison.nodes, 'updated'),
    removedNodeIds: idsWithState(comparison.nodes, 'removed'),
    addedSubgraphIds: idsWithState(comparison.subgraphs, 'added'),
    updatedSubgraphIds: idsWithState(comparison.subgraphs, 'updated'),
    removedSubgraphIds: idsWithState(comparison.subgraphs, 'removed'),
    membershipChangedNodeIds: [],
    addedEdgeIds: idsWithState(comparison.nativeEdges, 'added'),
    updatedEdgeIds: idsWithState(comparison.nativeEdges, 'updated'),
    removedEdgeIds: idsWithState(comparison.nativeEdges, 'removed'),
    addedRelationshipIds: idsWithState(comparison.relationships, 'added'),
    updatedRelationshipIds: idsWithState(comparison.relationships, 'updated'),
    removedRelationshipIds: idsWithState(comparison.relationships, 'removed'),
  };
}

function readOnlyProjection(
  comparison: ProposalComparison,
  proposal: GraphProposal | null,
) {
  const projected = projectGraphToCanvas(comparison.base, proposal);
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
  comparison,
  proposal,
}: {
  label: string;
  comparison: ProposalComparison;
  proposal: GraphProposal | null;
}) {
  const projection = useMemo(
    () => readOnlyProjection(comparison, proposal),
    [comparison, proposal],
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

export function ProposalOverview({
  comparison,
  proposal,
}: {
  comparison: ProposalComparison;
  proposal: GraphProposal;
}) {
  const sections: DiffSection[] = [
    { id: 'nodes', label: 'Nodes', entries: changedEntries(comparison.nodes) },
    { id: 'subgraphs', label: 'Subgraphs', entries: changedEntries(comparison.subgraphs) },
    { id: 'native-edges', label: 'Native edges', entries: changedEntries(comparison.nativeEdges) },
    { id: 'relationships', label: 'Non-native relationships', entries: changedEntries(comparison.relationships) },
    { id: 'capabilities', label: 'Capabilities', entries: changedEntries(comparison.capabilities) },
  ].filter((section) => section.entries.length > 0);
  const total = sections.reduce((count, section) => count + section.entries.length, 0);
  const displayProposal = useMemo<GraphProposal>(() => ({
    ...proposal,
    // Stale candidates remain visible for human review, but the projector only
    // previews active statuses. This clone is presentation-only and cannot be approved.
    status: comparison.approvable ? 'pending' : 'invalid',
    diff: comparisonDiff(comparison, proposal.diff),
  }), [comparison, proposal]);

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
        <ProposalGraphOverview label="Before" comparison={comparison} proposal={null} />
        <ProposalGraphOverview label="Proposed" comparison={comparison} proposal={displayProposal} />
      </div>

      <div className="proposal-overview-summary" aria-label="Proposal diff summary">
        <strong>{total === 0 ? 'No effective graph changes' : `${total} effective graph changes`}</strong>
        {sections.length > 0 && (
          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <span>{section.label}</span>
                <span>{section.entries.map(entrySummary).join('; ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
