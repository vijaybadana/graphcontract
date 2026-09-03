import { describe, expect, it, vi } from 'vitest';

import {
  applyWorkspaceTheme,
  normalizeWorkspaceTheme,
  readWorkspaceTheme,
  WORKSPACE_THEME_STORAGE_KEY,
} from './workspace-theme';

describe('workspace theme preference', () => {
  it('normalizes missing and unknown values to Classic', () => {
    expect(normalizeWorkspaceTheme(undefined)).toBe('classic');
    expect(normalizeWorkspaceTheme('neon')).toBe('classic');
    expect(normalizeWorkspaceTheme('dark')).toBe('dark');
    expect(normalizeWorkspaceTheme('signal')).toBe('signal');
  });

  it('reads safely when storage is unavailable', () => {
    expect(readWorkspaceTheme({ getItem: () => 'dark' })).toBe('dark');
    expect(readWorkspaceTheme({ getItem: () => 'unexpected' })).toBe('classic');
    expect(readWorkspaceTheme({ getItem: () => { throw new Error('blocked'); } })).toBe('classic');
  });

  it('applies and persists only the normalized presentation value', () => {
    const root = {
      dataset: {} as DOMStringMap,
      style: { colorScheme: '' } as CSSStyleDeclaration,
    };
    const setItem = vi.fn();

    expect(applyWorkspaceTheme('signal', { root, storage: { setItem } })).toBe('signal');
    expect(root.dataset.theme).toBe('signal');
    expect(root.style.colorScheme).toBe('dark');
    expect(setItem).toHaveBeenCalledWith(WORKSPACE_THEME_STORAGE_KEY, 'signal');

    expect(applyWorkspaceTheme('unknown', { root, storage: { setItem } })).toBe('classic');
    expect(root.dataset.theme).toBe('classic');
    expect(root.style.colorScheme).toBe('light');
  });
});
