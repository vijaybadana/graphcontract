// @vitest-environment jsdom

import { ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DynamicWorkerGroup } from './dynamic-worker-group';

afterEach(() => cleanup());

describe('DynamicWorkerGroup', () => {
  it('presents dynamic multiplicity without inventing an editable canonical subgraph', () => {
    const onActivate = vi.fn();
    render(
      <ReactFlowProvider>
        <DynamicWorkerGroup
          id="dynamic-worker-group:supervisor-send"
          selected={false}
          data={{
            label: 'Researcher ×N',
            sendEdgeId: 'supervisor-send',
            templateNodeId: 'researcher-template',
            memberNodeIds: ['start', 'agent', 'tools', 'compress', 'end'],
            memberEdgeIds: ['start-agent', 'agent-tools', 'tools-compress', 'compress-end'],
            mergeNodeId: 'research-merge',
            payloadLabel: 'research task',
            templateAnatomy: {
              id: 'researcher-template-anatomy',
              label: 'Researcher ×N',
              dimensions: { width: 900, height: 300 },
              canonicalTemplateNodeId: 'agent',
              nodes: [
                { id: 'start', kind: 'start', label: 'Start', position: { x: 20, y: 110 }, dimensions: { width: 90, height: 60 } },
                { id: 'agent', kind: 'step', executor: 'ai', label: 'Researcher Agent', position: { x: 150, y: 80 }, dimensions: { width: 180, height: 120 } },
                { id: 'tools', kind: 'step', executor: 'tool', label: 'Research Tools', position: { x: 370, y: 80 }, dimensions: { width: 180, height: 120 } },
                { id: 'compress', kind: 'step', executor: 'deterministic', label: 'Compress Findings', position: { x: 590, y: 80 }, dimensions: { width: 180, height: 120 } },
                { id: 'end', kind: 'end', label: 'End', position: { x: 810, y: 110 }, dimensions: { width: 70, height: 60 } },
              ],
              edges: [
                { id: 'start-agent', source: 'start', target: 'agent' },
                { id: 'agent-tools', source: 'agent', target: 'tools' },
                { id: 'tools-compress', source: 'tools', target: 'compress' },
                { id: 'compress-end', source: 'compress', target: 'end' },
              ],
            },
            layoutEditable: true,
            active: true,
            resizeLimits: {
              current: { width: 900, height: 300 },
              minWidth: 880,
              minHeight: 220,
              maxWidth: 1_200,
              maxHeight: 500,
              obstacles: [],
            },
            onResize: vi.fn(),
            onActivate,
          }}
        />
      </ReactFlowProvider>,
    );

    const button = screen.getByRole('button', {
      name: 'Researcher ×N, declared dynamic subgraph template ×N with 5 steps and 4 connections. Focus canonical worker template.',
    });
    expect(document.querySelectorAll('.dynamic-worker-group-copy')).toHaveLength(2);
    expect(screen.getByText('Dynamic subgraph template')).toBeTruthy();
    expect(document.querySelectorAll('.dynamic-worker-template-node')).toHaveLength(4);
    expect(document.querySelectorAll('.dynamic-worker-template-node .contract-node-shell')).toHaveLength(4);
    expect(document.querySelector('.dynamic-worker-template-node .contract-node-shell[data-display-kind="tool"]')).toBeTruthy();
    expect(document.querySelector('.dynamic-worker-template-node .contract-node-shell[data-display-kind="task"]')).toBeTruthy();
    expect(screen.getByText('Compress Findings')).toBeTruthy();
    expect(document.querySelectorAll('.dynamic-worker-template-edge')).toHaveLength(4);
    expect(document.querySelector('.dynamic-worker-group-resize-control')).not.toBeNull();
    expect(button.classList.contains('dynamic-worker-group-drag-surface')).toBe(true);
    expect(button.classList.contains('nodrag')).toBe(false);
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledWith('researcher-template');
  });
});
