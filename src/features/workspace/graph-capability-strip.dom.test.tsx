// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { sampleGraph } from '@/src/domain';
import { GraphCapabilityStrip } from './graph-capability-strip';

describe('GraphCapabilityStrip', () => {
  it('presents State, Checkpoint, Store, Runtime, Evidence, and External as separate capabilities', () => {
    const graph = structuredClone(sampleGraph);
    graph.capabilities = {
      state: { enabled: true, schema: { fields: ['messages', 'results'] }, reducers: [] },
      checkpointer: { enabled: true, durableThread: { required: true } },
      store: { available: true },
      runtimeMode: { mode: 'text', input: 'text' },
      provenance: { evidenceOverlayAvailable: true, externalOrchestrationAvailable: true },
    };
    const onOpenSettings = vi.fn();
    const onToggleEvidenceOverlay = vi.fn();
    render(<GraphCapabilityStrip graph={graph} onOpenSettings={onOpenSettings} evidenceOverlayVisible={false} onToggleEvidenceOverlay={onToggleEvidenceOverlay} />);

    expect(screen.getByRole('button', { name: /State: Enabled, 2 fields/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Checkpoint: Enabled, Durable thread required/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Store: Available, Direct Step R\/W available/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Runtime: Text, Graph-level mode/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Evidence: Hidden, Projection-only overlay/i })).toBeTruthy();
    expect(screen.getByLabelText(/External: Available, System boundary links/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Store: Available/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph settings' }));
    fireEvent.click(screen.getByRole('button', { name: /Evidence: Hidden/i }));
    expect(onOpenSettings).toHaveBeenNthCalledWith(1, 'store');
    expect(onOpenSettings).toHaveBeenNthCalledWith(2);
    expect(onToggleEvidenceOverlay).toHaveBeenCalledOnce();
  });
});
