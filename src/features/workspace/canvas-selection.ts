import { domainEdgeIdsForCanvasEdge } from '@/src/adapters/react-flow/project-graph';
import type { CanvasFlowEdge } from '@/src/adapters/react-flow/project-graph';
import type { CanvasFlowNode } from '@/src/features/canvas/canvas-node';
import type { WorkspaceSelection } from '@/src/state/workspace-store';

/** Converts React Flow's transient selection into the canonical workspace
 * selection without changing membership or removing multi-selected elements. */
export function workspaceSelectionFromCanvas(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  currentPrimary: WorkspaceSelection['primary'],
): WorkspaceSelection {
  const nodeIds = nodes
    .filter((node) => node.type === 'contractNode')
    .map((node) => node.id)
    .sort();
  const subgraphIds = nodes
    .filter((node) => node.type === 'subgraph')
    .map((node) => node.id)
    .sort();
  const edgeIds = [...new Set(edges.flatMap(domainEdgeIdsForCanvasEdge))].sort();
  const currentPrimaryStillSelected = currentPrimary
    ? currentPrimary.type === 'node'
      ? nodeIds.includes(currentPrimary.id)
      : currentPrimary.type === 'subgraph'
        ? subgraphIds.includes(currentPrimary.id)
        : edgeIds.includes(currentPrimary.id)
    : false;
  const primary = currentPrimaryStillSelected
    ? currentPrimary
    : nodeIds.length
      ? { type: 'node' as const, id: nodeIds[nodeIds.length - 1] }
      : subgraphIds.length
        ? { type: 'subgraph' as const, id: subgraphIds[subgraphIds.length - 1] }
        : edgeIds.length
          ? { type: 'edge' as const, id: edgeIds[edgeIds.length - 1] }
          : null;
  return { nodeIds, subgraphIds, edgeIds, primary };
}
