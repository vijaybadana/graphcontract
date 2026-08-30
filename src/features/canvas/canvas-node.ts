import type { ContractFlowNode } from './contract-node';
import type { MergeFlowNode } from './merge-node';
import type { RuntimeInstanceFlowNode } from './runtime-instance-node';
import type { SubgraphFlowNode } from './subgraph-node';

/** Every node the graph canvas may receive from its canonical projection. */
export type CanvasFlowNode = ContractFlowNode | MergeFlowNode | RuntimeInstanceFlowNode | SubgraphFlowNode;
