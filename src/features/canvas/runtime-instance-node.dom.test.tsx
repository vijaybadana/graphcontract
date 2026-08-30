// @vitest-environment jsdom

import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuntimeInstanceNode } from './runtime-instance-node';

afterEach(() => cleanup());

describe('RuntimeInstanceNode', () => {
  it('mounts its read-only connector handles without a React Flow missing-handle warning', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      render(
        <div style={{ width: 720, height: 260 }}>
          <ReactFlowProvider>
            <ReactFlow
              nodeTypes={{ runtimeInstance: RuntimeInstanceNode }}
              nodes={[
                { id: 'source', position: { x: 20, y: 80 }, data: {} },
                {
                  id: 'runtime:worker-1',
                  type: 'runtimeInstance',
                  position: { x: 240, y: 80 },
                  data: {
                    runtimeId: 'worker-1',
                    sendEdgeId: 'send',
                    templateNodeId: 'template',
                    label: 'Search evidence · query 1',
                    ordinal: 1,
                  },
                },
                { id: 'merge', position: { x: 510, y: 80 }, data: {} },
              ]}
              edges={[
                { id: 'runtime-in', source: 'source', target: 'runtime:worker-1' },
                { id: 'runtime-out', source: 'runtime:worker-1', target: 'merge' },
              ]}
            />
          </ReactFlowProvider>
        </div>,
      );

      await waitFor(() => {
        expect(document.querySelector('[data-runtime-id="worker-1"]')).not.toBeNull();
      });
      expect(document.querySelectorAll('.runtime-instance-node .react-flow__handle')).toHaveLength(2);
      expect(error.mock.calls.flat().join(' ')).not.toMatch(/handle.*not found|couldn.?t create edge/i);
    } finally {
      error.mockRestore();
    }
  });
});
