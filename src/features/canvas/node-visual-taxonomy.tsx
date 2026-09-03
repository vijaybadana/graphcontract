import {
  ArrowsInIcon,
  FlagCheckeredIcon,
  HandIcon,
  LightningIcon,
  PlayCircleIcon,
  RobotIcon,
  StackIcon,
  WrenchIcon,
  type IconWeight,
} from '@phosphor-icons/react';

import type { GraphNode } from '@/src/domain';

export type NodeVisualKind =
  | 'start'
  | 'merge'
  | 'end'
  | 'task'
  | 'agent'
  | 'tool'
  | 'human'
  | 'subgraph';

export const nodeVisualLabels: Record<NodeVisualKind, string> = {
  start: 'Start',
  merge: 'Merge',
  end: 'End',
  task: 'Task',
  agent: 'Agent',
  tool: 'Tool',
  human: 'Human',
  subgraph: 'Subgraph',
};

export function graphNodeVisualKind(node: GraphNode): Exclude<NodeVisualKind, 'subgraph'> {
  if (node.kind !== 'step') return node.kind;
  switch (node.executor) {
    case 'ai': return 'agent';
    case 'tool': return 'tool';
    case 'human': return 'human';
    case 'deterministic': return 'task';
  }
}

export function NodeVisualIcon({
  kind,
  size = 16,
  weight = 'duotone',
}: {
  kind: NodeVisualKind;
  size?: number;
  weight?: IconWeight;
}) {
  const props = { 'aria-hidden': true, size, weight } as const;
  switch (kind) {
    case 'start': return <PlayCircleIcon {...props} />;
    case 'merge': return <ArrowsInIcon {...props} />;
    case 'end': return <FlagCheckeredIcon {...props} />;
    case 'task': return <LightningIcon {...props} />;
    case 'agent': return <RobotIcon {...props} />;
    case 'tool': return <WrenchIcon {...props} />;
    case 'human': return <HandIcon {...props} />;
    case 'subgraph': return <StackIcon {...props} />;
  }
}
