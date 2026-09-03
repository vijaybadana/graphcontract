export const WORKSPACE_THEME_STORAGE_KEY = 'graphcontract.workspace-theme';

export const WORKSPACE_THEMES = [
  { value: 'classic', label: 'Classic', colorScheme: 'light' },
  { value: 'dark', label: 'Dark', colorScheme: 'dark' },
  { value: 'signal', label: 'Signal', colorScheme: 'dark' },
] as const;

export type WorkspaceTheme = (typeof WORKSPACE_THEMES)[number]['value'];

const themeListeners = new Set<() => void>();
let listeningForStorage = false;

function notifyThemeListeners() {
  themeListeners.forEach((listener) => listener());
}

function handleThemeStorage(event: StorageEvent) {
  if (event.key !== WORKSPACE_THEME_STORAGE_KEY) return;
  applyWorkspaceTheme(event.newValue, {
    root: document.documentElement,
  });
  notifyThemeListeners();
}

export function normalizeWorkspaceTheme(value: unknown): WorkspaceTheme {
  return WORKSPACE_THEMES.some((theme) => theme.value === value)
    ? value as WorkspaceTheme
    : 'classic';
}

export function colorSchemeForWorkspaceTheme(theme: WorkspaceTheme): 'light' | 'dark' {
  return WORKSPACE_THEMES.find((candidate) => candidate.value === theme)?.colorScheme ?? 'light';
}

export function readWorkspaceTheme(storage?: Pick<Storage, 'getItem'>): WorkspaceTheme {
  if (!storage) return 'classic';
  try {
    return normalizeWorkspaceTheme(storage.getItem(WORKSPACE_THEME_STORAGE_KEY));
  } catch {
    return 'classic';
  }
}

export function applyWorkspaceTheme(
  value: unknown,
  options: {
    root?: Pick<HTMLElement, 'dataset' | 'style'>;
    storage?: Pick<Storage, 'setItem'>;
  } = {},
): WorkspaceTheme {
  const theme = normalizeWorkspaceTheme(value);
  const root = options.root;
  if (root) {
    root.dataset.theme = theme;
    root.style.colorScheme = colorSchemeForWorkspaceTheme(theme);
  }
  try {
    options.storage?.setItem(WORKSPACE_THEME_STORAGE_KEY, theme);
  } catch {
    // A blocked storage API must never prevent the presentation preference
    // from applying to the current document.
  }
  return theme;
}

export function currentWorkspaceTheme(): WorkspaceTheme {
  if (typeof document === 'undefined') return 'classic';
  return normalizeWorkspaceTheme(document.documentElement.dataset.theme);
}

export function subscribeWorkspaceTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  if (typeof window !== 'undefined' && !listeningForStorage) {
    window.addEventListener('storage', handleThemeStorage);
    listeningForStorage = true;
  }
  return () => {
    themeListeners.delete(listener);
    if (typeof window !== 'undefined' && themeListeners.size === 0 && listeningForStorage) {
      window.removeEventListener('storage', handleThemeStorage);
      listeningForStorage = false;
    }
  };
}

export function setWorkspaceTheme(value: unknown): WorkspaceTheme {
  let storage: Storage | undefined;
  try {
    storage = typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    storage = undefined;
  }
  const theme = applyWorkspaceTheme(value, {
    root: typeof document === 'undefined' ? undefined : document.documentElement,
    storage,
  });
  notifyThemeListeners();
  return theme;
}
