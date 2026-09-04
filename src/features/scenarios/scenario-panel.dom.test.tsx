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

    const row = screen.getByRole('button', { name: /Path 1/ });
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(row.querySelector('.mode-path-strip')).toBeTruthy();
    expect(row.textContent).toContain(graph.nodes.find((node) => node.id === scenario.expectedTerminalNode)?.label ?? scenario.expectedTerminalNode);
    expect(screen.getAllByRole('link', { name: /Download / })).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Download graph-contract.json' }).textContent).toContain('JSON');
    expect(screen.getByRole('link', { name: 'Download graph-test-scenarios.json' }).textContent).toContain('Tests');
    expect(screen.getByRole('link', { name: 'Download test_graph_paths.py' }).textContent).toContain('Python');

    fireEvent.click(row);

    expect(onScenarioSelect).toHaveBeenCalledWith(scenario.id);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(row.getAttribute('aria-controls')!)).toBeTruthy();
    expect(screen.getAllByLabelText(
      scenario.orderedPath
        .map((nodeId) => graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId)
        .join(' to '),
    )).toHaveLength(1);
    expect(screen.getByText('Decisions')).toBeTruthy();
    expect(screen.getByText('Ends at')).toBeTruthy();
    expect(document.getElementById(row.getAttribute('aria-controls')!)?.textContent).toContain(
      graph.nodes.find((node) => node.id === scenario.expectedTerminalNode)?.label ?? scenario.expectedTerminalNode,
    );
    expect(screen.getAllByRole('link', { name: /Download / }).map(
      (link) => (link as HTMLAnchorElement).download,
    )).toEqual([
      'graph-contract.json',
      'graph-test-scenarios.json',
      'test_graph_paths.py',
    ]);

    fireEvent.click(row);
    expect(onScenarioSelect).toHaveBeenLastCalledWith(null);
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(row.getAttribute('aria-controls')!)).toBeNull();
    expect(screen.getAllByRole('link', { name: /Download / })).toHaveLength(3);
  });

  it('labels decisions by their source and requests a reduced-motion final-state replay', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockImplementation((() => 'blob:scenario-download') as typeof URL.createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL');
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const graph = { ...sampleGraph, status: 'frozen' as const };
    const baseScenario = enumerateScenarios(graph)[0];
    const scenario = {
      ...baseScenario,
      triggeringConditions: [{
        nodeId: baseScenario.orderedPath[0],
        nodeLabel: 'Recommend next action',
        edgeId: baseScenario.traversedEdges[0].id,
        mode: baseScenario.traversedEdges[0].mode,
        label: 'Disqualify',
      }],
    };
    const onScenarioReplay = vi.fn();

    render(<ScenarioPanel graph={graph} scenarios={[scenario]} onScenarioReplay={onScenarioReplay} />);

    fireEvent.click(screen.getByRole('button', { name: /Path 1/ }));

    expect(screen.getByText('Recommend next action').parentElement?.textContent).toContain('Recommend next action — Disqualify');
    expect(onScenarioReplay).toHaveBeenLastCalledWith(expect.objectContaining({
      scenarioId: scenario.id,
      replayId: 1,
      reducedMotion: true,
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Replay path 1' }));
    expect(onScenarioReplay).toHaveBeenLastCalledWith(expect.objectContaining({ replayId: 2, reducedMotion: true }));
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

    expect(screen.getByRole('heading', { name: 'Scenarios' })).toBeTruthy();
    expect(screen.getByText('143 total')).toBeTruthy();
    expect(screen.getByText('Showing 1–24 · Page 1 of 6').classList.contains('mode-panel__visually-hidden')).toBe(false);
    expect(screen.getByLabelText('Page 1 of 6').textContent).toBe('1 / 6');
    expect(document.querySelectorAll('.scenario-row')).toHaveLength(24);
    expect(document.querySelector('[data-scenario-id="scenario-24"]')).toBeTruthy();
    expect(document.querySelector('[data-scenario-id="scenario-25"]')).toBeNull();
    expect(createObjectUrl).toHaveBeenCalledTimes(3);

    fireEvent.click(document.querySelector('[data-scenario-id="scenario-1"]')!);
    expect(document.querySelector('[data-scenario-id="scenario-1"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[data-scenario-id="scenario-1"]')?.closest('.scenario-row')?.querySelector('.scenario-row__expanded')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Download / })).toHaveLength(3);
    expect(createObjectUrl).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: 'Next scenario page' }));

    const pageStatus = screen.getByText('Showing 25–48 · Page 2 of 6');
    expect(document.activeElement).toBe(pageStatus);
    expect(document.querySelectorAll('.scenario-row')).toHaveLength(24);
    expect(document.querySelector('[data-scenario-id="scenario-25"]')).toBeTruthy();
    expect(document.querySelector('[data-scenario-id="scenario-1"]')).toBeNull();
    expect(screen.getAllByRole('link', { name: /Download / })).toHaveLength(3);
    expect(createObjectUrl).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: 'Previous scenario page' }));
    expect(document.activeElement).toBe(screen.getByText('Showing 1–24 · Page 1 of 6'));
    expect(document.querySelector('[data-scenario-id="scenario-1"]')?.getAttribute('aria-pressed')).toBe('true');
  }, 10_000);

  it('expands a long scenario in place without shrinking or duplicating the route strip', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockImplementation((() => 'blob:scenario-download') as typeof URL.createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL');
    const extraNodes = Array.from({ length: 5 }, (_, index) => ({
      ...sampleGraph.nodes.find((node) => node.kind === 'step')!,
      id: `long-step-${index + 1}`,
      label: `Long step ${index + 1}`,
      position: { x: 600 + index * 120, y: 200 },
    }));
    const baseScenario = enumerateScenarios({ ...sampleGraph, status: 'frozen' as const })[0];
    const graph = { ...sampleGraph, status: 'frozen' as const, nodes: [...sampleGraph.nodes, ...extraNodes] };
    const scenario = {
      ...baseScenario,
      id: 'scenario-8',
      name: 'Path 8: intentionally long route',
      orderedPath: [
        ...baseScenario.orderedPath.slice(0, -1),
        ...extraNodes.map((node) => node.id),
        baseScenario.orderedPath.at(-1)!,
      ],
    };

    render(<ScenarioPanel graph={graph} scenarios={[scenario]} />);

    const row = document.querySelector('[data-scenario-id="scenario-8"]')!;
    const hiddenStepCount = scenario.orderedPath.length - 2;
    expect(row.querySelector('.mode-path-strip__overflow')?.textContent).toBe(`+${hiddenStepCount} more`);
    expect(row.querySelector('.mode-path-strip__overflow')?.getAttribute('aria-label')).toBe(
      `${hiddenStepCount} intermediate path steps hidden`,
    );
    expect(row.querySelectorAll('.mode-path-strip__node')).toHaveLength(2);

    fireEvent.click(row);

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.querySelector('.mode-path-strip__overflow')).toBeNull();
    expect(row.querySelectorAll('.mode-path-strip__node')).toHaveLength(scenario.orderedPath.length);
    expect(row.closest('.scenario-row')?.querySelector('.scenario-row__path.is-expanded')).toBeTruthy();
    expect(document.querySelectorAll('.scenario-row__expanded')).toHaveLength(1);
  });
});
