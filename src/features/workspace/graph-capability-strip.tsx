'use client';

import {
  BracketsCurlyIcon,
  DatabaseIcon,
  EyeIcon,
  FloppyDiskIcon,
  GlobeHemisphereWestIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

import type { WorkflowGraph } from '@/src/domain';
import type { GraphDurabilityTab } from '@/src/features/inspector/durability-settings';

import './graph-capability-strip.css';

type CapabilityName = 'State' | 'Checkpoint' | 'Store' | 'Runtime' | 'Evidence' | 'External';

type CapabilityStripItem = {
  name: CapabilityName;
  status: string;
  detail: string;
  tab?: GraphDurabilityTab;
  tone: 'state' | 'checkpoint' | 'store' | 'runtime' | 'evidence' | 'external';
  icon: Icon;
  action?: 'settings' | 'toggle-evidence';
};

export function GraphCapabilityStrip({
  graph,
  onOpenSettings,
  evidenceOverlayVisible,
  onToggleEvidenceOverlay,
}: {
  graph: WorkflowGraph;
  onOpenSettings: (tab?: GraphDurabilityTab) => void;
  evidenceOverlayVisible: boolean;
  onToggleEvidenceOverlay: () => void;
}) {
  const items: CapabilityStripItem[] = [
    {
      name: 'State',
      status: graph.capabilities.state.enabled ? 'Enabled' : 'Off',
      detail: graph.capabilities.state.enabled
        ? `${graph.capabilities.state.schema.fields.length} field${graph.capabilities.state.schema.fields.length === 1 ? '' : 's'}`
        : 'Per-run data',
      tab: 'state',
      tone: 'state',
      icon: BracketsCurlyIcon,
      action: 'settings',
    },
    {
      name: 'Checkpoint',
      status: graph.capabilities.checkpointer.enabled ? 'Enabled' : 'Off',
      detail: graph.capabilities.checkpointer.enabled
        ? graph.capabilities.checkpointer.durableThread.required ? 'Durable thread required' : 'Resume optional'
        : 'Durable resume',
      tab: 'checkpoint',
      tone: 'checkpoint',
      icon: FloppyDiskIcon,
      action: 'settings',
    },
    {
      name: 'Store',
      status: graph.capabilities.store.available ? 'Available' : 'Off',
      detail: graph.capabilities.store.available ? 'Direct Step R/W available' : 'Cross-thread knowledge',
      tab: 'store',
      tone: 'store',
      icon: DatabaseIcon,
      action: 'settings',
    },
    {
      name: 'Runtime',
      status: graph.capabilities.runtimeMode.mode === 'unspecified'
        ? 'Unspecified'
        : graph.capabilities.runtimeMode.mode === 'voice' ? 'Voice' : 'Text',
      detail: 'Graph-level mode',
      tab: 'runtime',
      tone: 'runtime',
      icon: TerminalWindowIcon,
      action: 'settings',
    },
    {
      name: 'Evidence',
      status: graph.capabilities.provenance.evidenceOverlayAvailable
        ? evidenceOverlayVisible ? 'Showing' : 'Hidden'
        : 'Unavailable',
      detail: 'Projection-only overlay',
      tone: 'evidence',
      icon: EyeIcon,
      action: 'toggle-evidence',
    },
    {
      name: 'External',
      status: graph.capabilities.provenance.externalOrchestrationAvailable ? 'Available' : 'Off',
      detail: 'System boundary links',
      tone: 'external',
      icon: GlobeHemisphereWestIcon,
    },
  ];

  return (
    <section className="graph-capability-strip" aria-label="Graph durability capabilities">
      <span className="graph-capability-strip__label">Capabilities</span>
      <div className="graph-capability-strip__items">
        {items.map((item) => {
          const IconComponent = item.icon;
          const actionable = Boolean(item.action);
          const disabled = item.action === 'toggle-evidence' && !graph.capabilities.provenance.evidenceOverlayAvailable;
          const content = <>
            <IconComponent aria-hidden="true" size={15} weight="bold" />
            <span className="graph-capability-strip__item-copy">
              <strong>{item.name}</strong>
              <span>{item.status}</span>
            </span>
          </>;
          return actionable ? (
            <button
              key={item.name}
              type="button"
              className={`graph-capability-strip__item graph-capability-strip__item--${item.tone}`}
              aria-label={`${item.name}: ${item.status}, ${item.detail}.${item.action === 'settings' ? ' Open graph settings.' : ' Toggle evidence overlay.'}`}
              title={item.action === 'settings' ? `Open ${item.name} settings` : 'Toggle evidence overlay'}
              disabled={disabled}
              aria-pressed={item.action === 'toggle-evidence' ? evidenceOverlayVisible : undefined}
              onClick={() => item.action === 'settings' ? onOpenSettings(item.tab) : onToggleEvidenceOverlay()}
            >
              {content}
            </button>
          ) : (
            <span
              key={item.name}
              className={`graph-capability-strip__item graph-capability-strip__item--${item.tone}`}
              aria-label={`${item.name}: ${item.status}, ${item.detail}.`}
              title={item.detail}
            >
              {content}
            </span>
          );
        })}
      </div>
      <button
        type="button"
        className="graph-capability-strip__settings"
        onClick={() => onOpenSettings()}
      >
        Graph settings
      </button>
    </section>
  );
}
