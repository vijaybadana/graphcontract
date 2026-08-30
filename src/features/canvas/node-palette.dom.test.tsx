// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sampleGraph } from '@/src/domain';
import { NodePalette } from './node-palette';

afterEach(() => cleanup());

describe('NodePalette Step presets', () => {
  it('offers the canonical work presets and forwards the typed creation preset', () => {
    const onAdd = vi.fn();
    render(
      <NodePalette
        graph={sampleGraph}
        proposal={null}
        disabled={false}
        validationIssueCount={0}
        onAdd={onAdd}
        onLoadResearchSupervisorDemo={vi.fn()}
        onLoadResearchIntakeRoutingDemo={vi.fn()}
        onLoadHumanControlHitlDemo={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Step' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agent' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Action' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tool' })).toBeTruthy();
    const humanReview = screen.getByRole('button', { name: 'Human review' });

    fireEvent.click(humanReview);
    expect(onAdd).toHaveBeenCalledWith('humanReview');
  }, 15_000);
});
