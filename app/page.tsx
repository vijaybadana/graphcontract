'use client';

import { ReactFlowProvider } from '@xyflow/react';

import { GraphWorkspace } from '@/src/features/workspace/graph-workspace';

export default function Home() {
  return (
    <ReactFlowProvider>
      <GraphWorkspace />
    </ReactFlowProvider>
  );
}
