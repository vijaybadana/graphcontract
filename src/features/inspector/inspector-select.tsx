'use client';

import { CaretDown, Check } from '@phosphor-icons/react';
import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

export type InspectorSelectOption<Value extends string> = {
  value: Value;
  label: string;
};

type InspectorSelectProps<Value extends string> = {
  value: Value;
  options: readonly InspectorSelectOption<Value>[];
  disabled?: boolean;
  onChange: (value: Value) => void;
};

export function InspectorSelect<Value extends string>({
  value,
  options,
  disabled = false,
  onChange,
}: InspectorSelectProps<Value>) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    return () => document.removeEventListener('pointerdown', closeFromOutside);
  }, [open]);

  const focusOption = (index: number) => {
    const normalized = (index + options.length) % options.length;
    requestAnimationFrame(() => optionRefs.current[normalized]?.focus());
  };

  const openAndFocus = (index = selectedIndex) => {
    if (disabled) return;
    setOpen(true);
    focusOption(index);
  };

  const choose = (nextValue: Value) => {
    if (disabled) return;
    onChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openAndFocus(selectedIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    optionIndex: number,
  ) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(optionIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusOption(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
      if (event.key === 'Escape') {
        event.preventDefault();
        triggerRef.current?.focus();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className="input flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span>{selectedOption?.label ?? value}</span>
        <CaretDown
          aria-hidden="true"
          size={14}
          weight="bold"
          className={`shrink-0 text-black/45 transition-transform ${open && !disabled ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !disabled && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Choose an option"
          className="absolute inset-x-0 top-[calc(100%+0.3rem)] z-50 overflow-hidden rounded-xl border border-black/10 bg-white p-1 shadow-xl"
        >
          {options.map((option, optionIndex) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                ref={(element) => {
                  optionRefs.current[optionIndex] = element;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                  selected ? 'bg-[#18211d] font-semibold text-white' : 'hover:bg-black/5'
                }`}
              >
                {option.label}
                {selected && <Check aria-hidden="true" size={14} weight="bold" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
