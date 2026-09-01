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

  it('paginates large scenario sets, preserves selection downloads, and announces bounded loop behavior', () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL')
      .mockImplementation((() => 'blob:scenario-download') as typeof URL.createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL');
    const graph = { ...sampleGraph, status: 'frozen' as const };
    const baseScenario = enumerateScenarios(graph)[0];
    const scenarios = Array.from({ length: 143 }, (_, index) => ({
      ...baseScenario,
      id: `scenario-${index + 1}`,
      name: `Scenario ${index + 1}`,
    }));

    render(<ScenarioPanel graph={graph} scenarios={scenarios} />);

    expect(screen.getByText(
      'Bounded deterministic execution scenarios. Authored loop traversal caps are honored; loops without a cap default to one traversal per path.',
    )).toBeTruthy();
    expect(screen.getByText('Showing 1–24 of 143 scenarios. Page 1 of 6.')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(24);
    expect(screen.getByRole('button', { name: /^Scenario 24Conditions/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Scenario 25Conditions/ })).toBeNull();
    expect(createObjectUrl).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: /^Scenario 1Conditions/ }));
    expect(screen.getByRole('complementary', { name: 'Selected scenario: Scenario 1' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Download / })).toHaveLength(5);
    expect(createObjectUrl).toHaveBeenCalledTimes(5);

    fireEvent.click(screen.getByRole('button', { name: 'Next scenario page' }));

    const pageStatus = screen.getByText('Showing 25–48 of 143 scenarios. Page 2 of 6.');
    expect(document.activeElement).toBe(pageStatus);
    expect(screen.getAllByRole('listitem')).toHaveLength(24);
    expect(screen.getByRole('button', { name: /^Scenario 25Conditions/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Scenario 1Conditions/ })).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Selected scenario: Scenario 1' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Download / })).toHaveLength(5);
    expect(createObjectUrl).toHaveBeenCalledTimes(5);

    fireEvent.click(screen.getByRole('button', { name: 'Previous scenario page' }));
    expect(document.activeElement).toBe(screen.getByText('Showing 1–24 of 143 scenarios. Page 1 of 6.'));
    expect(screen.getByRole('button', { name: /^Scenario 1Conditions/ }).getAttribute('aria-pressed')).toBe('true');
  }, 10_000);
});
