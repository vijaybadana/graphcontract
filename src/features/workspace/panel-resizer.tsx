'use client';

import { KeyboardEvent, PointerEvent, RefObject, useRef, useState } from 'react';

import './panel-resizer.css';

// Interaction model adapted from Breakscale's PanelResizer (MIT).
// See THIRD_PARTY_NOTICES.md for the upstream source and license notice.

type PanelSide = 'left' | 'right';

export type PanelResizerProps = {
  side: PanelSide;
  cssVariable: `--${string}`;
  min: number;
  max: number;
  defaultValue: number;
  onCommit?: (value: number) => void;
  targetRef?: RefObject<HTMLElement | null>;
  ariaLabel?: string;
  step?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function PanelResizer({ side, cssVariable, min, max, defaultValue, onCommit, targetRef, ariaLabel, step = 16 }: PanelResizerProps) {
  const separatorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startValue: number; value: number } | null>(null);
  const [value, setValue] = useState(() => clamp(defaultValue, min, max));

  const target = () => targetRef?.current ?? document.documentElement;
  const write = (next: number) => {
    const clamped = clamp(next, min, max);
    target().style.setProperty(cssVariable, `${clamped}px`);
    separatorRef.current?.setAttribute('aria-valuenow', String(clamped));
    return clamped;
  };
  const commit = (next: number) => {
    const committed = write(next);
    setValue(committed);
    onCommit?.(committed);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const current = Number.parseFloat(getComputedStyle(target()).getPropertyValue(cssVariable));
    const startValue = Number.isFinite(current) ? clamp(current, min, max) : value;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startValue, value: startValue };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an enhancement; an in-bounds gesture can still complete.
    }
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.buttons === 0) {
      dragRef.current = null;
      commit(drag.value);
      return;
    }
    drag.value = write(drag.startValue + (side === 'left' ? 1 : -1) * (event.clientX - drag.startX));
  };
  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    commit(drag.value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | undefined;
    if (event.key === 'Home') next = min;
    if (event.key === 'End') next = max;
    if (event.key === 'ArrowLeft') next = value + (side === 'right' ? step : -step);
    if (event.key === 'ArrowRight') next = value + (side === 'right' ? -step : step);
    if (next === undefined) return;
    event.preventDefault();
    commit(next);
  };

  return <div ref={separatorRef} className={`panel-resizer panel-resizer--${side}`} role="separator" tabIndex={0} aria-orientation="vertical" aria-label={ariaLabel ?? `Resize ${side} panel`} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} onKeyDown={onKeyDown} onDoubleClick={() => commit(defaultValue)} />;
}
