import type { ProposalReview } from '@/src/application/proposal-comparison';
import type { GraphEdge, NonNativeRelationship, WorkflowGraph } from '@/src/domain';
import type { BranchScenario } from '@/src/domain';
import { proposalScenarioKey } from '@/src/application/proposal-review';
import type { ProposalReviewEntry } from '@/src/features/proposals/proposal-overview';
import { proposalReviewEntries } from '@/src/features/proposals/proposal-overview';

export type ProposalCanvasFocus = {
  key: string;
  nodeIds: string[];
  edgeIds: string[];
  contextNodeIds: string[];
  contextEdgeIds: string[];
  relationshipId: string | null;
  fitNodeIds: string[];
  /** Single-node review rows use a readable detail camera; topology rows fit context. */
  cameraMode: 'detail' | 'context';
};

/** Candidate scenario focus is presentation-only and cannot alter accepted state. */
export function proposalCanvasFocusForScenario(scenario: BranchScenario | null): ProposalCanvasFocus | null {
  if (!scenario) return null;
  return {
    key: proposalScenarioKey(scenario),
    nodeIds: [...new Set(scenario.orderedPath)],
    edgeIds: [...new Set(scenario.traversedEdges.map((edge) => edge.id))],
    contextNodeIds: [],
    contextEdgeIds: [],
    relationshipId: null,
    fitNodeIds: [...new Set(scenario.orderedPath)],
    cameraMode: 'context',
  };
}

const endpointId = (endpoint: NonNativeRelationship['source']) =>
  endpoint.kind === 'node'
    ? endpoint.nodeId
    : `external-system:${encodeURIComponent(endpoint.externalId)}`;

/** Maps one proposal-review row to ephemeral React Flow targets. */
export function proposalCanvasFocusFor(
  reviewEntry: ProposalReviewEntry | null,
  graphs: readonly Pick<WorkflowGraph, 'nodes' | 'edges'>[] = [],
): ProposalCanvasFocus | null {
  if (!reviewEntry) return null;
  const value = reviewEntry.entry.after ?? reviewEntry.entry.before;

  if (reviewEntry.section === 'nodes' || reviewEntry.section === 'subgraphs') {
    const incidentEdges = reviewEntry.section === 'nodes'
      ? [...new Map(graphs.flatMap((graph) => graph.edges).map((edge) => [edge.id, edge])).values()]
        .filter((edge) => edge.source === reviewEntry.entry.id || edge.target === reviewEntry.entry.id)
      : [];
    const contextNodeIds = [...new Set(incidentEdges.flatMap((edge) => [edge.source, edge.target]))]
      .filter((id) => id !== reviewEntry.entry.id);
    return {
      key: reviewEntry.key,
      nodeIds: [reviewEntry.entry.id],
      edgeIds: [],
      contextNodeIds,
      contextEdgeIds: incidentEdges.map((edge) => edge.id),
      relationshipId: null,
      // Context remains highlighted for orientation, but fitting it made a
      // changed node microscopic whenever an incident route spanned a large
      // subgraph. The camera belongs to the reviewed element itself.
      fitNodeIds: reviewEntry.section === 'nodes'
        ? [reviewEntry.entry.id]
        : [reviewEntry.entry.id, ...contextNodeIds],
      cameraMode: reviewEntry.section === 'nodes' ? 'detail' : 'context',
    };
  }

  if (reviewEntry.section === 'native-edges' && value) {
    const edge = value as GraphEdge;
    return {
      key: reviewEntry.key,
      nodeIds: [edge.source, edge.target],
      edgeIds: [edge.id],
      contextNodeIds: [],
      contextEdgeIds: [],
      relationshipId: null,
      fitNodeIds: [edge.source, edge.target],
      cameraMode: 'context',
    };
  }

  if (reviewEntry.section === 'relationships' && value) {
    const relationship = value as NonNativeRelationship;
    const fitNodeIds = [endpointId(relationship.source), endpointId(relationship.target)];
    return {
      key: reviewEntry.key,
      nodeIds: fitNodeIds,
      edgeIds: [],
      contextNodeIds: [],
      contextEdgeIds: [],
      relationshipId: relationship.id,
      fitNodeIds,
      cameraMode: 'context',
    };
  }

  return {
    key: reviewEntry.key,
    nodeIds: [],
    edgeIds: [],
    contextNodeIds: [],
    contextEdgeIds: [],
    relationshipId: null,
    fitNodeIds: [],
    cameraMode: 'context',
  };
}

/**
 * Proposal entry starts by framing the added region, not the entire candidate.
 * If a proposal only updates or removes existing elements, frame those changes
 * at their accepted coordinates instead. Per-change navigation subsequently
 * replaces this aggregate focus with the selected review row.
 */
export function proposalInitialCanvasFitNodeIds(review: ProposalReview | null): string[] {
  if (review?.kind !== 'comparable') return [];
  const changed = proposalReviewEntries(review, false)
    .filter(({ entry }) => entry.state !== 'unchanged');
  const added = changed.filter(({ entry }) => entry.state === 'added');
  const targets = added.length > 0 ? added : changed;
  return [...new Set(targets.flatMap((entry) => (
    proposalCanvasFocusFor(entry, [review.base, review.candidate])?.fitNodeIds ?? []
  )))];
}
