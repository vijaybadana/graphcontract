'use client';

import { DragEvent, useMemo, useState } from 'react';
import {
  FlagCheckeredIcon,
  HandIcon,
  LightningIcon,
  PlayCircleIcon,
  RobotIcon,
  StackIcon,
  WrenchIcon,
} from '@phosphor-icons/react';

import type { NodeCreationPreset } from '@/src/application/workspace';
import { GraphProposal, WorkflowGraph } from '@/src/domain';
import { PanelCollapseButton } from '@/src/features/workspace/panel-collapse-control';

import './node-palette.css';

/** Matches the application creation API; work presets create canonical Steps. */
export type PaletteKind = NodeCreationPreset | 'subgraph';
/** Existing drag payloads used `human_input`; accept it at the UI boundary
 * while keeping the canonical creation preset named `humanReview`. */
export type PalettePayloadKind = PaletteKind | 'human_input';
export type PaletteItem = {
  kind: PaletteKind;
  label: string;
  group: 'Flow' | 'Work' | 'Structure' | 'Human';
};

export const paletteItems: readonly PaletteItem[] = [
  { kind: 'start', label: 'Start', group: 'Flow' },
  { kind: 'end', label: 'End', group: 'Flow' },
  { kind: 'subgraph', label: 'Subgraph', group: 'Structure' },
  { kind: 'step', label: 'Step', group: 'Work' },
  { kind: 'agent', label: 'Agent', group: 'Work' },
  { kind: 'action', label: 'Action', group: 'Work' },
  { kind: 'tool', label: 'Tool', group: 'Work' },
  { kind: 'humanReview', label: 'Human review', group: 'Human' },
];

/** One boundary for palette clicks and drag payloads. The palette retains its
 * authored payload, while every work alias converges on a canonical preset. */
export function normalizePalettePreset(payload: string): PaletteKind | null {
  const kind = payload === 'human_input' ? 'humanReview' : payload;
  return paletteItems.some((item) => item.kind === kind) ? (kind as PaletteKind) : null;
}

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
    case 'step': return <LightningIcon {...props} />;
    case 'agent': return <RobotIcon {...props} />;
    case 'action': return <LightningIcon {...props} />;
    case 'tool': return <WrenchIcon {...props} />;
    case 'humanReview': return <HandIcon {...props} />;
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

type NodePaletteProps = {
  graph: WorkflowGraph;
  disabled: boolean;
  validationIssueCount: number;
  proposal: GraphProposal | null;
  onAdd: (kind: PaletteKind) => void;
  onLoadResearchSupervisorDemo: () => void;
  onLoadResearchIntakeRoutingDemo: () => void;
  onCollapse: () => void;
};

export function NodePalette(props: NodePaletteProps) {
  // A status transition remounts only the palette contents, which clears a
  // stale search without synchronously mutating state from an effect.
  return <NodePaletteContents key={props.graph.status} {...props} />;
}

function NodePaletteContents({
  graph,
  disabled,
  validationIssueCount,
  proposal,
  onAdd,
  onLoadResearchSupervisorDemo,
  onLoadResearchIntakeRoutingDemo,
  onCollapse,
}: NodePaletteProps) {
  const [query, setQuery] = useState('');

  const visiblePalette = useMemo(() => filterPaletteItems(query), [query]);

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: PaletteKind) => {
    event.dataTransfer.setData('application/graphcontract-node', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  const loadResearchSupervisorDemo = () => {
    if (
      window.confirm(
        'Replace the current canvas with the Research Supervisor demo? This replaces the current workflow; one Undo restores it.',
      )
    ) {
      onLoadResearchSupervisorDemo();
    }
  };

  const loadResearchIntakeRoutingDemo = () => {
    if (
      window.confirm(
        'Replace the current canvas with Research Intake Routing? This replaces the current workflow; one Undo restores it.',
      )
    ) {
      onLoadResearchIntakeRoutingDemo();
    }
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
          onClick={loadResearchIntakeRoutingDemo}
          className="node-palette__demo-button"
        >
          <RobotIcon aria-hidden="true" size={15} weight="duotone" />
          Load Research Intake Routing
        </button>
        <p>Requires confirmation and replaces this canvas. One Undo restores your workflow.</p>
        <button
          type="button"
          disabled={disabled}
          onClick={loadResearchSupervisorDemo}
          className="node-palette__demo-button"
        >
          <RobotIcon aria-hidden="true" size={15} weight="duotone" />
          Load Research Supervisor demo
        </button>
        <p>Requires confirmation and replaces this canvas. One Undo restores your workflow.</p>
      </div>
      <p className="node-palette__keys">Keys: ⌘/Ctrl Z undo · D duplicate · Delete remove</p>
    </aside>
  );
}

export function readDroppedPaletteKind(event: DragEvent<HTMLDivElement>): PalettePayloadKind | null {
  const payload = event.dataTransfer.getData('application/graphcontract-node');
  return normalizePalettePreset(payload) ? (payload as PalettePayloadKind) : null;
}
