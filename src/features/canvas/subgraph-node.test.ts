// @vitest-environment jsdom

import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubgraphNode } from './subgraph-node';

afterEach(() => cleanup());

function renderSubgraph(data: Parameters<typeof SubgraphNode>[0]['data']) {
  render(createElement(
    ReactFlowProvider,
    null,
    createElement(SubgraphNode, { data, id: data.id, selected: false } as never),
  ));
}

describe('SubgraphNode', () => {
  it('renders a native accessible collapse control and invokes the projection callback', () => {
    const onToggleCollapse = vi.fn();
    renderSubgraph({
        id: 'review-group',
        label: 'Review process',
        position: { x: 0, y: 0 },
        dimensions: { width: 640, height: 360 },
        collapsed: false,
        collapseEditable: true,
        onToggleCollapse,
    });
    const button = screen.getByRole('button', { name: 'Collapse subgraph Review process' });

    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.className).toContain('nodrag');
    expect((button as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(button);

    expect(onToggleCollapse).toHaveBeenCalledWith('review-group', true);
  });

  it('exposes expansion state and label for a collapsed card', () => {
    renderSubgraph({
        id: 'review-group',
        label: 'Review process',
        position: { x: 0, y: 0 },
        dimensions: { width: 640, height: 360 },
        collapsed: true,
    });
    const button = screen.getByRole('button', { name: 'Expand subgraph Review process' });

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders a removed proposal container as a non-interactive visual ghost', () => {
    renderSubgraph({
        id: 'review-group',
        label: 'Review process',
        position: { x: 0, y: 0 },
        dimensions: { width: 640, height: 360 },
        collapsed: false,
        proposalState: 'removed',
        collapseEditable: true,
    });
    const shell = document.querySelector('.subgraph-node-shell');
    const button = screen.getByRole('button', { name: 'Collapse subgraph Review process' });

    expect(shell?.className).toContain('is-proposed-removed');
    expect(shell?.getAttribute('data-proposal-state')).toBe('removed');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
