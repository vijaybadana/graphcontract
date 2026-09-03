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
  // Two endpoint chips plus one bounded summary fit every supported inspector
  // width. The policy is intentionally independent of labels and path length
  // so every collapsed scenario renders identically and deterministically.
  const collapsed = !expanded && items.length > 2;
  const hiddenCount = Math.max(0, items.length - 2);
  const visible = collapsed
    ? [items[0], items.at(-1)!]
    : items;

  return (
    <ol className={`mode-path-strip ${expanded ? 'is-expanded' : ''}`} aria-label={items.map((item) => item.label).join(' to ')}>
      {visible.map((item, index) => {
        const insertOverflow = collapsed && index === 1;
        return (
          <li key={`${item.id}:${index}`}>
            {insertOverflow && (
              <>
                <ArrowRightIcon className="mode-path-strip__arrow" size={12} aria-hidden="true" />
                <span
                  className="mode-path-strip__overflow"
                  aria-label={`${hiddenCount} intermediate path steps hidden`}
                  title={`${hiddenCount} intermediate path steps hidden`}
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
                <ArrowRightIcon className="mode-path-strip__arrow" size={12} aria-hidden="true" />
              </>
            )}
            {index > 0 && !insertOverflow && <ArrowRightIcon className="mode-path-strip__arrow" size={12} aria-hidden="true" />}
            <span className="mode-path-strip__node" data-path-tone={item.tone} title={item.label}>
              {item.icon}
              <span>{item.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
