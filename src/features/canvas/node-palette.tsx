'use client';

import { DragEvent, useEffect, useMemo, useState } from 'react';
import {
  FlagCheckeredIcon,
  HandIcon,
  LightningIcon,
  PlayCircleIcon,
  RobotIcon,
  StackIcon,
  WrenchIcon,
} from '@phosphor-icons/react';

import { GraphProposal, NodeKind, nodeKinds, WorkflowGraph } from '@/src/domain';
import { PanelCollapseButton } from '@/src/features/workspace/panel-collapse-control';

import './node-palette.css';

export type PaletteKind = NodeKind | 'subgraph';
export type PaletteItem = {
  kind: PaletteKind;
  label: string;
  group: 'Flow' | 'Work' | 'Structure' | 'Human';
};

export const paletteItems: readonly PaletteItem[] = [
  { kind: 'start', label: 'Start', group: 'Flow' },
  { kind: 'end', label: 'End', group: 'Flow' },
  { kind: 'subgraph', label: 'Subgraph', group: 'Structure' },
  { kind: 'agent', label: 'Agent', group: 'Work' },
  { kind: 'action', label: 'Action / function', group: 'Work' },
  { kind: 'tool', label: 'Tool', group: 'Work' },
  { kind: 'human_input', label: 'Human Input', group: 'Human' },
];

const groups: PaletteItem['group'][] = ['Flow', 'Structure', 'Work', 'Human'];

export function filterPaletteItems(query: string): PaletteItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return paletteItems.filter((item) => item.label.toLowerCase().includes(normalizedQuery));
}

/** The outer workflow keeps its singleton Start/End rule. Once a container is
 * present, additional endpoints can be created and assigned into that group. */
export function isPaletteItemSingletonDisabled(
  graph: WorkflowGraph,
  item: PaletteItem,
): boolean {
  return (
    graph.subgraphs.length === 0 &&
    (item.kind === 'start' || item.kind === 'end') &&
    graph.nodes.some((node) => node.kind === item.kind)
  );
}

function PaletteIcon({ kind }: { kind: PaletteKind }) {
  const props = { 'aria-hidden': true, size: 16, weight: 'duotone' as const };
  switch (kind) {
    case 'start': return <PlayCircleIcon {...props} />;
    case 'end': return <FlagCheckeredIcon {...props} />;
    case 'subgraph': return <StackIcon {...props} />;
    case 'agent': return <RobotIcon {...props} />;
    case 'action': return <LightningIcon {...props} />;
    case 'tool': return <WrenchIcon {...props} />;
    case 'human_input': return <HandIcon {...props} />;
  }
}

export function getContractHealthLabel(
  graph: WorkflowGraph,
  proposal: GraphProposal | null,
  validationIssueCount: number,
) {
  if (proposal?.status === 'pending') return 'Valid — proposal awaiting review.';
  if (proposal) return 'Proposal needs changes.';
  if (validationIssueCount) {
    return `${validationIssueCount} issue${validationIssueCount === 1 ? '' : 's'}`;
  }
  return graph.status === 'frozen' ? 'Frozen' : 'Ready to freeze';
}

export function NodePalette({
  graph,
  disabled,
  validationIssueCount,
  proposal,
  onAdd,
  onLoadResearchSupervisorDemo,
  onCollapse,
}: {
  graph: WorkflowGraph;
  disabled: boolean;
  validationIssueCount: number;
  proposal: GraphProposal | null;
  onAdd: (kind: PaletteKind) => void;
  onLoadResearchSupervisorDemo: () => void;
  onCollapse: () => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (graph.status === 'frozen') setQuery('');
  }, [graph.status]);

  const visiblePalette = useMemo(() => filterPaletteItems(query), [query]);

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: PaletteKind) => {
    event.dataTransfer.setData('application/graphcontract-node', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="workspace-panel node-palette absolute left-3 top-3 z-30 max-h-[calc(100%-1.5rem)] w-[232px] overflow-y-auto p-3">
      <div className="node-palette__header">
        <div>
          <p className="eyebrow">Node inventory</p>
          <p className="node-palette__count">{paletteItems.length} components</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`health-dot ${proposal?.status === 'pending' || !validationIssueCount ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <PanelCollapseButton
            side="left"
            onCollapse={onCollapse}
            label="Collapse node palette"
          />
        </div>
      </div>
      <p className="node-palette__hint">
        {proposal
          ? 'Palette locked while a proposal awaits review. Approve or reject it to continue editing.'
          : graph.status === 'frozen'
            ? 'Palette locked while the contract is frozen.'
            : 'Drag onto the canvas or click to add.'}
      </p>
      <div className="node-palette__search">
        <label className="sr-only" htmlFor="node-palette-search">Search components</label>
        <input id="node-palette-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components" autoComplete="off" />
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{visiblePalette.length} of {paletteItems.length} components shown</p>
      <div className="node-palette__groups">
        {groups.map((group) => {
          const items = visiblePalette.filter((item) => item.group === group);
          if (!items.length) return null;
          return (
            <section key={group} className="node-palette__group" aria-label={`${group} components`}>
              <p className="node-palette__group-label">{group}</p>
              <div className="node-palette__rows">
                {items.map((item) => {
                  const singletonExists = isPaletteItemSingletonDisabled(graph, item);
                  return (
                    <button key={item.kind} type="button" draggable={!disabled && !singletonExists} disabled={disabled || singletonExists} onDragStart={(event) => onDragStart(event, item.kind)} onClick={() => onAdd(item.kind)} className="node-palette__row">
                      <span className={`node-palette__icon node-palette__icon--${item.kind}`}><PaletteIcon kind={item.kind} /></span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!visiblePalette.length && <p className="node-palette__empty" role="status">No components match “{query.trim()}”.</p>}
      </div>
      <div className="node-palette__health">
        <p>Contract health</p>
        <strong>{getContractHealthLabel(graph, proposal, validationIssueCount)}</strong>
      </div>
      <div className="node-palette__demo">
        <button
          type="button"
          disabled={disabled}
          onClick={onLoadResearchSupervisorDemo}
          className="node-palette__demo-button"
        >
          <RobotIcon aria-hidden="true" size={15} weight="duotone" />
          Load Research Supervisor demo
        </button>
        <p>Replaces this canvas. Reset restores the Customer Support sample.</p>
      </div>
      <p className="node-palette__keys">Keys: ⌘/Ctrl Z undo · D duplicate · Delete remove</p>
    </aside>
  );
}

export function readDroppedNodeKind(event: DragEvent<HTMLDivElement>): NodeKind | null {
  const kind = event.dataTransfer.getData('application/graphcontract-node') as NodeKind;
  return nodeKinds.includes(kind) ? kind : null;
}

export function readDroppedPaletteKind(event: DragEvent<HTMLDivElement>): PaletteKind | null {
  const kind = event.dataTransfer.getData('application/graphcontract-node') as PaletteKind;
  return kind === 'subgraph' || nodeKinds.includes(kind as NodeKind) ? kind : null;
}
