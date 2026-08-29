import { describe, expect, it } from 'vitest';

import {
  researchIntakeRoutingGraph,
  validateGraph,
  workflowGraphSchema,
} from './graph';

describe('routing edge semantics', () => {
  it('keeps the Research Intake topology valid with commands and a derived return loop', () => {
    expect(validateGraph(researchIntakeRoutingGraph)).toEqual([]);

    expect(researchIntakeRoutingGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mode: 'command', label: 'ready' }),
        expect.objectContaining({ mode: 'command', label: 'needs clarification' }),
        expect.objectContaining({ mode: 'conditional', label: 'enough evidence' }),
        expect.objectContaining({ mode: 'fallback', label: 'fallback' }),
        expect.objectContaining({
          id: 'researcher-continue',
          source: 'researcher',
          target: 'research-supervisor',
          mode: 'normal',
        }),
      ]),
    );

    const persistedLoopMode = structuredClone(researchIntakeRoutingGraph) as {
      edges: Array<Record<string, unknown>>;
    };
    persistedLoopMode.edges.find((edge) => edge.id === 'researcher-continue')!.mode = 'loop';
    expect(workflowGraphSchema.safeParse(persistedLoopMode).success).toBe(false);
  });

  it('rejects unreadable conditional and command routes while preserving one fallback', () => {
    const invalid = structuredClone(researchIntakeRoutingGraph);
    invalid.edges.find((edge) => edge.id === 'supervisor-final-report')!.label = '   ';
    invalid.edges.find((edge) => edge.id === 'clarify-write-brief')!.label = '   ';
    invalid.edges.find((edge) => edge.id === 'clarify-await-reply')!.condition = '   ';
    invalid.edges.push({
      id: 'supervisor-extra-fallback',
      source: 'research-supervisor',
      target: 'awaiting-user-reply',
      mode: 'fallback',
      label: 'fallback',
    });

    expect(validateGraph(invalid).map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        'CONDITIONAL_LABEL_REQUIRED',
        'COMMAND_LABEL_REQUIRED',
        'COMMAND_CONDITION_REQUIRED',
        'MULTIPLE_FALLBACKS',
      ]),
    );
  });
});
