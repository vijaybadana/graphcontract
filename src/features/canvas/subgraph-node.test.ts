import { Children, isValidElement, ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SubgraphNode } from './subgraph-node';

function findButton(node: ReactNode): ReactElement<Record<string, unknown>> | undefined {
  if (!isValidElement(node)) return undefined;
  if (node.type === 'button') return node as ReactElement<Record<string, unknown>>;
  for (const child of Children.toArray(node.props.children)) {
    const button = findButton(child);
    if (button) return button;
  }
  return undefined;
}

describe('SubgraphNode', () => {
  it('renders a native accessible collapse control and invokes the projection callback', () => {
    const onToggleCollapse = vi.fn();
    const element = SubgraphNode({
      data: {
        id: 'review-group',
        label: 'Review process',
        position: { x: 0, y: 0 },
        dimensions: { width: 640, height: 360 },
        collapsed: false,
        collapseEditable: true,
        onToggleCollapse,
      },
      selected: false,
    } as never as Parameters<typeof SubgraphNode>[0]);
    const button = findButton(element);
    const stopPropagation = vi.fn();

    expect(button).toBeDefined();
    expect(button?.props.type).toBe('button');
    expect(button?.props['aria-expanded']).toBe(true);
    expect(button?.props['aria-label']).toBe('Collapse subgraph Review process');
    expect(button?.props.className).toContain('nodrag');
    expect(button?.props.disabled).toBe(false);

    (button?.props.onClick as (event: { stopPropagation: () => void }) => void)({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onToggleCollapse).toHaveBeenCalledWith('review-group', true);
  });

  it('exposes expansion state and label for a collapsed card', () => {
    const element = SubgraphNode({
      data: {
        id: 'review-group',
        label: 'Review process',
        position: { x: 0, y: 0 },
        dimensions: { width: 640, height: 360 },
        collapsed: true,
      },
      selected: false,
    } as never as Parameters<typeof SubgraphNode>[0]);
    const button = findButton(element);

    expect(button?.props['aria-expanded']).toBe(false);
    expect(button?.props['aria-label']).toBe('Expand subgraph Review process');
    expect(button?.props.disabled).toBe(true);
  });

  it('renders a removed proposal container as a non-interactive visual ghost', () => {
    const element = SubgraphNode({
      data: {
        id: 'review-group',
        label: 'Review process',
        position: { x: 0, y: 0 },
        dimensions: { width: 640, height: 360 },
        collapsed: false,
        proposalState: 'removed',
        collapseEditable: true,
      },
      selected: false,
    } as never as Parameters<typeof SubgraphNode>[0]);
    const button = findButton(element);

    expect(element.props.className).toContain('is-proposed-removed');
    expect(element.props['data-proposal-state']).toBe('removed');
    expect(button?.props.disabled).toBe(true);
  });
});
