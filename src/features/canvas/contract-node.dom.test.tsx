// @vitest-environment jsdom

import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CanvasFlowNode } from './canvas-node';
import { ContractNode, ContractNodeData, stepModifierPresentations } from './contract-node';

const nodeTypes = { contractNode: ContractNode };

afterEach(() => cleanup());

function MountedContractNode({ data, selected = false }: { data: ContractNodeData; selected?: boolean }) {
  const nodes: CanvasFlowNode[] = [
    {
      id: data.id,
      type: 'contractNode',
      position: data.position,
      selected,
      data,
    },
  ];

  return (
    <div style={{ width: 720, height: 360 }}>
      <ReactFlowProvider>
        <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </ReactFlowProvider>
    </div>
  );
}

describe('ContractNode Step anatomy', () => {
  it('keeps executor, semantic modifiers, and proposal state independent with accessible overflow', async () => {
    const onModifierActivate = vi.fn();
    render(
      <MountedContractNode
        selected
        data={{
          id: 'portfolio-decision',
          kind: 'step',
          executor: 'ai',
          label: 'Portfolio decision',
          description: 'Decide the action and persist portfolio changes.',
          position: { x: 160, y: 100 },
          participation: { internalTools: true },
          hitl: {
            enabled: true,
            timing: 'before',
            response: {
              type: 'approval',
              allowedOutcomes: [{ id: 'approve', label: 'Approve', resumeNodeId: 'complete' }],
            },
          },
          sensitive: {
            target: 'Portfolio state',
            authorization: 'Operations Admin',
            approvalRequired: true,
            idempotency: 'Deduplicate by request ID',
          },
          modifiers: {
            guardrail: true,
            storeRead: true,
            storeWrite: true,
            retryFallback: true,
            opaque: true,
            readiness: 'degraded',
          },
          opaque: {
            factoryLabel: 'portfolio_factory',
            inputPorts: [],
            outputPorts: [],
            runtimeInspection: { available: false },
          },
          proposalState: 'updated',
          onModifierActivate,
        }}
      />,
    );

    const shell = (await screen.findByText('Portfolio decision')).closest('.contract-node-shell')!;
    expect(shell.getAttribute('data-kind')).toBe('step');
    expect(shell.getAttribute('data-display-kind')).toBe('agent');
    expect(shell.getAttribute('data-executor')).toBe('ai');
    expect(shell.querySelector('[data-node-visual="agent"]')).not.toBeNull();
    expect(screen.getByText('Agent')).toBeTruthy();
    expect(shell.classList.contains('is-selected')).toBe(true);
    expect(shell.querySelectorAll('.react-flow__handle.target')).toHaveLength(1);
    expect(shell.querySelectorAll('.react-flow__handle.source')).toHaveLength(1);
    expect(shell.querySelectorAll('.contract-node-modifier-rail > .contract-node-modifier-chip')).toHaveLength(3);
    expect(screen.getByText('Proposed updated')).toBeTruthy();
    expect(shell.querySelector('[data-hitl-timing="before"]')?.getAttribute('aria-label')).toContain('before execution');

    const hitl = shell.querySelector<HTMLButtonElement>('[data-modifier-id="hitl"]')!;
    expect(hitl.getAttribute('aria-label')).toContain('Human-in-the-loop gate');
    fireEvent.click(hitl);
    expect(onModifierActivate).toHaveBeenCalledWith(
      'portfolio-decision',
      expect.objectContaining({ id: 'hitl', inspectorSection: 'hitl' }),
    );

    const overflow = shell.querySelector<HTMLButtonElement>('.contract-node-modifier-overflow-button')!;
    expect(overflow.getAttribute('aria-label')).toBe('Show 7 more modifiers for Portfolio decision');
    overflow.focus();
    expect(document.activeElement).toBe(overflow);
    fireEvent.click(overflow);
    expect(overflow.getAttribute('aria-expanded')).toBe('true');
    expect(shell.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Additional modifiers for Portfolio decision');
    expect(shell.querySelector('[data-modifier-id="sensitive"]')).toBeTruthy();
  });

  it('uses the unbadged deterministic Step baseline while preserving explicit invalid and frozen status', async () => {
    render(
      <MountedContractNode
        data={{
          id: 'write-report',
          kind: 'step',
          executor: 'deterministic',
          label: 'Write report',
          position: { x: 160, y: 100 },
          invalid: true,
          frozen: true,
          proposalState: 'added',
        }}
      />,
    );

    const shell = (await screen.findByText('Write report')).closest('.contract-node-shell')!;
    expect(shell.getAttribute('data-executor')).toBe('deterministic');
    expect(shell.getAttribute('data-display-kind')).toBe('task');
    expect(shell.querySelector('[data-node-visual="task"]')).not.toBeNull();
    expect(screen.getByText('Task')).toBeTruthy();
    expect(shell.classList.contains('is-invalid')).toBe(true);
    expect(shell.classList.contains('is-frozen')).toBe(true);
    expect(shell.classList.contains('is-proposed-added')).toBe(true);
    expect(shell.querySelector('.contract-node-modifier-rail')).toBeNull();
    expect(screen.queryByText('Deterministic')).toBeNull();
    expect(screen.getByText('Invalid')).toBeTruthy();
    expect(screen.getByText('Frozen')).toBeTruthy();
    expect(screen.getByText('Proposed added')).toBeTruthy();
  });

  it('uses the shared Human presentation for human-owned canvas nodes', async () => {
    render(
      <MountedContractNode
        data={{
          id: 'human-review',
          kind: 'step',
          executor: 'human',
          label: 'Review response',
          position: { x: 160, y: 100 },
        }}
      />,
    );

    const shell = (await screen.findByText('Review response')).closest('.contract-node-shell')!;
    expect(shell.getAttribute('data-display-kind')).toBe('human');
    expect(shell.querySelector('[data-node-visual="human"]')).not.toBeNull();
    expect(within(shell as HTMLElement).getByText('Human', { selector: '.contract-node-kind' })).toBeTruthy();
  });

  it('renders before, inside, and after gates at distinct accessible node boundaries', async () => {
    for (const timing of ['before', 'inside', 'after'] as const) {
      render(
        <MountedContractNode
          data={{
            id: `gate-${timing}`,
            kind: 'step',
            executor: 'tool',
            label: `${timing} gate`,
            position: { x: 160, y: 100 },
            hitl: {
              enabled: true,
              timing,
              response: { type: 'approval', allowedOutcomes: [] },
            },
          }}
        />,
      );
      const shell = (await screen.findByText(`${timing} gate`)).closest('.contract-node-shell')!;
      expect(shell.getAttribute('data-display-kind')).toBe('tool');
      expect(shell.querySelector('[data-node-visual="tool"]')).not.toBeNull();
      expect(within(shell as HTMLElement).getByText('Tool', { selector: '.contract-node-kind' })).toBeTruthy();
      const marker = document.querySelector<HTMLButtonElement>(`[data-hitl-timing="${timing}"]`)!;
      expect(marker.getAttribute('aria-label')).toBe(
        `Human-in-the-loop gate, ${timing} execution. Focus human input in the inspector.`,
      );
      expect(marker.classList.contains(`contract-node-hitl-marker--${timing}`)).toBe(true);
      cleanup();
    }
  });

  it('summarizes canonical modifier data without treating proposal state as a modifier', () => {
    expect(
      stepModifierPresentations({
        id: 'tool-review',
        kind: 'step',
        executor: 'tool',
        label: 'Tool review',
        position: { x: 0, y: 0 },
        hitl: {
          enabled: true,
          timing: 'inside',
          response: { type: 'approval', allowedOutcomes: [] },
        },
        sensitive: {
          target: 'Ledger',
          authorization: 'Finance',
          approvalRequired: false,
          idempotency: 'Request key',
        },
        storeAccess: { read: {} },
        retry: { maxAttempts: 2, backoff: { strategy: 'fixed', initialDelayMs: 0 } },
      }),
    ).toEqual([
      expect.objectContaining({ id: 'executor', label: 'Tool', inspectorSection: 'executor' }),
      expect.objectContaining({ id: 'hitl', inspectorSection: 'hitl' }),
      expect.objectContaining({ id: 'sensitive', inspectorSection: 'sensitive' }),
      expect.objectContaining({ id: 'storeRead', inspectorSection: 'storeAccess' }),
      expect.objectContaining({ id: 'retryFallback', inspectorSection: 'retry', accessibleLabel: 'Internal retry policy' }),
    ]);
  });

  it('does not present a legacy opaque modifier as an opaque interface declaration', () => {
    const presentations = stepModifierPresentations({
      id: 'legacy-prebuilt',
      kind: 'step',
      executor: 'deterministic',
      label: 'Legacy prebuilt',
      position: { x: 0, y: 0 },
      modifiers: { opaque: true },
    });

    expect(presentations.some((presentation) => presentation.id === 'opaque')).toBe(false);
  });

  it('renders v6 provenance, opaque readiness, and semantic outcomes with text cues', async () => {
    render(
      <MountedContractNode
        data={{
          id: 'prebuilt-agent',
          kind: 'step',
          executor: 'ai',
          label: 'Prebuilt agent',
          position: { x: 120, y: 80 },
          provenance: { representation: 'runtime-generated' },
          readiness: { state: 'degraded', detail: 'Partial retries' },
          opaque: {
            factoryLabel: 'create_prebuilt_agent',
            inputPorts: [{ name: 'request' }],
            outputPorts: [{ name: 'result' }],
            runtimeInspection: { available: false },
          },
          evidenceMarker: 4,
        }}
      />,
    );
    const step = (await screen.findByText('Prebuilt agent')).closest('.contract-node-shell')!;
    expect(step.getAttribute('data-provenance')).toBe('runtime-generated');
    expect(step.classList.contains('provenance--runtime-generated')).toBe(true);
    expect(step.getAttribute('data-readiness')).toBe('degraded');
    expect(step.textContent).toContain('Opaque');
    expect(step.textContent).toContain('Degraded');
    expect(step.querySelector('[aria-label^="Evidence marker 4"]')).toBeTruthy();

    cleanup();
    render(
      <MountedContractNode
        data={{
          id: 'await-reply',
          kind: 'end',
          label: 'Await reply',
          position: { x: 120, y: 80 },
          provenance: { representation: 'derived-semantic' },
          outcome: { kind: 'awaiting-reply' },
        }}
      />,
    );
    const end = (await screen.findByText('Await reply')).closest('.contract-node-shell')!;
    expect(end.classList.contains('provenance--derived-semantic')).toBe(true);
    expect(end.textContent).toContain('awaiting reply');
  });
});
