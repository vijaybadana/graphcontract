import { DragEvent } from 'react';

import { GraphProposal, NodeKind, nodeKinds, WorkflowGraph } from '@/src/domain';
import { PanelCollapseButton } from '@/src/features/workspace/panel-collapse-control';

const palette: Array<{ kind: NodeKind; label: string; color: string }> = [
  { kind: 'start', label: 'Start', color: 'bg-emerald-500' },
  { kind: 'agent', label: 'Agent', color: 'bg-[#d79049]' },
  { kind: 'action', label: 'Action / function', color: 'bg-violet-500' },
  { kind: 'tool', label: 'Tool', color: 'bg-sky-500' },
  { kind: 'human_input', label: 'Human Input', color: 'bg-rose-500' },
  { kind: 'end', label: 'End', color: 'bg-zinc-700' },
];

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
  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
    event.dataTransfer.setData('application/graphcontract-node', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="workspace-panel relative z-20 m-3 w-[210px] shrink-0 self-start p-3">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Node palette</p>
        <div className="flex items-center gap-2">
          <span className={`health-dot ${proposal?.status === 'pending' || !validationIssueCount ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <PanelCollapseButton
            side="left"
            onCollapse={onCollapse}
            label="Collapse node palette"
          />
        </div>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-black/45">
        {proposal
          ? 'Palette locked while a proposal awaits review. Approve or reject it to continue editing.'
          : graph.status === 'frozen'
            ? 'Palette locked while the contract is frozen.'
            : 'Drag onto the canvas or click to add.'}
      </p>
      <div className="mt-3 grid gap-1.5">
        {palette.map((item) => {
          const singletonExists =
            (item.kind === 'start' || item.kind === 'end') &&
            graph.nodes.some((node) => node.kind === item.kind);
          return (
            <button
              key={item.kind}
              draggable={!disabled && !singletonExists}
              disabled={disabled || singletonExists}
              onDragStart={(event) => onDragStart(event, item.kind)}
              onClick={() => onAdd(item.kind)}
              className="palette-button"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-xl bg-[#18211d] p-3 text-white">
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">Contract health</p>
        <p className="mt-1 text-xs font-semibold">
          {getContractHealthLabel(graph, proposal, validationIssueCount)}
        </p>
      </div>
      <p className="mt-3 text-[9px] leading-4 text-black/40">
        Keys: ⌘/Ctrl Z undo · D duplicate · Delete remove
      </p>
    </aside>
  );
}

export function readDroppedNodeKind(event: DragEvent<HTMLDivElement>): NodeKind | null {
  const kind = event.dataTransfer.getData('application/graphcontract-node') as NodeKind;
  return nodeKinds.includes(kind) ? kind : null;
}
