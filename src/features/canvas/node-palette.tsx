import { DragEvent } from 'react';

import { NodeKind, nodeKinds, WorkflowGraph } from '@/src/domain';

const palette: Array<{ kind: NodeKind; label: string; color: string }> = [
  { kind: 'start', label: 'Start', color: 'bg-emerald-500' },
  { kind: 'agent', label: 'Agent', color: 'bg-[#d79049]' },
  { kind: 'action', label: 'Action / function', color: 'bg-violet-500' },
  { kind: 'tool', label: 'Tool', color: 'bg-sky-500' },
  { kind: 'human_input', label: 'Human Input', color: 'bg-rose-500' },
  { kind: 'end', label: 'End', color: 'bg-zinc-700' },
];

export function NodePalette({
  graph,
  disabled,
  validationIssueCount,
  onAdd,
}: {
  graph: WorkflowGraph;
  disabled: boolean;
  validationIssueCount: number;
  onAdd: (kind: NodeKind) => void;
}) {
  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
    event.dataTransfer.setData('application/graphcontract-node', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="workspace-panel absolute left-3 top-3 z-20 w-[210px] p-3">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Node palette</p>
        <span className={`health-dot ${validationIssueCount ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      </div>
      <p className="mt-1 text-[10px] leading-4 text-black/45">Drag onto the canvas or click to add.</p>
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
          {validationIssueCount ? `${validationIssueCount} issue${validationIssueCount === 1 ? '' : 's'}` : 'Ready to freeze'}
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
