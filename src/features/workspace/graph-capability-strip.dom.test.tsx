// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { sampleGraph } from '@/src/domain';
import { GraphCapabilityStrip } from './graph-capability-strip';

describe('GraphCapabilityStrip', () => {
  it('presents State, Checkpoint, Store, and Runtime as separate graph settings', () => {
    const graph = structuredClone(sampleGraph);
    graph.capabilities = {
      state: { enabled: true, schema: { fields: ['messages', 'results'] }, reducers: [] },
      checkpointer: { enabled: true, durableThread: { required: true } },
      store: { available: true },
      runtimeMode: { mode: 'text', input: 'text' },
    };
    const onOpenSettings = vi.fn();
    render(<GraphCapabilityStrip graph={graph} onOpenSettings={onOpenSettings} />);

    expect(screen.getByRole('button', { name: /State: Enabled, 2 fields/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Checkpoint: Enabled, Durable thread required/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Store: Available, Direct Step R\/W available/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Runtime: Text, Graph-level mode/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Store: Available/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph settings' }));
    expect(onOpenSettings).toHaveBeenNthCalledWith(1, 'store');
    expect(onOpenSettings).toHaveBeenNthCalledWith(2);
  });
});
