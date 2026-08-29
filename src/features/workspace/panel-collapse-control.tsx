'use client';

import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

type PanelSide = 'left' | 'right';

function DirectionalCaret({
  side,
  action,
  size,
}: {
  side: PanelSide;
  action: 'collapse' | 'expand';
  size: number;
}) {
  const pointsLeft = (side === 'left' && action === 'collapse') ||
    (side === 'right' && action === 'expand');

  return pointsLeft
    ? <CaretLeftIcon aria-hidden="true" size={size} weight="bold" />
    : <CaretRightIcon aria-hidden="true" size={size} weight="bold" />;
}

export function PanelCollapseButton({
  side,
  onCollapse,
  label,
}: {
  side: PanelSide;
  onCollapse: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onCollapse}
      aria-label={label}
      title={label}
      className="panel-collapse-button"
    >
      <DirectionalCaret side={side} action="collapse" size={16} />
    </button>
  );
}

export function PanelExpandButton({
  side,
  onExpand,
  label,
}: {
  side: PanelSide;
  onExpand: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={`Open ${label}`}
      title={`Open ${label}`}
      className={`workspace-panel collapsed-panel-trigger panel-trigger-${side} absolute top-3 z-30 ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      <DirectionalCaret side={side} action="expand" size={18} />
    </button>
  );
}
