'use client';

import { ArrowLeftIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';

import {
  accessibleComparisonValue,
  changedValueRows,
  type ProposalReviewEntry,
} from '@/src/features/proposals/proposal-overview';

import './proposal-change-inspector.css';

const stateLabel = (state: ProposalReviewEntry['entry']['state']) =>
  state.charAt(0).toUpperCase() + state.slice(1);

export function ProposalChangeInspector({
  reviewEntry,
  totalChanges,
  onBack,
  onPrevious,
  onNext,
}: {
  reviewEntry: ProposalReviewEntry;
  totalChanges: number;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { entry } = reviewEntry;
  const changeNumber = reviewEntry.changeIndex === null ? null : reviewEntry.changeIndex + 1;

  useEffect(() => {
    headingRef.current?.focus();
  }, [reviewEntry.key]);

  return (
    <section className="proposal-change-inspector" aria-labelledby="proposal-change-inspector-title">
      <header className="proposal-change-inspector__header">
        <button type="button" className="proposal-change-inspector__back" onClick={onBack}>
          <ArrowLeftIcon size={14} weight="bold" aria-hidden="true" />
          Back to proposal
        </button>
        {changeNumber !== null && <span aria-live="polite">Change {changeNumber} of {totalChanges}</span>}
      </header>

      <div className="proposal-change-inspector__title-row">
        <div>
          <span className="proposal-change-inspector__section">{reviewEntry.sectionLabel}</span>
          <h3 id="proposal-change-inspector-title" ref={headingRef} tabIndex={-1}>{entry.id}</h3>
        </div>
        <span className="proposal-change-inspector__status" data-diff-state={entry.state}>{stateLabel(entry.state)}</span>
      </div>

      {changeNumber !== null && (
        <div className="proposal-change-inspector__navigation" aria-label="Proposal change navigation">
          <button type="button" className="secondary-button" onClick={onPrevious} disabled={changeNumber === 1} aria-label="Previous change">
            <CaretLeftIcon size={14} weight="bold" aria-hidden="true" /> Previous
          </button>
          <button type="button" className="secondary-button" onClick={onNext} disabled={changeNumber === totalChanges} aria-label="Next change">
            Next <CaretRightIcon size={14} weight="bold" aria-hidden="true" />
          </button>
        </div>
      )}

      {entry.state !== 'unchanged' && (
        <section className="proposal-change-inspector__changes" aria-labelledby="proposal-changed-values-title">
          <h4 id="proposal-changed-values-title">Changed values</h4>
          <dl aria-label={`Changed fields for ${entry.id}`}>
            {changedValueRows(entry).map((row) => (
              <div key={row.path}>
                <dt>{row.path === '*' ? 'Value' : row.path}</dt>
                {entry.state === 'added' ? (
                  <dd aria-label={`Added: ${row.after}`}><span>Added</span><span>{row.after}</span></dd>
                ) : entry.state === 'removed' ? (
                  <dd aria-label={`Before: ${row.before}. Removed`}><span>{row.before}</span><span>Removed</span></dd>
                ) : (
                  <dd aria-label={`Before: ${row.before}. After: ${row.after}`}><span>{row.before}</span><span aria-hidden="true">→</span><span>{row.after}</span></dd>
                )}
              </div>
            ))}
          </dl>
        </section>
      )}

      <details className="proposal-change-inspector__all-details">
        <summary>All details</summary>
        <dl>
          <div><dt>Before</dt><dd>{accessibleComparisonValue(entry.before)}</dd></div>
          <div><dt>After</dt><dd>{accessibleComparisonValue(entry.after)}</dd></div>
        </dl>
      </details>
    </section>
  );
}
