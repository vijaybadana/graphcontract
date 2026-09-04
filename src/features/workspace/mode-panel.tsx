'use client';

import { ArrowRightIcon, CaretRightIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

import './mode-panel.css';

export type ModePathItem = {
  id: string;
  label: string;
  icon: ReactNode;
  tone?: string;
};

export function ModePanelShell({
  title,
  icon,
  tone,
  badge,
  action,
  onCollapse,
  children,
  footer,
}: {
  title: string;
  icon: ReactNode;
  tone: 'proposal' | 'scenario' | 'runtime';
  badge?: ReactNode;
  action?: ReactNode;
  onCollapse: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="mode-panel" data-mode-panel={tone} aria-label={`${title} panel`}>
      <header className="mode-panel__header">
        <span className="mode-panel__icon" data-mode-panel-tone={tone} aria-hidden="true">{icon}</span>
        <h2>{title}</h2>
        {badge && <span className="mode-panel__badge">{badge}</span>}
        <div className="mode-panel__header-actions">
          {action}
          <button type="button" className="mode-panel__collapse" onClick={onCollapse} aria-label={`Collapse ${title.toLowerCase()} panel`}>
            <CaretRightIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="mode-panel__body">{children}</div>
      {footer && <footer className="mode-panel__footer">{footer}</footer>}
    </section>
  );
}

export function ModePathStrip({
  items,
  expanded = false,
  loopCount = 0,
}: {
  items: readonly ModePathItem[];
  expanded?: boolean;
  loopCount?: number;
}) {
  // Keep two real intermediate steps visible in the compact summary. The
  // terminal outcome is already named in the scenario-row heading, so the
  // remaining route can collapse into one bounded summary without repeating
  // the end chip or forcing tokens to overlap at inspector widths.
  const collapsed = !expanded && items.length > 4;
  const hiddenCount = Math.max(0, items.length - 3);
  const visible = collapsed
    ? items.slice(0, 3)
    : items;

  return (
    <ol className={`mode-path-strip ${collapsed ? 'is-collapsed' : ''} ${expanded ? 'is-expanded' : ''}`} aria-label={items.map((item) => item.label).join(' to ')}>
      {visible.map((item, index) => {
        return (
          <li key={`${item.id}:${index}`}>
            {index > 0 && <ArrowRightIcon className="mode-path-strip__arrow" size={12} aria-hidden="true" />}
            <span className="mode-path-strip__node" data-path-tone={item.tone} title={item.label}>
              {item.icon}
              <span>{item.label}</span>
            </span>
          </li>
        );
      })}
      {collapsed && (
        <li className="mode-path-strip__summary">
          <ArrowRightIcon className="mode-path-strip__arrow" size={12} aria-hidden="true" />
          <span
            className="mode-path-strip__overflow"
            aria-label={`${hiddenCount} remaining path steps hidden`}
            title={`${hiddenCount} remaining path steps hidden`}
          >
            +{hiddenCount} more
          </span>
          {loopCount > 0 && (
            <span
              className="mode-path-strip__loop"
              aria-label={`Loop traversed ${loopCount} times`}
              title={`Loop traversed ${loopCount} times within the configured bound`}
            >
              Loop ×{loopCount}
            </span>
          )}
        </li>
      )}
    </ol>
  );
}
