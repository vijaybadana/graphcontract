'use client';

import { X } from '@phosphor-icons/react';
import { FormEvent, KeyboardEvent, RefObject, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { RequestChangesResult } from '@/src/application/workspace';

type RequestChangesDialogProps = {
  restoreFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit: (feedback: string) => RequestChangesResult;
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
    const result = onSubmit(feedback);
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 p-4"
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
        className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-5 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Human review</p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold">Request proposal changes</h2>
            <p id={descriptionId} className="mt-2 text-xs leading-5 text-black/60">
              The accepted graph will remain unchanged. This feedback is returned to the agent as untrusted human-authored review content.
            </p>
          </div>
          <button type="button" aria-label="Close request changes" onClick={onClose} className="rounded-lg p-2 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2">
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
            className="mt-2 w-full resize-y rounded-xl border border-black/15 bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-black/40 focus:ring-2 focus:ring-black/10"
          />
          <p id={feedbackHelpId} className="mt-1.5 text-[11px] leading-4 text-black/55">
            Enter at least 3 non-space characters. Feedback is stored as plain text.
          </p>
          {error && <p id="proposal-review-feedback-error" role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="secondary-button">Cancel</button>
            <button type="submit" disabled={normalizedFeedback.length < 3} className="primary-button">Submit request</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
