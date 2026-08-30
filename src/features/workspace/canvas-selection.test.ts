import { describe, expect, it } from 'vitest';

import type { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import type { CanvasFlowEdge } from '@/src/adapters/react-flow/project-graph';
import { workspaceSelectionFromCanvas } from './canvas-selection';

describe('workspaceSelectionFromCanvas', () => {
  it('keeps every multi-selected node while retaining the selected primary', () => {
    const nodes = [
      {
        id: 'billing',
        type: 'contractNode',
        position: { x: 100, y: 100 },
        data: { id: 'billing', kind: 'step', executor: 'ai', label: 'Billing', position: { x: 100, y: 100 } },
      },
      {
        id: 'diagnostic',
        type: 'contractNode',
        position: { x: 300, y: 100 },
        data: { id: 'diagnostic', kind: 'step', executor: 'deterministic', label: 'Diagnostic', position: { x: 300, y: 100 } },
      },
    ] as CanvasFlowNode[];

    expect(
      workspaceSelectionFromCanvas(nodes, [], { type: 'node', id: 'billing' }),
    ).toEqual({
      nodeIds: ['billing', 'diagnostic'],
      subgraphIds: [],
      edgeIds: [],
      primary: { type: 'node', id: 'billing' },
    });
  });

  it('does not promote a non-native system relationship into canonical selection', () => {
    const relationships = [{
      id: 'system-relationship:notify-runner',
      type: 'systemRelationship',
      source: 'classifier',
      target: 'external-system:runner',
      data: {
        projection: 'system-relationship',
        relationship: {
          id: 'notify-runner',
          kind: 'external-orchestration',
          source: { kind: 'node', nodeId: 'classifier' },
          target: { kind: 'external', externalId: 'runner', label: 'Runner' },
          provenance: { representation: 'external-orchestration' },
        },
      },
    }] as CanvasFlowEdge[];

    expect(workspaceSelectionFromCanvas([], relationships, null)).toEqual({
      nodeIds: [],
      subgraphIds: [],
      edgeIds: [],
      primary: null,
    });
  });
});
