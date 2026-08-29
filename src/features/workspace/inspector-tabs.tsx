'use client';

import { KeyboardEvent, useRef } from 'react';

export type InspectorTab = 'review' | 'scenarios';

const tabs: InspectorTab[] = ['review', 'scenarios'];
const tabId = (tab: InspectorTab) => `graph-inspector-${tab}-tab`;

export function InspectorTabs({
  active,
  scenarioCount,
  onChange,
}: {
  active: InspectorTab;
  scenarioCount: number;
  onChange: (tab: InspectorTab) => void;
}) {
  const reviewRef = useRef<HTMLButtonElement>(null);
  const scenariosRef = useRef<HTMLButtonElement>(null);
  const refs = { review: reviewRef, scenarios: scenariosRef };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: InspectorTab) => {
    const currentIndex = tabs.indexOf(current);
    let next: InspectorTab | undefined;
    if (event.key === 'ArrowLeft') next = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
    if (event.key === 'ArrowRight') next = tabs[(currentIndex + 1) % tabs.length];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange(next);
    requestAnimationFrame(() => refs[next].current?.focus());
  };

  return (
    <div className="workspace-inspector-tabs" role="tablist" aria-label="Inspector views">
      <button
        ref={reviewRef}
        id={tabId('review')}
        type="button"
        role="tab"
        aria-selected={active === 'review'}
        aria-controls="graph-inspector-tabpanel"
        tabIndex={active === 'review' ? 0 : -1}
        onClick={() => onChange('review')}
        onKeyDown={(event) => onKeyDown(event, 'review')}
        className={`workspace-inspector-tab ${active === 'review' ? 'is-active' : ''}`}
      >
        Edit &amp; review
      </button>
      <button
        ref={scenariosRef}
        id={tabId('scenarios')}
        type="button"
        role="tab"
        aria-selected={active === 'scenarios'}
        aria-controls="graph-inspector-tabpanel"
        tabIndex={active === 'scenarios' ? 0 : -1}
        onClick={() => onChange('scenarios')}
        onKeyDown={(event) => onKeyDown(event, 'scenarios')}
        className={`workspace-inspector-tab ${active === 'scenarios' ? 'is-active' : ''}`}
      >
        Scenarios {scenarioCount ? `(${scenarioCount})` : ''}
      </button>
    </div>
  );
}

export function activeInspectorTabId(tab: InspectorTab) {
  return tabId(tab);
}
