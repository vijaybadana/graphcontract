import { describe, expect, it } from 'vitest';

import {
  enumerateScenarios,
  sampleGraph,
  validateGraph,
} from '@/src/domain';
import {
  buildGraphContractDownload,
  buildGraphScenarioDownload,
  buildGraphScenariosDownload,
  buildPythonScenarioDownload,
  buildPythonTestsDownload,
} from './downloads';

describe('v6 downloads', () => {
  it('retains bidirectional external relationships and provenance annotations without adding external systems to native paths', () => {
    const graph = structuredClone(sampleGraph);
    const evidence = {
      source: 'runtime/orchestration-observation.json',
      evidenceClass: 'verified-external-orchestration',
      confidence: 'high' as const,
    };
    graph.capabilities.provenance = {
      evidenceOverlayAvailable: true,
      externalOrchestrationAvailable: true,
    };
    graph.relationships = [
      {
        id: 'classifier-to-review',
        kind: 'external-orchestration',
        source: { kind: 'node', nodeId: 'classifier' },
        target: { kind: 'external', externalId: 'review-system', label: 'Review system' },
        provenance: { representation: 'external-orchestration', evidence },
      },
      {
        id: 'review-to-classifier',
        kind: 'external-orchestration',
        source: { kind: 'external', externalId: 'review-system', label: 'Review system' },
        target: { kind: 'node', nodeId: 'classifier' },
        provenance: { representation: 'external-orchestration', evidence },
      },
    ];

    expect(validateGraph(graph)).toEqual([]);
    const scenarios = enumerateScenarios(graph);
    const contract = JSON.parse(buildGraphContractDownload(graph).content);
    const scenarioDownload = JSON.parse(buildGraphScenariosDownload(graph, scenarios).content);

    expect(contract).toMatchObject({
      schemaVersion: '6',
      capabilities: { provenance: graph.capabilities.provenance },
      relationships: graph.relationships,
    });
    expect(scenarioDownload.graphRelationships).toEqual(graph.relationships);
    expect(scenarioDownload.scenarios).toEqual(scenarios);
    expect(scenarios.every((scenario) => !scenario.orderedPath.includes('review-system'))).toBe(true);
    expect(scenarios.every((scenario) =>
      scenario.relationshipAnnotations.some((annotation) =>
        annotation.family === 'external-orchestration' && annotation.relationshipId === 'classifier-to-review',
      ),
    )).toBe(true);
    expect(buildPythonTestsDownload(graph, scenarios).content).toContain('relationship_annotations');

    const oneCaseJson = buildGraphScenarioDownload(graph, scenarios[0]);
    const oneCasePython = buildPythonScenarioDownload(graph, scenarios[0]);
    expect(oneCaseJson.filename).toBe(`graph-test-${scenarios[0].id}.json`);
    const oneCasePayload = JSON.parse(oneCaseJson.content);
    expect(oneCasePayload).toMatchObject({
      graphId: graph.id,
      graphRelationships: graph.relationships,
    });
    expect(oneCasePayload.scenarios).toHaveLength(1);
    expect(oneCasePayload.scenarios[0]).toMatchObject({
      id: scenarios[0].id,
      orderedPath: scenarios[0].orderedPath,
      relationshipAnnotations: scenarios[0].relationshipAnnotations,
      expectedTerminalOutcome: scenarios[0].expectedTerminalOutcome,
    });
    expect(oneCasePython.filename).toBe(`test_graph_path_${scenarios[0].id.replaceAll('-', '_')}.py`);
    expect(oneCasePython.content).toContain(`"id": "${scenarios[0].id}"`);
    expect(oneCasePython.content).toContain('relationship_annotations');
    expect(oneCasePython.content).not.toContain(`"id": "${scenarios[1]?.id ?? 'missing'}"`);
  });
});
