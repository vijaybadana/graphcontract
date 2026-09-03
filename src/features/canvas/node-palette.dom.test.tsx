// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sampleGraph } from '@/src/domain';
import { NodePalette } from './node-palette';

afterEach(() => cleanup());

describe('NodePalette inventory', () => {
  it('shows the requested accessible groups and forwards canonical creation presets', () => {
    const onAdd = vi.fn();
    render(
      <NodePalette
        graph={sampleGraph}
        proposal={null}
        disabled={false}
        onAdd={onAdd}
        onCollapse={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual([
      'Flow components',
      'Execution components',
      'Structure components',
      'Connections reference',
    ]);
    expect(screen.getAllByRole('button')).toHaveLength(9);
    for (const label of ['Start', 'Task', 'Agent', 'Tool', 'Human', 'Merge', 'End', 'Subgraph']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    const task = screen.getByRole('button', { name: 'Task' });
    const human = screen.getByRole('button', { name: 'Human' });
    expect(task.querySelector('[data-node-visual="task"]')).not.toBeNull();
    expect(human.querySelector('[data-node-visual="human"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Action' })).toBeNull();
    expect(screen.getByText('8 components and 6 references shown')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search components' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse node palette' })).toBeTruthy();
    expect(screen.queryByText('Node inventory')).toBeNull();

    fireEvent.click(task);
    fireEvent.click(human);
    expect(onAdd).toHaveBeenCalledWith('step');
    expect(onAdd).toHaveBeenCalledWith('humanReview');
  }, 15_000);

  it('filters non-draggable connection references independently and exposes their explanations on focus', () => {
    render(
      <NodePalette
        graph={sampleGraph}
        proposal={null}
        disabled={false}
        onAdd={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search components' }), { target: { value: 'send' } });

    expect(screen.queryByRole('button', { name: 'Send ×N' })).toBeNull();
    const send = screen.getByText('Send ×N');
    const sendReference = send.closest('li')!;
    expect(sendReference.getAttribute('tabindex')).toBe('0');
    expect(sendReference.getAttribute('title')).toBeNull();
    fireEvent.focus(sendReference);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toBe('Dynamically fans work out to one template and rejoins at Merge.');
    expect(sendReference.contains(tooltip)).toBe(false);
    expect(screen.getByText('0 components and 1 reference shown')).toBeTruthy();
  });

  it('keeps every connection semantic focusable but outside the button and drag contracts', () => {
    render(
      <NodePalette
        graph={sampleGraph}
        proposal={null}
        disabled={false}
        onAdd={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );

    const references = screen.getByRole('region', { name: 'Connections reference' }).querySelectorAll('li');
    expect(Array.from(references).map((reference) => reference.getAttribute('aria-label'))).toEqual([
      'Edge', 'Conditional', 'Command', 'Fallback', 'Send ×N', 'Loop ↺',
    ]);
    for (const reference of references) {
      expect(reference.getAttribute('tabindex')).toBe('0');
      expect(reference.getAttribute('draggable')).toBeNull();
      expect(reference.closest('button')).toBeNull();
      expect(reference.classList.contains('node-palette__item-row')).toBe(true);
      expect(reference.querySelector('.node-palette__item-icon')).not.toBeNull();
      expect(reference.querySelector('.node-palette__item-label')).not.toBeNull();
    }
    const loopReference = screen.getByText('Loop ↺').closest('li')!;
    const edgeReference = screen.getByText('Edge').closest('li')!;
    const conditionalReference = screen.getByText('Conditional').closest('li')!;
    const sendReference = screen.getByText('Send ×N').closest('li')!;
    expect(edgeReference.querySelector('.node-palette__connection-cue--edge')).not.toBeNull();
    expect(conditionalReference.querySelector('.node-palette__connection-cue--conditional')).not.toBeNull();
    expect(sendReference.querySelector('svg')).not.toBeNull();
    expect(loopReference.querySelector('.node-palette__connection-cue--loop')).not.toBeNull();
    expect(screen.queryByText('Reference')).toBeNull();
    expect(screen.queryByText('Derived')).toBeNull();
  });

  it('retains a compact lock explanation without restoring inventory chrome', () => {
    render(
      <NodePalette
        graph={{ ...sampleGraph, status: 'frozen' }}
        proposal={null}
        disabled
        onAdd={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('contract is frozen');
    expect(screen.queryByText('Node inventory')).toBeNull();
  });

  it('keeps graph health, demos, and keyboard hints out of the component inventory', () => {
    render(
      <NodePalette
        graph={sampleGraph}
        proposal={null}
        disabled={false}
        onAdd={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );

    expect(screen.queryByText('Contract health')).toBeNull();
    expect(screen.queryByText(/Load Parallel research/)).toBeNull();
    expect(screen.queryByText(/Load Human Control/)).toBeNull();
    expect(screen.queryByText(/Keys:/)).toBeNull();
  });
});
