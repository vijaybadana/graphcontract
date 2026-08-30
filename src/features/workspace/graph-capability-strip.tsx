'use client';

import {
  BracketsCurlyIcon,
  DatabaseIcon,
  FloppyDiskIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

import type { WorkflowGraph } from '@/src/domain';
import type { GraphDurabilityTab } from '@/src/features/inspector/durability-settings';

import './graph-capability-strip.css';

type CapabilityName = 'State' | 'Checkpoint' | 'Store' | 'Runtime';

type CapabilityStripItem = {
  name: CapabilityName;
  status: string;
  detail: string;
  tab: GraphDurabilityTab;
  tone: 'state' | 'checkpoint' | 'store' | 'runtime';
  icon: Icon;
};

export function GraphCapabilityStrip({
  graph,
  onOpenSettings,
}: {
  graph: WorkflowGraph;
  onOpenSettings: (tab?: GraphDurabilityTab) => void;
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
    },
    {
      name: 'Store',
      status: graph.capabilities.store.available ? 'Available' : 'Off',
      detail: graph.capabilities.store.available ? 'Direct Step R/W available' : 'Cross-thread knowledge',
      tab: 'store',
      tone: 'store',
      icon: DatabaseIcon,
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
    },
  ];

  return (
    <section className="graph-capability-strip" aria-label="Graph durability capabilities">
      <span className="graph-capability-strip__label">Capabilities</span>
      <div className="graph-capability-strip__items">
        {items.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.name}
              type="button"
              className={`graph-capability-strip__item graph-capability-strip__item--${item.tone}`}
              aria-label={`${item.name}: ${item.status}, ${item.detail}. Open graph settings.`}
              title={`Open ${item.name} settings`}
              onClick={() => onOpenSettings(item.tab)}
            >
              <IconComponent aria-hidden="true" size={15} weight="bold" />
              <span className="graph-capability-strip__item-copy">
                <strong>{item.name}</strong>
                <span>{item.status}</span>
              </span>
            </button>
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
