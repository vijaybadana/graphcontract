'use client';

import { Handle, Node, NodeProps, Position } from '@xyflow/react';

import { GraphNode } from '@/src/domain';
import { ContractNodeToolbar } from './contract-node-toolbar';

export type ContractNodeData = GraphNode & {
  [key: string]: unknown;
  proposalState?: 'added' | 'updated' | 'removed';
};

export type ContractFlowNode = Node<ContractNodeData, 'contractNode'>;

const colors: Record<GraphNode['kind'], string> = {
  start: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  agent: 'border-[#d79049] bg-[#fff8ee] text-[#3d2816]',
  action: 'border-violet-400 bg-violet-50 text-violet-950',
  tool: 'border-sky-400 bg-sky-50 text-sky-950',
  human_input: 'border-rose-400 bg-rose-50 text-rose-950',
  end: 'border-zinc-600 bg-zinc-50 text-zinc-950',
};

const kindLabel: Record<GraphNode['kind'], string> = {
  start: 'Start',
  agent: 'Agent',
  action: 'Action',
  tool: 'Tool',
  human_input: 'Human input',
  end: 'End',
};

export function ContractNode({ data, selected }: NodeProps<ContractFlowNode>) {
  const proposalClass =
    data.proposalState === 'added'
      ? 'ring-4 ring-emerald-300/70'
      : data.proposalState === 'updated'
        ? 'ring-4 ring-amber-300/70'
        : data.proposalState === 'removed'
          ? 'opacity-55 ring-4 ring-rose-300/70 line-through'
          : '';

  return (
    <>
      <ContractNodeToolbar node={data} selected={selected} />
      <div
        className={`contract-node-shell h-[104px] w-44 rounded-2xl border-2 px-4 py-3 shadow-md transition-[background-color,border-color,box-shadow,opacity,transform] ${colors[data.kind]} ${
          selected ? 'ring-4 ring-black/10' : ''
        } ${proposalClass}`}
      >
        {data.kind !== 'start' && (
          <Handle
            type="target"
            position={Position.Left}
            className="!h-3 !w-3 !border-2 !border-white !bg-[#18211d]"
          />
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] opacity-55">
              {kindLabel[data.kind]}
            </p>
            <p className="mt-1 line-clamp-2 max-w-36 text-sm font-semibold leading-5">
              {data.label}
            </p>
          </div>
          {data.hitl?.enabled && (
            <span
              title={`Human input ${data.hitl.timing ?? 'before'} · ${data.hitl.inputType ?? 'approval'}`}
              className="rounded-full border border-current/20 bg-white/80 px-1.5 py-1 text-[10px] font-bold"
            >
              HITL
            </span>
          )}
        </div>
        {data.proposalState && (
          <p className="mt-2 text-[9px] font-extrabold uppercase tracking-wider">
            Proposed {data.proposalState}
          </p>
        )}
        {data.kind !== 'end' && (
          <Handle
            type="source"
            position={Position.Right}
            className="!h-3 !w-3 !border-2 !border-white !bg-[#18211d]"
          />
        )}
      </div>
    </>
  );
}
