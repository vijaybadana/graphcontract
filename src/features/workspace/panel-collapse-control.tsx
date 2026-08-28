'use client';

type PanelSide = 'left' | 'right';

const arrowFor = (side: PanelSide, action: 'collapse' | 'expand') => {
  const pointsLeft = (side === 'left' && action === 'collapse') ||
    (side === 'right' && action === 'expand');
  return pointsLeft ? '‹' : '›';
};

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
      <span aria-hidden="true">{arrowFor(side, 'collapse')}</span>
    </button>
  );
}

export function CollapsedPanelRail({
  side,
  onExpand,
  label,
}: {
  side: PanelSide;
  onExpand: () => void;
  label: string;
}) {
  return (
    <aside
      className={`workspace-panel collapsed-panel-rail relative z-20 my-3 shrink-0 ${
        side === 'left' ? 'ml-3 mr-0' : 'ml-0 mr-3'
      }`}
    >
      <button
        type="button"
        onClick={onExpand}
        aria-label={`Open ${label}`}
        title={`Open ${label}`}
        className="collapsed-panel-rail__button"
      >
        <span className="text-lg" aria-hidden="true">
          {arrowFor(side, 'expand')}
        </span>
        <span className="collapsed-panel-rail__label">{label}</span>
      </button>
    </aside>
  );
}
