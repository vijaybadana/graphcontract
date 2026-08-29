// @vitest-environment jsdom

import { MarkerType, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';

import type { CanvasEdgePresentation } from '@/src/adapters/react-flow/project-graph';
import { projectGraphToCanvas } from '@/src/adapters/react-flow/project-graph';
import { researchIntakeRoutingGraph } from '@/src/domain';
import { RoutingEdge, routingEdgeTokens } from './routing-edge';

afterEach(() => cleanup());

function RoutingEdgePreview({
  id,
  label,
  presentation,
  selected = false,
}: {
  id: string;
  label?: string;
  presentation: CanvasEdgePresentation;
  selected?: boolean;
}) {
  return (
    <RoutingEdge
      id={id}
      source="source"
      target="target"
      label={label}
      selected={selected}
      sourceX={40}
      sourceY={80}
      targetX={340}
      targetY={80}
      markerEnd={{ type: MarkerType.ArrowClosed, color: '#303a35' }}
      data={{
        edge: { id, source: 'source', target: 'target', mode: presentation.mode, label },
        domainEdgeIds: [id],
        projection: 'domain',
        presentation,
      }}
    />
  );
}

function MountedRoutingPreview({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 720, height: 240 }}>
      <ReactFlowProvider>
        <ReactFlow nodes={[]} edges={[]}>
          <svg aria-label="Routing edge preview">{children}</svg>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

describe('RoutingEdge in React Flow', () => {
  it('renders semantic labels, icons, loop geometry, and the selected non-color cue', async () => {
    render(
      <MountedRoutingPreview>
        <RoutingEdgePreview
          id="clarify-write-brief"
          label="ready"
          selected
          presentation={{ mode: 'command', loop: false, invalid: false, frozen: false }}
        />
        <RoutingEdgePreview
          id="supervisor-final-report"
          label="enough evidence"
          presentation={{ mode: 'conditional', loop: false, invalid: false, frozen: false }}
        />
        <RoutingEdgePreview
          id="supervisor-human-review"
          label="fallback"
          presentation={{ mode: 'fallback', loop: false, invalid: false, frozen: false }}
        />
        <RoutingEdgePreview
          id="researcher-continue"
          label="continue"
          presentation={{ mode: 'normal', loop: true, invalid: false, frozen: false }}
        />
      </MountedRoutingPreview>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-edge-id="clarify-write-brief"]')).not.toBeNull();
    });

    const command = document.querySelector('[data-edge-id="clarify-write-brief"]')!;
    const conditional = document.querySelector('[data-edge-id="supervisor-final-report"]')!;
    const fallback = document.querySelector('[data-edge-id="supervisor-human-review"]')!;
    const loop = document.querySelector('[data-edge-id="researcher-continue"]')!;

    expect(command.getAttribute('data-mode')).toBe('command');
    expect(command.textContent).toContain('ready');
    expect(conditional.getAttribute('data-mode')).toBe('conditional');
    expect(fallback.getAttribute('data-mode')).toBe('fallback');
    expect(fallback.textContent).toContain('fallback');
    expect(loop.getAttribute('data-loop')).toBe('true');
    expect(loop.textContent).toContain('Loop');
    expect(document.querySelector('.routing-edge__selection-halo')).not.toBeNull();
    expect(document.querySelector('.routing-edge__branch-dot')).not.toBeNull();
  });

  it('keeps invalid and frozen states readable apart from color', async () => {
    const { rerender } = render(
      <MountedRoutingPreview>
        <RoutingEdgePreview
          id="clarify-write-brief"
          presentation={{ mode: 'command', loop: false, invalid: true, frozen: false }}
        />
      </MountedRoutingPreview>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-edge-id="clarify-write-brief"]')?.getAttribute('data-invalid')).toBe('true');
    });
    expect(document.querySelector('[data-edge-id="clarify-write-brief"]')?.textContent).toContain('Invalid');

    rerender(
      <MountedRoutingPreview>
        <RoutingEdgePreview
          id="clarify-write-brief"
          label="ready"
          presentation={{ mode: 'command', loop: false, invalid: false, frozen: true }}
        />
      </MountedRoutingPreview>,
    );
    await waitFor(() => {
      expect(document.querySelector('[data-edge-id="clarify-write-brief"]')?.getAttribute('data-frozen')).toBe('true');
    });
    expect(document.querySelector('[data-edge-id="clarify-write-brief"]')?.textContent).toContain('Frozen');
  });

  it('mounts a source-scoped validation failure as an actionable invalid route', async () => {
    const invalid = structuredClone(researchIntakeRoutingGraph);
    invalid.edges.find((edge) => edge.id === 'supervisor-final-report')!.label = '  ';
    const edge = projectGraphToCanvas(invalid, null).edges.find(
      (candidate) => candidate.id === 'supervisor-researcher',
    )!;

    render(
      <MountedRoutingPreview>
        <RoutingEdgePreview
          id={edge.id}
          label={edge.label as string | undefined}
          presentation={edge.data.presentation}
        />
      </MountedRoutingPreview>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-edge-id="supervisor-researcher"]')?.getAttribute('data-invalid')).toBe('true');
    });
    const label = document.querySelector('[data-edge-id="supervisor-researcher"]')!;
    expect(label.textContent).toContain('Invalid');
    expect(label.getAttribute('aria-label')).toContain('invalid');
  });

  it('uses stroke pattern and lock precedence for hoverable routing states', () => {
    expect(routingEdgeTokens({ mode: 'command', loop: false, invalid: false, frozen: false }).dasharray).toBe('7 5');
    expect(routingEdgeTokens({ mode: 'fallback', loop: false, invalid: false, frozen: false }).dasharray).toBe('6 5');
    expect(routingEdgeTokens({ mode: 'normal', loop: false, invalid: true, frozen: true })).toMatchObject({
      color: '#9ca3af',
      dasharray: '5 5',
    });
  });
});
