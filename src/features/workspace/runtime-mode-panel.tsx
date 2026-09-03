'use client';

import {
  ArrowRightIcon,
  CopyIcon,
  CrosshairIcon,
  EyeIcon,
  LockSimpleIcon,
  PulseIcon,
  StackIcon,
} from '@phosphor-icons/react';

import type { RuntimeProjectionFixture, WorkflowGraph } from '@/src/domain';
import type { RuntimeInstanceNodeData } from '@/src/features/canvas/runtime-instance-node';
import { ModePanelShell } from '@/src/features/workspace/mode-panel';

type RuntimeModePanelProps = {
  graph: WorkflowGraph;
  fixture: RuntimeProjectionFixture | null;
  selectedInstance: RuntimeInstanceNodeData | null;
  onSelect: (instance: RuntimeInstanceNodeData) => void;
  onFocus: (instance: RuntimeInstanceNodeData) => void;
  onCollapse: () => void;
};

const shortRuntimeId = (value: string) => value.length > 18
  ? `${value.slice(0, 8)}…${value.slice(-6)}`
  : value;

export function RuntimeModePanel({
  graph,
  fixture,
  selectedInstance,
  onSelect,
  onFocus,
  onCollapse,
}: RuntimeModePanelProps) {
  const instances: RuntimeInstanceNodeData[] = fixture?.instances.map((instance) => ({
    runtimeId: instance.id,
    sendEdgeId: instance.sendEdgeId,
    templateNodeId: instance.templateNodeId,
    label: instance.label ?? `Instance ${instance.ordinal}`,
    ordinal: instance.ordinal,
  })) ?? [];
  const active = selectedInstance && instances.some((instance) => instance.runtimeId === selectedInstance.runtimeId)
    ? selectedInstance
    : instances[0] ?? null;
  const template = active
    ? graph.nodes.find((node) => node.id === active.templateNodeId)
    : null;
  const sendEdge = active
    ? graph.edges.find((edge) => edge.id === active.sendEdgeId)
    : null;
  const sendSource = sendEdge
    ? graph.nodes.find((node) => node.id === sendEdge.source)
    : null;

  return (
    <ModePanelShell
      title="Runtime"
      icon={<PulseIcon size={16} weight="bold" />}
      tone="runtime"
      badge="Fixture"
      action={(
        <span className="mode-panel__read-only" aria-label="Read-only runtime projection">
          <LockSimpleIcon size={14} weight="bold" aria-hidden="true" />
          Read only
        </span>
      )}
      onCollapse={onCollapse}
      footer={active ? (
        <button type="button" className="mode-panel__primary-action" onClick={() => onFocus(active)}>
          <CrosshairIcon size={16} weight="bold" aria-hidden="true" />
          Focus instance
        </button>
      ) : undefined}
    >
      <section className="mode-panel__section runtime-mode__topology" aria-labelledby="runtime-topology-heading">
        <div className="mode-panel__section-heading">
          <h3 id="runtime-topology-heading">Observed topology</h3>
          <span>{instances.length} instances</span>
        </div>
        {active ? (
          <div className="runtime-mode__flow" aria-label={`${sendSource?.label ?? 'Send'} creates ${instances.length} observed instances of ${template?.label ?? active.templateNodeId}`}>
            <span>{sendSource?.label ?? 'Send'}</span>
            <ArrowRightIcon size={12} aria-hidden="true" />
            <strong>Send ×N</strong>
            <ArrowRightIcon size={12} aria-hidden="true" />
            <span>{instances.length} observed</span>
          </div>
        ) : (
          <p className="mode-panel__empty">No runtime evidence is available for this graph.</p>
        )}
      </section>

      {instances.length > 0 && (
        <section className="mode-panel__section" aria-labelledby="runtime-instances-heading">
          <div className="mode-panel__section-heading">
            <h3 id="runtime-instances-heading">Instances</h3>
          </div>
          <ul className="runtime-mode__instances">
            {instances.map((instance) => (
              <li key={instance.runtimeId}>
                <button
                  type="button"
                  className={`runtime-mode__instance ${active?.runtimeId === instance.runtimeId ? 'is-selected' : ''}`}
                  aria-pressed={active?.runtimeId === instance.runtimeId}
                  onClick={() => onSelect(instance)}
                >
                  <span className="runtime-mode__instance-icon" aria-hidden="true"><StackIcon size={15} weight="bold" /></span>
                  <span><strong>{instance.label}</strong><small>Instance #{instance.ordinal}</small></span>
                  <EyeIcon size={14} weight="bold" aria-label="Observed" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active && (
        <section className="mode-panel__section runtime-mode__details" aria-labelledby="runtime-details-heading">
          <div className="mode-panel__section-heading">
            <h3 id="runtime-details-heading">Selected instance</h3>
          </div>
          <dl>
            <div><dt>Runtime ID</dt><dd><code title={active.runtimeId}>{shortRuntimeId(active.runtimeId)}</code><button type="button" aria-label="Copy runtime ID" onClick={() => void navigator.clipboard?.writeText(active.runtimeId)}><CopyIcon size={14} aria-hidden="true" /></button></dd></div>
            <div><dt>Template</dt><dd>{template?.label ?? active.templateNodeId}</dd></div>
            <div><dt>Send source</dt><dd>{sendSource?.label ?? active.sendEdgeId}</dd></div>
            <div><dt>Contract impact</dt><dd>None · projection only</dd></div>
          </dl>
        </section>
      )}
    </ModePanelShell>
  );
}
