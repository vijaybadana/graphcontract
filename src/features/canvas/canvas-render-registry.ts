'use client';

import { CONTRACT_NODE_HEIGHT, CONTRACT_NODE_WIDTH } from '@/src/application/canvas-geometry';
import {
  CANVAS_INPUT_PORT_ID,
  CANVAS_OUTPUT_PORT_ID,
} from '@/src/application/layout-workflow';

import { ContractNode } from './contract-node';
import { DynamicWorkerGroup } from './dynamic-worker-group';
import { ExternalSystemTile } from './external-system-tile';
import { MergeNode } from './merge-node';
import { RoutingEdge } from './routing-edge';
import { RuntimeInstanceNode } from './runtime-instance-node';
import { SubgraphNode } from './subgraph-node';
import { SystemRelationshipEdge } from './system-relationship-edge';

export type CanvasRenderDimensions = Readonly<{ width: number; height: number }>;
export type CanvasRenderPorts = Readonly<{
  input: typeof CANVAS_INPUT_PORT_ID;
  output: typeof CANVAS_OUTPUT_PORT_ID;
}>;

const STANDARD_PORTS: CanvasRenderPorts = Object.freeze({
  input: CANVAS_INPUT_PORT_ID,
  output: CANVAS_OUTPUT_PORT_ID,
});

/**
 * The one render-time inventory for every React Flow node. These dimensions
 * are presentation baselines only: expanded subgraphs and declared dynamic
 * templates retain their canonical authored dimensions in the projection.
 */
export const canvasNodeRenderers = Object.freeze({
  contractNode: Object.freeze({
    component: ContractNode,
    dimensions: Object.freeze({ width: CONTRACT_NODE_WIDTH, height: CONTRACT_NODE_HEIGHT }),
    ports: STANDARD_PORTS,
  }),
  mergeJunction: Object.freeze({
    component: MergeNode,
    dimensions: Object.freeze({ width: CONTRACT_NODE_WIDTH, height: CONTRACT_NODE_HEIGHT }),
    ports: STANDARD_PORTS,
  }),
  subgraph: Object.freeze({
    component: SubgraphNode,
    dimensions: Object.freeze({ width: CONTRACT_NODE_WIDTH, height: CONTRACT_NODE_HEIGHT }),
    ports: STANDARD_PORTS,
  }),
  runtimeInstance: Object.freeze({
    component: RuntimeInstanceNode,
    dimensions: Object.freeze({ width: 188, height: 58 }),
    ports: STANDARD_PORTS,
  }),
  externalSystemTile: Object.freeze({
    component: ExternalSystemTile,
    dimensions: Object.freeze({ width: 192, height: 72 }),
    ports: STANDARD_PORTS,
  }),
  dynamicWorkerGroup: Object.freeze({
    component: DynamicWorkerGroup,
    dimensions: Object.freeze({ width: 288, height: 232 }),
    ports: STANDARD_PORTS,
  }),
});

export type CanvasNodeRenderType = keyof typeof canvasNodeRenderers;

/** React Flow receives this map directly; do not recreate component maps in workspace consumers. */
export const canvasNodeTypes = Object.freeze(Object.fromEntries(
  Object.entries(canvasNodeRenderers).map(([type, renderer]) => [type, renderer.component]),
));

/** Non-native relationship lines have their own renderer but share the same registration seam. */
export const canvasEdgeRenderers = Object.freeze({
  routing: Object.freeze({ component: RoutingEdge }),
  systemRelationship: Object.freeze({ component: SystemRelationshipEdge }),
});

export const canvasEdgeTypes = Object.freeze(Object.fromEntries(
  Object.entries(canvasEdgeRenderers).map(([type, renderer]) => [type, renderer.component]),
));

export const canvasNodeRenderer = (type: CanvasNodeRenderType) => canvasNodeRenderers[type];
export { CANVAS_INPUT_PORT_ID, CANVAS_OUTPUT_PORT_ID };
