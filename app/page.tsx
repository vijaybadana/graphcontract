'use client';

import { ReactFlowProvider } from '@xyflow/react';

import { GraphEditor } from '@/components/graph-editor';

export default function Home() {
  return (
    <ReactFlowProvider>
      <GraphEditor />
    </ReactFlowProvider>
  );
}
