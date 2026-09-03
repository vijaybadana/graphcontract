import { useEffect, useRef, useState } from 'react';
import { GitDiffIcon } from '@phosphor-icons/react';

import type { ProposalReview } from '@/src/application/proposal-comparison';
import type { ProposalReviewRequest, RequestChangesResult } from '@/src/application/workspace';
import type { GraphProposal } from '@/src/domain';
import { ProposalChangeInspector } from '@/src/features/proposals/proposal-change-inspector';
import {
  proposalReviewEntries,
  type ProposalReviewEntry,
  ProposalOverview,
} from '@/src/features/proposals/proposal-overview';
import { RequestChangesDialog } from '@/src/features/proposals/request-changes-dialog';
import { ModePanelShell } from '@/src/features/workspace/mode-panel';

import './proposal-panel.css';

export function ProposalPanel({
  proposal,
  review,
  reviewRequest,
  onApprove,
  onRequestChanges,
  onReject,
  onCollapse = () => {},
  activeEntryKey,
  onEntrySelect,
}: {
  proposal: GraphProposal | null;
  review: ProposalReview | null;
  reviewRequest: ProposalReviewRequest | null;
  onApprove: () => void;
  onRequestChanges: (feedback: string) => RequestChangesResult;
  onReject: () => void;
  onCollapse?: () => void;
  /** Workspace may control this for direct candidate canvas selection. */
  activeEntryKey?: string | null;
  /** Proposal-local entry descriptor for projection-only workspace focus. */
  onEntrySelect?: (entry: ProposalReviewEntry | null) => void;
}) {
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [internalActiveEntryKey, setInternalActiveEntryKey] = useState<string | null>(null);
  const [restoreFocusPending, setRestoreFocusPending] = useState(false);
  const requestChangesButtonRef = useRef<HTMLButtonElement>(null);
  const entryButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const returnFocusKeyRef = useRef<string | null>(null);
  const comparison = review?.kind === 'comparable' ? review : null;
  const changesRequested = Boolean(
    proposal && reviewRequest && proposal.id === reviewRequest.proposalId,
  );
  const status = changesRequested
    ? 'changes requested'
    : review?.kind === 'stale' ? 'stale' : comparison?.effectiveStatus;
  const issues = comparison
    ? comparison.validationErrors.length > 0
      ? comparison.validationErrors
      : comparison.declaredValidationErrors
    : [];
  const allEntries = comparison ? proposalReviewEntries(comparison, false) : [];
  const changedEntries = allEntries.filter(({ entry }) => entry.state !== 'unchanged');
  const isEntryControlled = activeEntryKey !== undefined;
  const selectedEntryKey = isEntryControlled ? activeEntryKey : internalActiveEntryKey;
  const activeEntry = selectedEntryKey
    ? allEntries.find(({ key }) => key === selectedEntryKey) ?? null
    : null;

  useEffect(() => {
    if (!restoreFocusPending || activeEntry) return;
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      const focusTarget = (returnFocusKeyRef.current
        ? entryButtonRefs.current.get(returnFocusKeyRef.current)
        : null) ?? returnFocusRef.current;
      focusTarget?.focus();
      returnFocusRef.current = null;
      returnFocusKeyRef.current = null;
      setRestoreFocusPending(false);
    });
    return () => { mounted = false; };
  }, [activeEntry, restoreFocusPending]);

  const selectEntry = (
    entry: ProposalReviewEntry | null,
    returnFocusTo?: HTMLElement | null,
    returnFocusKey?: string,
  ) => {
    if (entry && returnFocusTo) returnFocusRef.current = returnFocusTo;
    if (entry && returnFocusKey) returnFocusKeyRef.current = returnFocusKey;
    if (!isEntryControlled) setInternalActiveEntryKey(entry?.key ?? null);
    onEntrySelect?.(entry);
  };

  const returnToOverview = () => {
    const previousKey = activeEntry?.key;
    if (!returnFocusRef.current && previousKey) {
      returnFocusRef.current = entryButtonRefs.current.get(previousKey) ?? null;
    }
    if (!returnFocusKeyRef.current && previousKey) returnFocusKeyRef.current = previousKey;
    setRestoreFocusPending(true);
    selectEntry(null);
  };

  const entryForIssue = (path?: string) => {
    if (!path) return null;
    const [collection, id] = path.split('.');
    const section = collection === 'edges'
      ? 'native-edges'
      : collection === 'nodes' || collection === 'subgraphs' || collection === 'relationships'
        ? collection
        : collection === 'capabilities' ? 'capabilities' : null;
    if (!section) return null;
    const resolvedId = section === 'capabilities' ? `graph.${path.slice('capabilities.'.length)}` : id;
    return allEntries.find((entry) => entry.section === section && entry.entry.id === resolvedId) ?? null;
  };

  if (!proposal && !reviewRequest) return null;

  return (<>
    <ModePanelShell
      title="Proposal"
      icon={<GitDiffIcon size={16} weight="bold" />}
      tone="proposal"
      badge={changesRequested ? 'Changes requested' : proposal ? `${proposal.operations.length} changes` : 'Review'}
      onCollapse={onCollapse}
      footer={proposal && review && !activeEntry ? (
        <div className="proposal-panel__actions" aria-describedby="proposal-agent-rationale">
          <button disabled={changesRequested || !comparison?.approvable} onClick={onApprove} className="primary-button">Approve</button>
          <button disabled={changesRequested} ref={requestChangesButtonRef} onClick={() => setRequestChangesOpen(true)} className="secondary-button">Request changes</button>
          <button disabled={changesRequested} onClick={onReject} className="secondary-button">Reject</button>
        </div>
      ) : undefined}
    >
      <section className="proposal-panel">
      {status && <span className={`proposal-panel__status ${status === 'pending' || changesRequested ? 'is-pending' : status === 'invalid' || status === 'stale' ? 'is-danger' : 'is-neutral'}`}>{status}</span>}
      {!proposal || !review ? (
        reviewRequest ? (
          <div className="proposal-panel__notice is-warning">
            <p className="proposal-panel__notice-title">Changes requested</p>
            <p className="proposal-panel__notice-copy whitespace-pre-wrap">{reviewRequest.feedback}</p>
            <p className="proposal-panel__notice-help">Waiting for a revised agent proposal. The accepted graph is unchanged.</p>
          </div>
        ) : (
          <div className="proposal-panel__empty">
            <p className="proposal-panel__empty-title">No proposal waiting</p>
            <p className="proposal-panel__empty-copy">An external agent can read the graph and submit structured operations through WebMCP.</p>
          </div>
        )
      ) : (
        <div className="proposal-panel__content">
          {changesRequested && reviewRequest && (
            <div role="status" className="proposal-panel__notice is-warning">
              <p className="proposal-panel__notice-title">Changes requested</p>
              <p className="proposal-panel__notice-copy whitespace-pre-wrap">{reviewRequest.feedback}</p>
              <p className="proposal-panel__notice-help">
                This reviewed candidate remains visible and read-only until an agent submits a valid replacement. The accepted graph is unchanged.
              </p>
            </div>
          )}
          {activeEntry ? (
            <ProposalChangeInspector
              reviewEntry={activeEntry}
              totalChanges={changedEntries.length}
              onBack={returnToOverview}
              onPrevious={() => {
                const index = changedEntries.findIndex(({ key }) => key === activeEntry.key);
                if (index > 0) selectEntry(changedEntries[index - 1], undefined, changedEntries[index - 1].key);
              }}
              onNext={() => {
                const index = changedEntries.findIndex(({ key }) => key === activeEntry.key);
                if (index >= 0 && index < changedEntries.length - 1) selectEntry(changedEntries[index + 1], undefined, changedEntries[index + 1].key);
              }}
            />
          ) : <>
            <details className="proposal-panel__rationale" open>
              <summary>Agent rationale</summary>
              <p id="proposal-agent-rationale">{proposal.rationale}</p>
            </details>
            {review.kind === 'stale' && (
              <p role="status" className="proposal-panel__notice is-danger">
                The accepted graph changed after this proposal was created. No candidate was replayed against the current graph; reject this stale review before continuing.
              </p>
            )}
            {comparison?.invalid && (
              <p role="status" className="proposal-panel__notice is-danger">
                The proposed candidate is invalid and cannot be approved.
              </p>
            )}
            {comparison && (
              <ProposalOverview
                comparison={comparison}
                onChangeSelect={(entry, trigger) => selectEntry(entry, trigger, entry.key)}
                changeButtonRef={(entry, element) => {
                  if (element) entryButtonRefs.current.set(entry.key, element);
                  else entryButtonRefs.current.delete(entry.key);
                }}
              />
            )}
            {issues.length > 0 && (
              <ul className="proposal-panel__issues" aria-label="Proposal validation issues">
                {issues.map((issue, index) => {
                  const issueEntry = entryForIssue(issue.path);
                  return <li key={`${issue.code}-${issue.path ?? index}`}>
                    {issueEntry ? (
                      <button
                        type="button"
                        ref={(element) => {
                          if (element) entryButtonRefs.current.set(`issue:${issue.code}:${index}`, element);
                        }}
                        onClick={(event) => selectEntry(issueEntry, event.currentTarget, `issue:${issue.code}:${index}`)}
                      >
                        <strong>{issueEntry.entry.id}</strong><span>{issue.message}</span>
                      </button>
                    ) : <span>{issue.message}</span>}
                  </li>;
                })}
              </ul>
            )}
          </>}
        </div>
      )}
      </section>
    </ModePanelShell>
    {requestChangesOpen && (
      <RequestChangesDialog
        restoreFocusTo={requestChangesButtonRef}
        onClose={() => setRequestChangesOpen(false)}
        onSubmit={onRequestChanges}
      />
    )}
  </>);
}
