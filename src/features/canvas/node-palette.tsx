'use client';

import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShareNetworkIcon } from '@phosphor-icons/react';

import type { NodeCreationPreset } from '@/src/application/workspace';
import { GraphProposal, WorkflowGraph } from '@/src/domain';
import { PanelCollapseButton } from '@/src/features/workspace/panel-collapse-control';
import { NodeVisualIcon, type NodeVisualKind } from './node-visual-taxonomy';

import './node-palette.css';

/** Matches the application creation API; work presets create canonical Steps. */
export type PaletteKind = NodeCreationPreset | 'subgraph';
/** Existing drag payloads used `human_input`; accept it at the UI boundary
 * while keeping the canonical creation preset named `humanReview`. */
export type PalettePayloadKind = PaletteKind | 'human_input';
export type PaletteItem = {
  kind: PaletteKind;
  label: string;
  group: 'Flow' | 'Execution' | 'Structure';
};

export type ConnectionReference = {
  id: 'edge' | 'conditional' | 'command' | 'fallback' | 'send' | 'loop';
  label: string;
  explanation: string;
  derived?: boolean;
};

export const paletteItems: readonly PaletteItem[] = [
  { kind: 'start', label: 'Start', group: 'Flow' },
  { kind: 'merge', label: 'Merge', group: 'Flow' },
  { kind: 'end', label: 'End', group: 'Flow' },
  { kind: 'step', label: 'Task', group: 'Execution' },
  { kind: 'agent', label: 'Agent', group: 'Execution' },
  { kind: 'tool', label: 'Tool', group: 'Execution' },
  { kind: 'humanReview', label: 'Human', group: 'Execution' },
  { kind: 'subgraph', label: 'Subgraph', group: 'Structure' },
];

export const connectionReferences: readonly ConnectionReference[] = [
  { id: 'edge', label: 'Edge', explanation: 'A standard directed connection between two nodes.' },
  { id: 'conditional', label: 'Conditional', explanation: 'Follows this route when its condition matches.' },
  { id: 'command', label: 'Command', explanation: 'An agent-directed jump or handoff to another node.' },
  { id: 'fallback', label: 'Fallback', explanation: 'Used when the primary route cannot continue.' },
  { id: 'send', label: 'Send ×N', explanation: 'Dynamically fans work out to one template and rejoins at Merge.' },
  {
    id: 'loop',
    label: 'Loop ↺',
    explanation: 'Derived when a connection creates a cycle to an upstream node; an optional loop cap limits repetitions.',
    derived: true,
  },
];

/** One boundary for palette clicks and drag payloads. The palette retains its
 * authored payload, while every work alias converges on a canonical preset.
 * Action remains accepted for historical/internal drag payloads even though it
 * is intentionally no longer a visible inventory item. */
const acceptedPalettePresets: readonly PaletteKind[] = [
  ...paletteItems.map((item) => item.kind),
  'action',
];

export function normalizePalettePreset(payload: string): PaletteKind | null {
  const kind = payload === 'human_input' ? 'humanReview' : payload;
  return acceptedPalettePresets.includes(kind as PaletteKind) ? (kind as PaletteKind) : null;
}

const groups: PaletteItem['group'][] = ['Flow', 'Execution', 'Structure'];

export function filterPaletteItems(query: string): PaletteItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return paletteItems.filter((item) => item.label.toLowerCase().includes(normalizedQuery));
}

export function filterConnectionReferences(query: string): ConnectionReference[] {
  const normalizedQuery = query.trim().toLowerCase();
  return connectionReferences.filter((reference) => reference.label.toLowerCase().includes(normalizedQuery));
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

function paletteVisualKind(kind: PaletteKind): NodeVisualKind {
  switch (kind) {
    case 'start': return 'start';
    case 'merge': return 'merge';
    case 'end': return 'end';
    case 'subgraph': return 'subgraph';
    case 'step':
    case 'action': return 'task';
    case 'agent': return 'agent';
    case 'tool': return 'tool';
    case 'humanReview': return 'human';
  }
}

function ConnectionReferenceRow({ reference }: { reference: ConnectionReference }) {
  const rowRef = useRef<HTMLLIElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const tooltipId = `connection-reference-${reference.id}-description`;

  const positionTooltip = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const bounds = row.getBoundingClientRect();
    const tooltipWidth = 224;
    const gap = 8;
    const left = bounds.right + gap + tooltipWidth <= window.innerWidth - gap
      ? bounds.right + gap
      : Math.max(gap, bounds.left - tooltipWidth - gap);
    setTooltipPosition({ left, top: bounds.top + bounds.height / 2 });
  }, []);

  useEffect(() => {
    if (!tooltipPosition) return;
    window.addEventListener('resize', positionTooltip);
    window.addEventListener('scroll', positionTooltip, true);
    return () => {
      window.removeEventListener('resize', positionTooltip);
      window.removeEventListener('scroll', positionTooltip, true);
    };
  }, [positionTooltip, tooltipPosition]);

  return (
    <>
      <li
        ref={rowRef}
        className="node-palette__item-row node-palette__reference-row"
        tabIndex={0}
        aria-label={reference.label}
        aria-describedby={tooltipPosition ? tooltipId : undefined}
        onMouseEnter={positionTooltip}
        onMouseLeave={() => setTooltipPosition(null)}
        onFocus={positionTooltip}
        onBlur={() => setTooltipPosition(null)}
      >
        <span className={`node-palette__item-icon node-palette__reference-icon node-palette__reference-icon--${reference.id}`} aria-hidden="true">
          {reference.id === 'send'
            ? <ShareNetworkIcon size={16} weight="bold" aria-hidden="true" />
            : <span className={`node-palette__connection-cue node-palette__connection-cue--${reference.id}`} aria-hidden="true" />}
        </span>
        <span className="node-palette__item-label">{reference.label}</span>
      </li>
      {tooltipPosition && typeof document !== 'undefined' && createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          className="node-palette__reference-tooltip"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        >
          {reference.explanation}
        </span>,
        document.body,
      )}
    </>
  );
}

type NodePaletteProps = {
  graph: WorkflowGraph;
  disabled: boolean;
  readOnlyReason?: string;
  proposal: GraphProposal | null;
  onAdd: (kind: PaletteKind) => void;
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
  readOnlyReason,
  proposal,
  onAdd,
  onCollapse,
}: NodePaletteProps) {
  const [query, setQuery] = useState('');

  const visiblePalette = useMemo(() => filterPaletteItems(query), [query]);
  const visibleReferences = useMemo(() => filterConnectionReferences(query), [query]);
  const lockedMessage = readOnlyReason ?? (proposal
    ? 'Palette locked while a proposal awaits review. Approve or reject it to continue editing.'
    : graph.status === 'frozen'
      ? 'Palette locked while the contract is frozen.'
      : null);

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: PaletteKind) => {
    event.dataTransfer.setData('application/graphcontract-node', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="workspace-panel node-palette absolute left-3 top-3 z-30 max-h-[calc(100%-1.5rem)] w-[232px] overflow-y-auto p-3">
      <div className="node-palette__toolbar">
        <div className="node-palette__search">
          <label className="sr-only" htmlFor="node-palette-search">Search components</label>
          <input id="node-palette-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components" autoComplete="off" />
        </div>
        <PanelCollapseButton
          side="left"
          onCollapse={onCollapse}
          label="Collapse node palette"
        />
      </div>
      {lockedMessage && <p className="node-palette__lock-notice" role="status">{lockedMessage}</p>}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {visiblePalette.length} {visiblePalette.length === 1 ? 'component' : 'components'} and{' '}
        {visibleReferences.length} {visibleReferences.length === 1 ? 'reference' : 'references'} shown
      </p>
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
                  const visualKind = paletteVisualKind(item.kind);
                  return (
                    <button key={item.kind} type="button" draggable={!disabled && !singletonExists} disabled={disabled || singletonExists} onDragStart={(event) => onDragStart(event, item.kind)} onClick={() => onAdd(item.kind)} className="node-palette__item-row node-palette__row">
                      <span className={`node-palette__item-icon node-palette__icon node-palette__icon--${item.kind}`} data-node-visual={visualKind}><NodeVisualIcon kind={visualKind} /></span>
                      <span className="node-palette__item-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!!visibleReferences.length && (
          <section className="node-palette__group node-palette__reference" aria-label="Connections reference">
            <p className="node-palette__group-label">Connections</p>
            <ul className="node-palette__rows node-palette__reference-rows">
              {visibleReferences.map((reference) => <ConnectionReferenceRow key={reference.id} reference={reference} />)}
            </ul>
          </section>
        )}
        {!visiblePalette.length && !visibleReferences.length && <p className="node-palette__empty" role="status">No components or references match “{query.trim()}”.</p>}
      </div>
    </aside>
  );
}

export function readDroppedPaletteKind(event: DragEvent<HTMLDivElement>): PalettePayloadKind | null {
  const payload = event.dataTransfer.getData('application/graphcontract-node');
  return normalizePalettePreset(payload) ? (payload as PalettePayloadKind) : null;
}
