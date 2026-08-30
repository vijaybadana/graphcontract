import { describe, expect, it } from 'vitest';

import type { BranchScenario } from '@/src/domain';
import {
  scenarioElementState,
  scenarioPresentationClassName,
  scenarioPresentationFor,
} from './scenario-presentation';

const scenario: BranchScenario = {
  id: 'scenario-approval',
  name: 'Approval path',
  triggeringConditions: [],
  humanOutcomes: [],
  traversedEdges: [{ id: 'start-review', source: 'start', target: 'review', mode: 'normal' }],
  dynamicSends: [],
  merges: [],
  relationshipAnnotations: [
    { family: 'native-control', edgeId: 'start-review', source: 'start', target: 'review', mode: 'normal', provenance: { representation: 'declared' } },
    {
      family: 'external-orchestration',
      relationshipId: 'review-notify',
      kind: 'external-orchestration',
      source: { kind: 'node', nodeId: 'review' },
      target: { kind: 'external', externalId: 'notifier', label: 'Notifier' },
      provenance: { representation: 'external-orchestration' },
    },
  ],
  orderedPath: ['start', 'review', 'end'],
  expectedNodes: ['start', 'review', 'end'],
  expectedTerminalNode: 'end',
  expectedTerminalOutcome: { kind: 'completed' },
};

describe('scenarioPresentationFor', () => {
  it('derives path and relationship annotations without changing the scenario', () => {
    const presentation = scenarioPresentationFor(scenario)!;

    expect(presentation.scenarioId).toBe('scenario-approval');
    expect([...presentation.activeNodeIds]).toEqual(['start', 'review', 'end']);
    expect([...presentation.activeEdgeIds]).toEqual(['start-review']);
    expect([...presentation.activeRelationshipIds]).toEqual(['review-notify']);
    expect([...presentation.activeExternalSystemIds]).toEqual(['notifier']);
    expect(scenarioElementState(presentation, true)).toBe('active');
    expect(scenarioElementState(presentation, false)).toBe('dimmed');
    expect(scenarioElementState(null, false)).toBeUndefined();
    expect(scenarioPresentationClassName('active')).toBe('scenario-state--active');
    expect(scenarioPresentationClassName(undefined)).toBeUndefined();
  });
});
