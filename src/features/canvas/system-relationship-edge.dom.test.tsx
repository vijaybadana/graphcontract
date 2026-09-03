// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SystemRelationshipEdge } from './system-relationship-edge';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    // The portal is owned by React Flow; render its supplied label directly
    // so this focused DOM test can exercise the edge's accessible control.
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
    BaseEdge: () => null,
  };
});

afterEach(() => cleanup());

describe('SystemRelationshipEdge', () => {
  it('announces proposal treatment and opens only projection relationship details', () => {
    const onRelationshipActivate = vi.fn();
    render(
      <SystemRelationshipEdge
        {...({
          id: 'system-relationship:runner',
          sourceX: 80,
          sourceY: 120,
          targetX: 460,
          targetY: 120,
          data: {
            projection: 'system-relationship',
            proposalState: 'updated',
            scenarioState: 'active',
            relationship: {
              id: 'runner',
              kind: 'external-orchestration',
              source: { kind: 'node', nodeId: 'classifier' },
              target: { kind: 'external', externalId: 'runner', label: 'Runner' },
              label: 'Notify runner',
              provenance: { representation: 'external-orchestration' },
            },
            onRelationshipActivate,
          },
        } as never)}
      />,
    );

    const relationship = screen.getByRole('button', {
      name: /External orchestration: Notify runner\. Proposed updated\. Not a native control edge/i,
    });
    expect(relationship.getAttribute('data-proposal-state')).toBe('updated');
    expect(relationship.closest('.system-relationship-edge__label')?.classList.contains('scenario-state--active')).toBe(true);
    expect(screen.getByText('Proposed updated')).toBeTruthy();
    fireEvent.click(relationship);
    expect(onRelationshipActivate).toHaveBeenCalledWith('runner');
  });
});
