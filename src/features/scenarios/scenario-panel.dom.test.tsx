// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enumerateScenarios, sampleGraph } from '@/src/domain';
import { ScenarioPanel } from './scenario-panel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ScenarioPanel', () => {
  it('selects a semantic row and exposes one-case downloads without replacing all-case artifacts', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockImplementation((() => 'blob:scenario-download') as typeof URL.createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL');
    const graph = { ...sampleGraph, status: 'frozen' as const };
    const scenario = enumerateScenarios(graph)[0];
    const onScenarioSelect = vi.fn();

    render(
      <ScenarioPanel
        graph={graph}
        scenarios={[scenario]}
        onScenarioSelect={onScenarioSelect}
      />,
    );

    const row = screen.getByRole('button', { name: new RegExp(scenario.name) });
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Conditions')).toBeTruthy();
    expect(screen.getByText('Ordered path')).toBeTruthy();
    expect(screen.getByText('Expected outcome')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Download / })).toHaveLength(3);

    fireEvent.click(row);

    expect(onScenarioSelect).toHaveBeenCalledWith(scenario.id);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(
      scenario.orderedPath
        .map((nodeId) => graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId)
        .join(' → '),
    )).toBeTruthy();
    expect(screen.getByText(scenario.expectedTerminalOutcome.kind.replaceAll('-', ' '))).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Download / }).map(
      (link) => (link as HTMLAnchorElement).download,
    )).toEqual([
      `graph-test-${scenario.id}.json`,
      `test_graph_path_${scenario.id.replaceAll('-', '_')}.py`,
      'graph-contract.json',
      'graph-test-scenarios.json',
      'test_graph_paths.py',
    ]);

    fireEvent.click(row);
    expect(onScenarioSelect).toHaveBeenLastCalledWith(null);
    expect(screen.getAllByRole('link', { name: /Download / })).toHaveLength(3);
  });
});
