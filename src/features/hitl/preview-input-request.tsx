'use client';

import { CheckCircle, LockSimple, PaperPlaneTilt, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { WorkflowGraph } from '@/src/domain';

import './preview-input-request.css';

type StepNode = Extract<WorkflowGraph['nodes'][number], { kind: 'step' }>;

type PreviewResponse = {
  outcomeId: string;
  response: string;
};

type PreviewInputRequestSheetProps = {
  graph: WorkflowGraph;
  node: StepNode;
  onClose: () => void;
  /** The invoking human control is the preferred close destination. */
  restoreFocusTo?: { current: HTMLElement | null };
};

function destinationLabel(graph: WorkflowGraph, nodeId: string) {
  const destination = graph.nodes.find((node) => node.id === nodeId);
  return destination ? `${destination.label} · ${destination.id}` : `Missing destination · ${nodeId}`;
}

/**
 * A deterministic local-only rendering of an authored HITL contract. It does
 * not import the workspace store: selecting a response cannot execute, resume,
 * propose, or mutate the accepted graph.
 */
export function PreviewInputRequestSheet(props: PreviewInputRequestSheetProps) {
  const response = props.node.hitl?.response;
  if (!response) return null;
  // Recreate local-only form state whenever the authored response contract
  // changes. This avoids synchronizing component state from an effect.
  return (
    <PreviewInputRequestSheetContents
      key={`${props.node.id}:${JSON.stringify(response)}`}
      {...props}
      response={response}
    />
  );
}

function PreviewInputRequestSheetContents({
  graph,
  node,
  onClose,
  restoreFocusTo,
  response,
}: PreviewInputRequestSheetProps & {
  response: NonNullable<NonNullable<StepNode['hitl']>['response']>;
}) {
  const [textResponse, setTextResponse] = useState('');
  const [selectionResponse, setSelectionResponse] = useState(
    () => response?.selectionChoices?.[0]?.id ?? '',
  );
  const [selectedOutcomeId, setSelectedOutcomeId] = useState('');
  const [previewResponse, setPreviewResponse] = useState<PreviewResponse | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    initialFocusRef.current =
      restoreFocusTo?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      if (initialFocusRef.current?.isConnected) initialFocusRef.current.focus();
    };
  }, [restoreFocusTo]);

  const selectedOutcome = response.allowedOutcomes.find((outcome) => outcome.id === selectedOutcomeId);
  const selectedChoice = response.selectionChoices?.find((choice) => choice.id === selectionResponse);
  const responsePayload =
    response.type === 'text'
      ? textResponse
      : response.type === 'selection'
        ? selectedChoice?.label ?? ''
        : selectedOutcome?.label ?? '';
  const canPreview = Boolean(selectedOutcome && (response.type !== 'selection' || selectedChoice));
  const previewedOutcome = previewResponse
    ? response.allowedOutcomes.find((outcome) => outcome.id === previewResponse.outcomeId)
    : undefined;

  return createPortal(
    <div
      className="preview-input-request"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-input-request-title"
      aria-describedby="preview-input-request-notice"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="preview-input-request__sheet">
        <header className="preview-input-request__header">
          <div>
            <p>Human control</p>
            <h2 id="preview-input-request-title">Preview input request</h2>
          </div>
          <button ref={closeButtonRef} type="button" aria-label="Close input request preview" onClick={onClose}>
            <X aria-hidden="true" size={18} weight="bold" />
          </button>
        </header>
        <p id="preview-input-request-notice" className="preview-input-request__notice" role="status">
          Preview only — no runtime execution, response, resume, or graph mutation occurs here.
        </p>
        <section>
          <h3>{node.label}</h3>
          <p>This contract pauses <strong>{node.hitl?.timing ?? 'before'}</strong> this Step.</p>
          {node.hitl?.activation?.reason && (
            <p className="preview-input-request__reason"><strong>Reason</strong>{node.hitl.activation.reason}</p>
          )}
        </section>
        <section>
          <h3>Configured human response</h3>
          <p className="preview-input-request__human-only">
            <LockSimple aria-hidden="true" size={15} weight="bold" /> Only a human can choose this preview response.
          </p>
          {response.type === 'text' && (
            <label>
              <span>Preview text response</span>
              <textarea value={textResponse} onChange={(event) => setTextResponse(event.target.value)} placeholder="Optional guidance or response…" />
            </label>
          )}
          {response.type === 'selection' && (
            <label>
              <span>Preview selection response</span>
              <select value={selectionResponse} onChange={(event) => setSelectionResponse(event.target.value)}>
                {response.selectionChoices?.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
              </select>
            </label>
          )}
        </section>
        <section>
          <h3>Allowed outcomes</h3>
          <div className="preview-input-request__outcomes">
            {response.allowedOutcomes.map((outcome) => (
              <label key={outcome.id} className={selectedOutcomeId === outcome.id ? 'is-selected' : ''}>
                <input
                  type="radio"
                  name={`preview-outcome-${node.id}`}
                  value={outcome.id}
                  checked={selectedOutcomeId === outcome.id}
                  onChange={() => setSelectedOutcomeId(outcome.id)}
                />
                <span>
                  <strong>{outcome.label}</strong>
                  <small>Would resume at {destinationLabel(graph, outcome.resumeNodeId)}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
        <button
          type="button"
          className="preview-input-request__resume"
          disabled={!canPreview}
          onClick={() => selectedOutcome && setPreviewResponse({ outcomeId: selectedOutcome.id, response: responsePayload })}
        >
          <PaperPlaneTilt aria-hidden="true" size={16} weight="fill" /> Preview selected response
        </button>
        {previewedOutcome && (
          <p className="preview-input-request__result" role="status" aria-live="polite">
            <CheckCircle aria-hidden="true" size={17} weight="fill" /> Preview response “{previewResponse?.response || previewedOutcome.label}” would resume at {destinationLabel(graph, previewedOutcome.resumeNodeId)}. No runtime executed and the graph is unchanged.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
