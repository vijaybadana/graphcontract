import { describe, expect, it } from 'vitest';

import type { BranchScenario } from '@/src/domain';
import {
  scenarioDecisionsFor,
  scenarioElementState,
  scenarioPlaybackRequestFor,
  scenarioPresentationClassName,
  scenarioPresentationFor,
  scenarioTerminalLabelFor,
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

describe('scenario semantic and playback presentation', () => {
  it('keeps decisions attributable and replay data bounded to an ephemeral ordered path', () => {
    const semanticScenario: BranchScenario = {
      ...scenario,
      triggeringConditions: [{
        nodeId: 'review',
        nodeLabel: 'Recommend next action',
        edgeId: 'start-review',
        mode: 'condition',
        label: 'Pursue',
      }],
      humanOutcomes: [{
        nodeId: 'review',
        nodeLabel: 'Paid enrichment approval',
        timing: 'before',
        responseType: 'approval',
        outcomeId: 'denied',
        outcomeLabel: 'Denied',
        resumeNodeId: 'end',
      }],
      traversedEdges: [
        { id: 'start-review', source: 'start', target: 'review', mode: 'condition', label: 'Pursue' },
        { id: 'review-end', source: 'review', target: 'end', mode: 'normal' },
      ],
    };
    const graph = {
      nodes: [{ id: 'end', label: 'Qualified account prepared' }],
    } as unknown as import('@/src/domain').WorkflowGraph;

    expect(scenarioDecisionsFor(semanticScenario)).toEqual([
      { id: 'route:start-review', sourceLabel: 'Recommend next action', valueLabel: 'Pursue', kind: 'route' },
      { id: 'human:review:denied:0', sourceLabel: 'Paid enrichment approval', valueLabel: 'Denied', kind: 'human-gate' },
    ]);
    expect(scenarioTerminalLabelFor(graph, semanticScenario)).toBe('Qualified account prepared');
    expect(scenarioPlaybackRequestFor(semanticScenario, 3, true)).toEqual({
      scenarioId: 'scenario-approval',
      replayId: 3,
      steps: [
        { nodeId: 'start' },
        { nodeId: 'review', edgeId: 'start-review' },
        { nodeId: 'end', edgeId: 'review-end' },
      ],
      hopDurationMs: 320,
      reducedMotion: true,
    });
    expect(semanticScenario.orderedPath).toEqual(['start', 'review', 'end']);
  });
});
