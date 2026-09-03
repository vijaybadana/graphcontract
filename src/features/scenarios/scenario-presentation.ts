import type { BranchScenario, WorkflowGraph } from '@/src/domain';

const SCENARIO_PLAYBACK_HOP_DURATION_MS = 320;

export type ScenarioDecision = {
  id: string;
  sourceLabel: string;
  valueLabel: string;
  kind: 'route' | 'human-gate';
};

/** A presentation-only request; it never writes graph, scenario, or history state. */
export type ScenarioPlaybackRequest = {
  scenarioId: string;
  replayId: number;
  steps: readonly { nodeId: string; edgeId?: string }[];
  hopDurationMs: number;
  reducedMotion: boolean;
};

/**
 * Ephemeral, derived scenario state for the canvas. It deliberately holds no
 * graph mutation data: a selected path can only change presentation.
 */
export type ScenarioPresentation = {
  scenarioId: string;
  activeNodeIds: ReadonlySet<string>;
  activeEdgeIds: ReadonlySet<string>;
  activeRelationshipIds: ReadonlySet<string>;
  activeExternalSystemIds: ReadonlySet<string>;
};

export type ScenarioElementState = 'active' | 'dimmed';

export function scenarioDecisionsFor(scenario: BranchScenario): ScenarioDecision[] {
  const decisions: ScenarioDecision[] = [];
  const consumedHumanOutcomeIndexes = new Set<number>();

  for (const edge of scenario.traversedEdges) {
    const route = scenario.triggeringConditions.find((condition) => condition.edgeId === edge.id);
    if (route) {
      decisions.push({
        id: `route:${route.edgeId}`,
        sourceLabel: route.nodeLabel,
        valueLabel: route.label || route.condition || (route.isFallback ? 'Fallback' : 'Condition'),
        kind: 'route',
      });
      continue;
    }

    const humanOutcomeIndex = scenario.humanOutcomes.findIndex(
      (outcome, index) =>
        !consumedHumanOutcomeIndexes.has(index) &&
        outcome.nodeId === edge.source &&
        outcome.resumeNodeId === edge.target,
    );
    if (humanOutcomeIndex < 0) continue;

    const humanOutcome = scenario.humanOutcomes[humanOutcomeIndex];
    consumedHumanOutcomeIndexes.add(humanOutcomeIndex);
    decisions.push({
      id: `human:${humanOutcome.nodeId}:${humanOutcome.outcomeId}:${humanOutcomeIndex}`,
      sourceLabel: humanOutcome.nodeLabel,
      valueLabel: humanOutcome.outcomeLabel,
      kind: 'human-gate',
    });
  }

  scenario.humanOutcomes.forEach((outcome, index) => {
    if (consumedHumanOutcomeIndexes.has(index)) return;
    decisions.push({
      id: `human:${outcome.nodeId}:${outcome.outcomeId}:${index}`,
      sourceLabel: outcome.nodeLabel,
      valueLabel: outcome.outcomeLabel,
      kind: 'human-gate',
    });
  });

  return decisions;
}

export function scenarioTerminalLabelFor(
  graph: WorkflowGraph,
  scenario: BranchScenario,
): string {
  return graph.nodes.find((node) => node.id === scenario.expectedTerminalNode)?.label
    ?? scenario.expectedTerminalNode;
}

export function scenarioPlaybackRequestFor(
  scenario: BranchScenario,
  replayId: number,
  reducedMotion: boolean,
): ScenarioPlaybackRequest {
  let edgeCursor = 0;
  const steps = scenario.orderedPath.map((nodeId, index) => {
    if (index === 0) return { nodeId };
    const previousNodeId = scenario.orderedPath[index - 1];
    const matchingEdgeIndex = scenario.traversedEdges.findIndex(
      (edge, candidateIndex) =>
        candidateIndex >= edgeCursor &&
        edge.source === previousNodeId &&
        edge.target === nodeId,
    );
    if (matchingEdgeIndex < 0) return { nodeId };
    edgeCursor = matchingEdgeIndex + 1;
    return { nodeId, edgeId: scenario.traversedEdges[matchingEdgeIndex].id };
  });

  return {
    scenarioId: scenario.id,
    replayId,
    steps,
    hopDurationMs: SCENARIO_PLAYBACK_HOP_DURATION_MS,
    reducedMotion,
  };
}

export function scenarioPresentationClassName(
  state: ScenarioElementState | undefined,
): string | undefined {
  return state ? `scenario-state--${state}` : undefined;
}

export function scenarioPresentationFor(
  scenario: BranchScenario | null | undefined,
): ScenarioPresentation | null {
  if (!scenario) return null;

  const activeNodeIds = new Set(scenario.expectedNodes);
  const activeEdgeIds = new Set(scenario.traversedEdges.map((edge) => edge.id));
  const activeRelationshipIds = new Set<string>();
  const activeExternalSystemIds = new Set<string>();

  for (const annotation of scenario.relationshipAnnotations) {
    if (annotation.family === 'native-control') {
      activeEdgeIds.add(annotation.edgeId);
      activeNodeIds.add(annotation.source);
      activeNodeIds.add(annotation.target);
      continue;
    }
    activeRelationshipIds.add(annotation.relationshipId);
    if (annotation.source.kind === 'node') activeNodeIds.add(annotation.source.nodeId);
    else activeExternalSystemIds.add(annotation.source.externalId);
    if (annotation.target.kind === 'node') activeNodeIds.add(annotation.target.nodeId);
    else activeExternalSystemIds.add(annotation.target.externalId);
  }

  return {
    scenarioId: scenario.id,
    activeNodeIds,
    activeEdgeIds,
    activeRelationshipIds,
    activeExternalSystemIds,
  };
}

export function scenarioElementState(
  presentation: ScenarioPresentation | null | undefined,
  active: boolean,
): ScenarioElementState | undefined {
  if (!presentation) return undefined;
  return active ? 'active' : 'dimmed';
}
