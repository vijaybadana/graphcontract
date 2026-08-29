export type CanvasPosition = { x: number; y: number };

export type CanvasNodeBox = {
  id: string;
  position: CanvasPosition;
  hidden?: boolean;
  width?: number;
  height?: number;
  initialWidth?: number;
  initialHeight?: number;
  measured?: { width?: number; height?: number };
};

export type AlignmentGuides = {
  horizontal?: number;
  vertical?: number;
};

export type AlignmentSnapResult = {
  position: CanvasPosition;
  guides: AlignmentGuides;
  collidingNodeIds: string[];
};

const DEFAULT_NODE_WIDTH = 184;
const DEFAULT_NODE_HEIGHT = 114;

const dimensionsOf = (node: CanvasNodeBox) => ({
  width: node.measured?.width ?? node.width ?? node.initialWidth ?? DEFAULT_NODE_WIDTH,
  height: node.measured?.height ?? node.height ?? node.initialHeight ?? DEFAULT_NODE_HEIGHT,
});

const anchors = (origin: number, size: number) => [
  { coordinate: origin + size / 2, offset: size / 2 },
  { coordinate: origin, offset: 0 },
  { coordinate: origin + size, offset: size },
];

function closestAlignment(
  movingOrigin: number,
  movingSize: number,
  candidates: Array<{ origin: number; size: number }>,
  threshold: number,
) {
  let closest: { delta: number; guide: number } | undefined;
  for (const moving of anchors(movingOrigin, movingSize)) {
    for (const candidate of candidates) {
      for (const target of anchors(candidate.origin, candidate.size)) {
        const delta = target.coordinate - moving.coordinate;
        if (Math.abs(delta) > threshold) continue;
        if (!closest || Math.abs(delta) < Math.abs(closest.delta)) {
          closest = { delta, guide: target.coordinate };
        }
      }
    }
  }
  return closest;
}

function intersects(left: CanvasNodeBox, right: CanvasNodeBox) {
  const leftSize = dimensionsOf(left);
  const rightSize = dimensionsOf(right);
  return (
    left.position.x < right.position.x + rightSize.width &&
    left.position.x + leftSize.width > right.position.x &&
    left.position.y < right.position.y + rightSize.height &&
    left.position.y + leftSize.height > right.position.y
  );
}

export function snapNodeToAlignment(
  movingNode: CanvasNodeBox,
  nodes: CanvasNodeBox[],
  threshold = 8,
  ignoredNodeIds: ReadonlySet<string> = new Set(),
): AlignmentSnapResult {
  const others = nodes.filter(
    (node) => !node.hidden && node.id !== movingNode.id && !ignoredNodeIds.has(node.id),
  );
  const movingSize = dimensionsOf(movingNode);
  const xAlignment = closestAlignment(
    movingNode.position.x,
    movingSize.width,
    others.map((node) => ({ origin: node.position.x, size: dimensionsOf(node).width })),
    threshold,
  );
  const yAlignment = closestAlignment(
    movingNode.position.y,
    movingSize.height,
    others.map((node) => ({ origin: node.position.y, size: dimensionsOf(node).height })),
    threshold,
  );
  const snappedNode = {
    ...movingNode,
    position: {
      x: movingNode.position.x + (xAlignment?.delta ?? 0),
      y: movingNode.position.y + (yAlignment?.delta ?? 0),
    },
  };

  return {
    position: snappedNode.position,
    guides: {
      vertical: xAlignment?.guide,
      horizontal: yAlignment?.guide,
    },
    collidingNodeIds: others
      .filter((node) => intersects(snappedNode, node))
      .map((node) => node.id),
  };
}
