import {
  applyGraphOperations,
  GraphProposal,
  GraphSubgraph,
  NonNativeRelationship,
  proposalMatchesGraph,
  validateGraph,
  ValidationIssue,
  WorkflowGraph,
} from '@/src/domain';
import type { GraphEdge, GraphNode } from '@/src/domain';

export type ProposalComparisonState = 'added' | 'updated' | 'removed' | 'unchanged';

/**
 * A comparison record is keyed by stable domain identity, rather than by an
 * operation log or the stored proposal diff. That makes this the final review
 * truth even when operations are progressive (for example add then update).
 */
export type ProposalComparisonEntry<T> = {
  id: string;
  state: ProposalComparisonState;
  changedFields: string[];
  before?: T;
  after?: T;
};

export type ProposalComparison = {
  kind: 'comparable';
  /** Detached, normalized copies. The caller's accepted graph is never changed. */
  base: WorkflowGraph;
  candidate: WorkflowGraph;
  nodes: Record<string, ProposalComparisonEntry<GraphNode>>;
  subgraphs: Record<string, ProposalComparisonEntry<GraphSubgraph>>;
  nativeEdges: Record<string, ProposalComparisonEntry<GraphEdge>>;
  relationships: Record<string, ProposalComparisonEntry<NonNativeRelationship>>;
  capabilities: Record<string, ProposalComparisonEntry<unknown>>;
  operationErrors: ValidationIssue[];
  validationErrors: ValidationIssue[];
  declaredValidationErrors: ValidationIssue[];
  invalid: boolean;
  effectiveStatus: Exclude<GraphProposal['status'], 'stale'>;
  approvable: boolean;
};

export type StaleProposalReason =
  | 'base_graph_id_mismatch'
  | 'base_graph_updated_at_mismatch'
  | 'proposal_marked_stale';

/** A stale proposal cannot produce a candidate for review or projection. */
export type StaleProposalReview = {
  kind: 'stale';
  /** Detached, normalized copy of the only graph that remains authoritative. */
  accepted: WorkflowGraph;
  reason: StaleProposalReason;
};

export type ProposalReview = ProposalComparison | StaleProposalReview;

type Identified = { id: string };
type CapabilityRecord = { id: string; value: unknown };

const compareIds = (left: string, right: string) => left.localeCompare(right);

function stableIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((entry) => {
    const key = `${entry.code}\u0000${entry.path ?? ''}\u0000${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function staleProposalReason(
  proposal: GraphProposal,
  graph: WorkflowGraph,
): StaleProposalReason {
  if (proposal.baseGraphId !== graph.id) return 'base_graph_id_mismatch';
  if (proposal.baseUpdatedAt !== graph.updatedAt) return 'base_graph_updated_at_mismatch';
  return 'proposal_marked_stale';
}

/** Returns stable leaf paths without depending on object insertion order. */
export function changedFields(before: unknown, after: unknown, prefix = ''): string[] {
  if (Object.is(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    return Array.from({ length }, (_, index) => index).flatMap((index) => {
      const path = `${prefix || '*'}[${index}]`;
      if (index >= before.length || index >= after.length) return [path];
      return changedFields(before[index], after[index], path);
    });
  }
  if (Array.isArray(before) || Array.isArray(after)) return [prefix || '*'];
  if (!isRecord(before) || !isRecord(after)) return [prefix || '*'];

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(compareIds);
  return keys.flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in before) || !(key in after)) return [path];
    return changedFields(before[key], after[key], path);
  });
}

function compareById<T extends Identified>(
  beforeValues: readonly T[],
  afterValues: readonly T[],
): Record<string, ProposalComparisonEntry<T>> {
  const before = new Map(beforeValues.map((value) => [value.id, value]));
  const after = new Map(afterValues.map((value) => [value.id, value]));
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort(compareIds);

  return Object.fromEntries(ids.map((id) => {
    const previous = before.get(id);
    const next = after.get(id);
    const state: ProposalComparisonState = previous === undefined
      ? 'added'
      : next === undefined
        ? 'removed'
        : changedFields(previous, next).length > 0
          ? 'updated'
          : 'unchanged';
    return [id, {
      id,
      state,
      changedFields: previous !== undefined && next !== undefined
        ? changedFields(previous, next)
        : ['*'],
      ...(previous === undefined ? {} : { before: structuredClone(previous) }),
      ...(next === undefined ? {} : { after: structuredClone(next) }),
    }];
  }));
}

function capabilityRecords(graph: WorkflowGraph): CapabilityRecord[] {
  const records: CapabilityRecord[] = Object.entries(graph.capabilities)
    .map(([key, value]) => ({ id: `graph.${key}`, value }));
  for (const subgraph of graph.subgraphs) {
    for (const [key, value] of Object.entries(subgraph.capabilityOverrides ?? {})) {
      records.push({ id: `subgraph.${subgraph.id}.${key}`, value });
    }
  }
  return records.sort((left, right) => compareIds(left.id, right.id));
}

function compareCapabilities(
  before: WorkflowGraph,
  after: WorkflowGraph,
): Record<string, ProposalComparisonEntry<unknown>> {
  const previous = new Map(capabilityRecords(before).map((record) => [record.id, record.value]));
  const next = new Map(capabilityRecords(after).map((record) => [record.id, record.value]));
  const ids = [...new Set([...previous.keys(), ...next.keys()])].sort(compareIds);

  return Object.fromEntries(ids.map((id) => {
    const beforeValue = previous.get(id);
    const afterValue = next.get(id);
    const state: ProposalComparisonState = beforeValue === undefined
      ? 'added'
      : afterValue === undefined
        ? 'removed'
        : changedFields(beforeValue, afterValue).length > 0
          ? 'updated'
          : 'unchanged';
    return [id, {
      id,
      state,
      changedFields: beforeValue !== undefined && afterValue !== undefined
        ? changedFields(beforeValue, afterValue)
        : ['*'],
      ...(beforeValue === undefined ? {} : { before: structuredClone(beforeValue) }),
      ...(afterValue === undefined ? {} : { after: structuredClone(afterValue) }),
    }];
  }));
}

/**
 * Returns accepted-only review state for a stale proposal. Otherwise derives
 * a complete base-versus-final-candidate comparison from canonical operations.
 * `proposal.diff` is deliberately ignored: it is a convenient operation
 * summary, not final truth for progressive or invalid operations.
 */
export function deriveProposalComparison(
  graph: WorkflowGraph,
  proposal: GraphProposal,
): ProposalReview {
  // applyGraphOperations clones before it normalizes, so both snapshots are
  // detached and the accepted input remains immutable for review and approval.
  const accepted = applyGraphOperations(graph, []).graph;
  if (proposal.status === 'stale' || !proposalMatchesGraph(proposal, graph)) {
    return {
      kind: 'stale',
      accepted,
      reason: staleProposalReason(proposal, graph),
    };
  }

  const base = accepted;
  const applied = applyGraphOperations(base, proposal.operations);
  // Revalidate the graph produced by the same progressive replay instead of
  // trusting proposal errors that may describe an older accepted snapshot.
  const validationErrors = stableIssues([...applied.errors, ...validateGraph(applied.graph)]);
  const declaredValidationErrors = proposal.validationErrors ? structuredClone(proposal.validationErrors) : [];
  const invalid = validationErrors.length > 0 || proposal.status === 'invalid';
  const effectiveStatus: ProposalComparison['effectiveStatus'] = invalid ? 'invalid' : proposal.status;

  return {
    kind: 'comparable',
    base,
    candidate: applied.graph,
    nodes: compareById(base.nodes, applied.graph.nodes),
    subgraphs: compareById(base.subgraphs, applied.graph.subgraphs),
    nativeEdges: compareById(base.edges, applied.graph.edges),
    relationships: compareById(base.relationships, applied.graph.relationships),
    capabilities: compareCapabilities(base, applied.graph),
    operationErrors: structuredClone(applied.errors),
    validationErrors,
    declaredValidationErrors,
    invalid,
    effectiveStatus,
    approvable: effectiveStatus === 'pending',
  };
}
