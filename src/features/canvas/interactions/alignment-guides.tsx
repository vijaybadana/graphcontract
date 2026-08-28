'use client';

import { ViewportPortal, useViewport } from '@xyflow/react';

import type { AlignmentGuides as AlignmentGuideState } from './canvas-geometry';

const GUIDE_EXTENT = 100_000;

export function AlignmentGuides({ guides }: { guides: AlignmentGuideState }) {
  const { zoom } = useViewport();
  if (guides.horizontal === undefined && guides.vertical === undefined) return null;

  const lineWidth = 1.5 / zoom;
  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute inset-0 z-[1000]" aria-hidden="true">
        {guides.vertical !== undefined && (
          <div
            className="canvas-alignment-guide canvas-alignment-guide--vertical"
            style={{
              left: guides.vertical - lineWidth / 2,
              top: -GUIDE_EXTENT,
              width: lineWidth,
              height: GUIDE_EXTENT * 2,
            }}
          />
        )}
        {guides.horizontal !== undefined && (
          <div
            className="canvas-alignment-guide canvas-alignment-guide--horizontal"
            style={{
              left: -GUIDE_EXTENT,
              top: guides.horizontal - lineWidth / 2,
              width: GUIDE_EXTENT * 2,
              height: lineWidth,
            }}
          />
        )}
      </div>
    </ViewportPortal>
  );
}
