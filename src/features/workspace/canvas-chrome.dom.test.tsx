// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { enumerateScenariosBounded, sampleGraph } from '@/src/domain';

import { CanvasStatusStrip } from './canvas-chrome';

afterEach(() => cleanup());

describe('CanvasStatusStrip', () => {
  it('previews the authoritative bounded scenario count for a valid draft', () => {
    const enumeration = enumerateScenariosBounded(sampleGraph);
    expect(enumeration.ok).toBe(true);
    const expectedScenarioCount = enumeration.ok ? enumeration.scenarios.length : 0;
    expect(expectedScenarioCount).toBeGreaterThan(0);

    render(
      <CanvasStatusStrip
        graph={sampleGraph}
        issueCount={0}
        proposalPending={false}
        scenarioCount={0}
      />,
    );

    const status = screen.getByLabelText('Graph status');
    expect(within(status).getByText('7', { exact: true })).toBeTruthy();
    expect(status.textContent).toContain('nodes');
    expect(status.textContent).toContain('8 edges');
    expect(status.textContent).toContain(`${expectedScenarioCount} scenarios`);
    expect(status.textContent).toContain('Ready to freeze');
    expect(status.textContent).not.toMatch(/branches|paths|selected/i);
    expect(status.querySelectorAll('svg')).toHaveLength(4);
  });

  it.each([
    {
      name: 'invalid graph',
      issueCount: 2,
      proposalPending: true,
      graphStatus: 'draft' as const,
      expected: '2 issues',
    },
    {
      name: 'pending proposal',
      issueCount: 0,
      proposalPending: true,
      graphStatus: 'draft' as const,
      expected: 'Proposal pending',
    },
    {
      name: 'frozen graph',
      issueCount: 0,
      proposalPending: false,
      graphStatus: 'frozen' as const,
      expected: 'Contract frozen',
    },
  ])('shows the contextual contract status for a $name', ({
    issueCount,
    proposalPending,
    graphStatus,
    expected,
  }) => {
    render(
      <CanvasStatusStrip
        graph={{ ...sampleGraph, status: graphStatus }}
        issueCount={issueCount}
        proposalPending={proposalPending}
        scenarioCount={3}
      />,
    );

    expect(screen.getByLabelText('Graph status').textContent).toContain(expected);
  });
});
