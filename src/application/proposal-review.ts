import {
  type BranchScenario,
  enumerateScenariosBounded,
} from '@/src/domain';
import type {
  ProposalComparison,
  ProposalComparisonEntry,
  ProposalComparisonState,
  ProposalReview,
} from './proposal-comparison';

export type ProposalReviewNoteInput = {
  kind: 'change' | 'path';
  targetKey: string;
  feedback: string;
};

export type ProposalChangeReviewNote = {
  kind: 'change';
  targetKey: string;
  section: string;
  elementId: string;
  changeState: ProposalComparisonState;
  feedback: string;
};

export type ProposalPathReviewNote = {
  kind: 'path';
  targetKey: string;
  orderedNodeIds: string[];
  traversedEdgeIds: string[];
  terminalNodeId: string;
  terminalOutcome: BranchScenario['expectedTerminalOutcome'];
  feedback: string;
};

export type ProposalReviewNote = ProposalChangeReviewNote | ProposalPathReviewNote;

export type ProposalReviewSubmission = {
  feedback?: string;
  notes?: ProposalReviewNoteInput[];
};

const comparisonCollections = (comparison: ProposalComparison) => ({
  nodes: comparison.nodes,
  subgraphs: comparison.subgraphs,
  'native-edges': comparison.nativeEdges,
  relationships: comparison.relationships,
  capabilities: comparison.capabilities,
} satisfies Record<string, Record<string, ProposalComparisonEntry<unknown>>>);

/** Stable across scenario reordering: display ordinals and generated IDs are deliberately excluded. */
export function proposalScenarioKey(scenario: BranchScenario): string {
  const edgeSequence = scenario.traversedEdges.map((edge) => `${edge.id}:${edge.isLoop ? 'loop' : 'forward'}`);
  const humanSequence = scenario.humanOutcomes.map((outcome) => `${outcome.nodeId}:${outcome.outcomeId}`);
  return `path:${scenario.orderedPath.join('>')}|edges:${edgeSequence.join('>')}|human:${humanSequence.join('>')}`;
}

export function proposalCandidateScenarios(review: ProposalReview | null): BranchScenario[] {
  if (review?.kind !== 'comparable' || review.invalid) return [];
  const result = enumerateScenariosBounded(review.candidate);
  return result.ok ? result.scenarios : [];
}

function resolveChangeNote(
  comparison: ProposalComparison,
  input: ProposalReviewNoteInput,
): ProposalChangeReviewNote | null {
  const separator = input.targetKey.indexOf(':');
  if (separator < 1) return null;
  const section = input.targetKey.slice(0, separator);
  const elementId = input.targetKey.slice(separator + 1);
  const collections = comparisonCollections(comparison);
  if (!(section in collections)) return null;
  const entry = collections[section as keyof typeof collections]?.[elementId] as ProposalComparisonEntry<unknown> | undefined;
  if (!entry || entry.state === 'unchanged') return null;
  return {
    kind: 'change',
    targetKey: input.targetKey,
    section,
    elementId,
    changeState: entry.state,
    feedback: input.feedback.trim(),
  };
}

function resolvePathNote(
  comparison: ProposalComparison,
  input: ProposalReviewNoteInput,
): ProposalPathReviewNote | null {
  const scenario = proposalCandidateScenarios(comparison)
    .find((candidate) => proposalScenarioKey(candidate) === input.targetKey);
  if (!scenario) return null;
  return {
    kind: 'path',
    targetKey: input.targetKey,
    orderedNodeIds: [...scenario.orderedPath],
    traversedEdgeIds: scenario.traversedEdges.map((edge) => edge.id),
    terminalNodeId: scenario.expectedTerminalNode,
    terminalOutcome: structuredClone(scenario.expectedTerminalOutcome),
    feedback: input.feedback.trim(),
  };
}

export function resolveProposalReviewNotes(
  review: ProposalReview,
  inputs: readonly ProposalReviewNoteInput[],
): { ok: true; notes: ProposalReviewNote[] } | { ok: false; message: string } {
  if (review.kind !== 'comparable') {
    return { ok: false, message: 'A stale proposal cannot accept targeted review notes.' };
  }
  const notes = new Map<string, ProposalReviewNote>();
  for (const input of inputs) {
    const feedback = input.feedback.trim();
    if (feedback.length < 3) {
      return { ok: false, message: 'Each review note needs at least 3 non-space characters.' };
    }
    const normalizedInput = { ...input, feedback };
    const note = input.kind === 'change'
      ? resolveChangeNote(review, normalizedInput)
      : resolvePathNote(review, normalizedInput);
    if (!note) {
      return { ok: false, message: 'A review note no longer matches this proposal. Review the candidate again.' };
    }
    notes.set(`${note.kind}:${note.targetKey}`, note);
  }
  return { ok: true, notes: [...notes.values()] };
}
