'use client';

import { DragEvent, useMemo, useState } from 'react';
import { FlagCheckeredIcon, HandIcon, LightningIcon, PlayCircleIcon, RobotIcon, WrenchIcon } from '@phosphor-icons/react';

import { GraphProposal, NodeKind, nodeKinds, WorkflowGraph } from '@/src/domain';
import { PanelCollapseButton } from '@/src/features/workspace/panel-collapse-control';

import './node-palette.css';

type PaletteItem = { kind: NodeKind; label: string; group: 'Flow' | 'Work' | 'Human' };

const palette: PaletteItem[] = [
  { kind: 'start', label: 'Start', group: 'Flow' },
  { kind: 'end', label: 'End', group: 'Flow' },
  { kind: 'agent', label: 'Agent', group: 'Work' },
  { kind: 'action', label: 'Action / function', group: 'Work' },
  { kind: 'tool', label: 'Tool', group: 'Work' },
  { kind: 'human_input', label: 'Human Input', group: 'Human' },
];

const groups: PaletteItem['group'][] = ['Flow', 'Work', 'Human'];

function PaletteIcon({ kind }: { kind: NodeKind }) {
  const props = { 'aria-hidden': true, size: 16, weight: 'duotone' as const };
  switch (kind) {
    case 'start': return <PlayCircleIcon {...props} />;
    case 'end': return <FlagCheckeredIcon {...props} />;
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
  onCollapse,
}: {
  graph: WorkflowGraph;
  disabled: boolean;
  validationIssueCount: number;
  proposal: GraphProposal | null;
  onAdd: (kind: NodeKind) => void;
  onCollapse: () => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePalette = useMemo(
    () => palette.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery],
  );

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
    event.dataTransfer.setData('application/graphcontract-node', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="workspace-panel node-palette absolute left-3 top-3 z-30 max-h-[calc(100%-1.5rem)] w-[232px] overflow-y-auto p-3">
      <div className="node-palette__header">
        <div>
          <p className="eyebrow">Node inventory</p>
          <p className="node-palette__count">{palette.length} components</p>
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
      <p className="sr-only" aria-live="polite" aria-atomic="true">{visiblePalette.length} of {palette.length} components shown</p>
      <div className="node-palette__groups">
        {groups.map((group) => {
          const items = visiblePalette.filter((item) => item.group === group);
          if (!items.length) return null;
          return (
            <section key={group} className="node-palette__group" aria-label={`${group} components`}>
              <p className="node-palette__group-label">{group}</p>
              <div className="node-palette__rows">
                {items.map((item) => {
                  const singletonExists = (item.kind === 'start' || item.kind === 'end') && graph.nodes.some((node) => node.kind === item.kind);
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
      <p className="node-palette__keys">Keys: ⌘/Ctrl Z undo · D duplicate · Delete remove</p>
    </aside>
  );
}

export function readDroppedNodeKind(event: DragEvent<HTMLDivElement>): NodeKind | null {
  const kind = event.dataTransfer.getData('application/graphcontract-node') as NodeKind;
  return nodeKinds.includes(kind) ? kind : null;
}
