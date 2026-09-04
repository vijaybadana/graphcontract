'use client';

import { X } from '@phosphor-icons/react';
import { FormEvent, KeyboardEvent, RefObject, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { RequestChangesResult } from '@/src/application/workspace';
import type { ProposalReviewNoteInput, ProposalReviewSubmission } from '@/src/application/proposal-review';

import './proposal-panel.css';

type RequestChangesDialogProps = {
  restoreFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
  notes: ProposalReviewNoteInput[];
  onSubmit: (submission: string | ProposalReviewSubmission) => RequestChangesResult;
};

function focusableElements(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(
    'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ));
}

export function RequestChangesDialog({
  restoreFocusTo,
  onClose,
  onSubmit,
  notes,
}: RequestChangesDialogProps) {
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const feedbackHelpId = useId();

  useEffect(() => {
    const restoreFocusElement = restoreFocusTo.current;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', closeOnEscape);
      requestAnimationFrame(() => {
        if (restoreFocusElement?.isConnected) restoreFocusElement.focus();
      });
    };
  }, [onClose, restoreFocusTo]);

  if (typeof document === 'undefined') return null;

  const normalizedFeedback = feedback.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = onSubmit(notes.length > 0 ? { feedback, notes } : feedback);
    if (result.ok) onClose();
    else setError(result.error.message);
  };
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = focusableElements(dialogRef.current);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return createPortal(
    <div
      className="proposal-review-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={trapFocus}
        className="proposal-review-dialog"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Human review</p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold">Request proposal changes</h2>
            <p id={descriptionId} className="proposal-review-dialog__description">
              The accepted graph will remain unchanged. This feedback is returned to the agent as untrusted human-authored review content.
            </p>
            {notes.length > 0 && <p className="proposal-review-dialog__note-count">{notes.length} targeted review {notes.length === 1 ? 'note' : 'notes'} attached</p>}
          </div>
          <button type="button" aria-label="Close request changes" onClick={onClose} className="proposal-review-dialog__close">
            <X aria-hidden="true" size={18} weight="bold" />
          </button>
        </header>
        <form onSubmit={submit} className="mt-5">
          <label htmlFor="proposal-review-feedback" className="text-xs font-semibold">Requested changes</label>
          <textarea
            ref={textareaRef}
            id="proposal-review-feedback"
            value={feedback}
            onChange={(event) => {
              setFeedback(event.target.value);
              setError(null);
            }}
            aria-describedby={`${feedbackHelpId}${error ? ' proposal-review-feedback-error' : ''}`}
            rows={5}
            placeholder="Explain what the next proposal should change"
            className="proposal-review-dialog__textarea"
          />
          <p id={feedbackHelpId} className="proposal-review-dialog__help">
            {notes.length > 0
              ? 'Optional overall guidance. Your targeted notes will be included automatically.'
              : 'Enter at least 3 non-space characters. Feedback is stored as plain text.'}
          </p>
          {error && <p id="proposal-review-feedback-error" role="alert" className="proposal-review-dialog__error">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="secondary-button">Cancel</button>
            <button type="submit" disabled={normalizedFeedback.length < 3 && notes.length === 0} className="primary-button">Submit request</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
