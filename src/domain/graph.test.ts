import { describe, expect, it } from 'vitest';

import {
  enumerateScenarios,
  researchIntakeRoutingGraph,
  validateGraph,
  workflowGraphSchema,
} from './graph';
import {
  buildGraphContractDownload,
  buildGraphScenariosDownload,
} from '../adapters/exports/downloads';

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

  it('rejects self and duplicate connections and gives routing issues stable edge or source paths', () => {
    const invalid = structuredClone(researchIntakeRoutingGraph);
    invalid.edges.find((edge) => edge.id === 'supervisor-final-report')!.label = '  ';
    invalid.edges.find((edge) => edge.id === 'supervisor-researcher')!.label = '  ';
    invalid.edges.find((edge) => edge.id === 'clarify-write-brief')!.label = '  ';
    invalid.edges.find((edge) => edge.id === 'brief-supervisor')!.mode = 'conditional';
    invalid.edges.find((edge) => edge.id === 'researcher-continue')!.mode = 'fallback';
    invalid.edges.push(
      {
        id: 'final-report-extra-normal',
        source: 'final-report',
        target: 'awaiting-user-reply',
        mode: 'normal',
      },
      {
        id: 'researcher-extra-fallback',
        source: 'researcher',
        target: 'final-report',
        mode: 'fallback',
      },
      {
        id: 'clarify-self',
        source: 'clarify-request',
        target: 'clarify-request',
        mode: 'command',
        label: 'retry',
      },
      {
        id: 'research-intake-start-clarify-duplicate',
        source: 'research-intake-start',
        target: 'clarify-request',
        mode: 'normal',
      },
      {
        id: 'clarify-start',
        source: 'clarify-request',
        target: 'research-intake-start',
        mode: 'command',
        label: 'restart',
      },
    );

    const issues = validateGraph(invalid);
    const pathsFor = (code: string) => issues.filter((entry) => entry.code === code).map((entry) => entry.path);

    expect(pathsFor('SELF_CONNECTION')).toEqual(['edges.clarify-self']);
    expect(pathsFor('DUPLICATE_CONNECTION')).toEqual([
      'edges.research-intake-start-clarify',
      'edges.research-intake-start-clarify-duplicate',
    ]);
    expect(pathsFor('START_HAS_INCOMING')).toEqual(['edges.clarify-start']);
    expect(pathsFor('MULTIPLE_NORMAL_EDGES')).toEqual(['nodes.research-intake-start', 'nodes.final-report']);
    expect(pathsFor('CONDITIONAL_EDGE_COUNT')).toEqual(['nodes.write-research-brief']);
    expect(pathsFor('MULTIPLE_FALLBACKS')).toEqual(['nodes.researcher']);
    expect(pathsFor('FALLBACK_WITHOUT_CONDITIONS')).toEqual(['nodes.researcher']);
    expect(pathsFor('CONDITIONAL_LABEL_REQUIRED')).toEqual([
      'nodes.write-research-brief',
      'nodes.research-supervisor',
    ]);
    expect(pathsFor('DUPLICATE_CONDITIONAL_LABEL')).toEqual(['nodes.research-supervisor']);
    expect(pathsFor('COMMAND_LABEL_REQUIRED')).toEqual(['nodes.clarify-request']);
  });

  it('enumerates a derived loop once per path and preserves routing data in exports', () => {
    const scenarios = enumerateScenarios(researchIntakeRoutingGraph);

    expect(scenarios).toEqual(enumerateScenarios(researchIntakeRoutingGraph));
    expect(scenarios).toHaveLength(5);

    const loopScenario = scenarios.find((scenario) =>
      scenario.traversedEdges.some((edge) => edge.id === 'researcher-continue'),
    );
    expect(loopScenario).toMatchObject({
      orderedPath: [
        'research-intake-start',
        'clarify-request',
        'write-research-brief',
        'research-supervisor',
        'researcher',
        'research-supervisor',
        'final-report',
        'report-complete',
      ],
      expectedTerminalNode: 'report-complete',
      traversedEdges: expect.arrayContaining([
        expect.objectContaining({
          id: 'researcher-continue',
          mode: 'normal',
          label: 'continue',
          isLoop: true,
        }),
        expect.objectContaining({
          id: 'supervisor-final-report',
          mode: 'conditional',
          label: 'enough evidence',
          condition: 'evidence.isSufficient === true',
        }),
      ]),
    });
    expect(loopScenario?.traversedEdges.filter((edge) => edge.isLoop)).toHaveLength(1);
    expect(loopScenario?.triggeringConditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edgeId: 'clarify-write-brief',
          mode: 'command',
          label: 'ready',
          condition: 'state.ready === true',
        }),
        expect.objectContaining({
          edgeId: 'supervisor-final-report',
          mode: 'conditional',
          label: 'enough evidence',
          condition: 'evidence.isSufficient === true',
        }),
      ]),
    );

    const fallbackScenario = scenarios.find((scenario) =>
      scenario.traversedEdges.some((edge) => edge.mode === 'fallback'),
    );
    expect(fallbackScenario?.traversedEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: 'fallback',
          label: 'fallback',
          isFallback: true,
        }),
      ]),
    );

    expect(JSON.parse(buildGraphContractDownload(researchIntakeRoutingGraph).content).edges).toEqual(
      researchIntakeRoutingGraph.edges,
    );
    expect(JSON.parse(buildGraphScenariosDownload(researchIntakeRoutingGraph, scenarios).content).scenarios).toEqual(
      scenarios,
    );
  });
});
