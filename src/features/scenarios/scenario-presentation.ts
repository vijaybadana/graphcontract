import type { BranchScenario } from '@/src/domain';

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
