'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Exposes current callback behavior through one durable function identity.
 * Event-driven libraries may include callback identity in synchronization
 * effects; keeping the wrapper stable prevents a render-only dependency change
 * from being mistaken for a new external event.
 */
export function useStableEvent<Arguments extends unknown[], Result>(
  callback: (...args: Arguments) => Result,
): (...args: Arguments) => Result {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  return useCallback((...args: Arguments) => callbackRef.current(...args), []);
}
