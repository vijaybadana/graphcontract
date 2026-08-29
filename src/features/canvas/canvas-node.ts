import type { ContractFlowNode } from './contract-node';
import type { SubgraphFlowNode } from './subgraph-node';

/** Every node the graph canvas may receive from its canonical projection. */
export type CanvasFlowNode = ContractFlowNode | SubgraphFlowNode;
