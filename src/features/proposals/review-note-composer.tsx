'use client';

import { useId, useState } from 'react';

export function ReviewNoteComposer({
  label,
  placeholder,
  value,
  disabled = false,
  onSave,
  onRemove,
}: {
  label: string;
  placeholder: string;
  value?: string;
  disabled?: boolean;
  onSave: (feedback: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const inputId = useId();

  const normalized = draft.trim();
  return (
    <div className="proposal-review-note">
      <label htmlFor={inputId}>{label}</label>
      <div className="proposal-review-note__controls">
        <textarea
          id={inputId}
          rows={2}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className="primary-button"
          disabled={disabled || normalized.length < 3 || normalized === value}
          onClick={() => onSave(normalized)}
        >
          {value ? 'Update note' : 'Add note'}
        </button>
      </div>
      {value && !disabled && (
        <button type="button" className="proposal-review-note__remove" onClick={() => { setDraft(''); onRemove(); }}>Remove note</button>
      )}
    </div>
  );
}
