'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsClockwise,
  CardsThree,
  CaretDown,
  Check,
  Copy,
  FrameCorners,
  LockSimple,
  LockSimpleOpen,
  Palette,
  SidebarSimple,
  Star,
  TreeStructure,
  Trash,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

import { GitHubBrandMark } from '@/src/features/brand/github-brand-mark';

import './workspace-header.css';
import type { WorkspacePresentationMode } from './presentation-mode';
import { WORKSPACE_THEMES, type WorkspaceTheme } from './workspace-theme';

export type WebMcpStatus = 'unavailable' | 'registering' | 'connected' | 'error';

type WorkspaceHeaderProps = {
  graphName: string;
  graphStatus: 'draft' | 'frozen';
  webMcpStatus: WebMcpStatus;
  nodeCount: number;
  edgeCount: number;
  issueCount: number;
  proposalPending: boolean;
  libraryOpen: boolean;
  libraryEntryCount: number;
  paletteOpen: boolean;
  inspectorOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  canFreeze: boolean;
  canAutoLayout: boolean;
  scenarioCount: number;
  viewMode: WorkspacePresentationMode;
  runtimeAvailable: boolean;
  runtimeUnavailableReason?: string;
  theme?: WorkspaceTheme;
  onTogglePalette: () => void;
  onToggleInspector: () => void;
  onOpenLibrary: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAutoLayout: () => void;
  onFit: () => void;
  onReset: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onViewModeChange: (mode: WorkspacePresentationMode) => void;
  onThemeChange?: (theme: WorkspaceTheme) => void;
};

export function WorkspaceHeader({
  graphName,
  graphStatus,
  nodeCount,
  edgeCount,
  issueCount,
  proposalPending,
  libraryOpen,
  libraryEntryCount,
  paletteOpen,
  inspectorOpen,
  canUndo,
  canRedo,
  canDuplicate,
  canDelete,
  canFreeze,
  canAutoLayout,
  scenarioCount,
  viewMode,
  runtimeAvailable,
  runtimeUnavailableReason,
  theme = 'classic',
  onTogglePalette,
  onToggleInspector,
  onOpenLibrary,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onAutoLayout,
  onFit,
  onReset,
  onFreeze,
  onUnfreeze,
  onViewModeChange,
  onThemeChange = () => undefined,
}: WorkspaceHeaderProps) {
  const contractState = proposalPending
    ? 'Proposal awaiting review'
    : issueCount > 0
      ? `${issueCount} issue${issueCount === 1 ? '' : 's'}`
      : graphStatus === 'frozen'
        ? 'Frozen contract'
        : 'Valid draft';

  return (
    <header className="workspace-header" aria-label="GraphContract workspace controls">
      <section className="workspace-island workspace-brand-island">
        <div className="workspace-mark" aria-hidden="true">GC</div>
        <div className="workspace-brand-copy">
          <strong>GraphContract</strong>
        </div>
        <GithubRepositoryLink />
      </section>

      <section className="workspace-island workspace-command-island">
        <div className="workspace-contract-summary">
          <span className="workspace-contract-label">Contract</span>
          <strong title={graphName}>{graphName}</strong>
          <span className={`workspace-contract-state ${issueCount > 0 ? 'is-warning' : 'is-valid'}`}>
            {contractState}
          </span>
          <span className="workspace-contract-counts" aria-label={`${nodeCount} nodes and ${edgeCount} edges`}>
            {nodeCount} nodes · {edgeCount} edges
          </span>
        </div>
        <div className="workspace-command-divider workspace-panel-command-divider" />
        <button
          type="button"
          className={`workspace-library-button workspace-tooltip-trigger ${libraryOpen ? 'is-active' : ''}`}
          aria-label={`Workflow library, ${libraryEntryCount} templates`}
          aria-haspopup="dialog"
          aria-expanded={libraryOpen}
          data-tooltip="Browse workflow library"
          onClick={onOpenLibrary}
        >
          <CardsThree aria-hidden="true" size={17} weight="duotone" />
          <span className="workspace-library-label">Library</span>
          <strong className="workspace-library-count" aria-hidden="true">{libraryEntryCount}</strong>
        </button>
        <div className="workspace-command-divider workspace-library-command-divider" />
        <div className="workspace-command-group workspace-panel-command-group" role="group" aria-label="Panel controls">
          <HeaderIconButton label={paletteOpen ? 'Hide inventory' : 'Show inventory'} icon={SidebarSimple} active={paletteOpen} onClick={onTogglePalette} />
          <HeaderIconButton label={inspectorOpen ? 'Hide inspector' : 'Show inspector'} icon={SidebarSimple} active={inspectorOpen} mirrored onClick={onToggleInspector} />
        </div>
        <div className="workspace-command-divider workspace-edit-command-divider" />
        <WorkspacePresentationSwitch
          active={viewMode}
          scenarioCount={scenarioCount}
          proposalPending={proposalPending}
          runtimeAvailable={runtimeAvailable}
          runtimeUnavailableReason={runtimeUnavailableReason}
          onChange={onViewModeChange}
        />
        <div className="workspace-command-divider workspace-view-command-divider" />
        <div className="workspace-command-group workspace-edit-command-group" role="group" aria-label="History and edit controls">
          <HeaderIconButton label="Undo" icon={ArrowCounterClockwise} disabled={!canUndo} onClick={onUndo} />
          <HeaderIconButton label="Redo" icon={ArrowClockwise} disabled={!canRedo} onClick={onRedo} />
          <HeaderIconButton label="Duplicate selection" icon={Copy} disabled={!canDuplicate} onClick={onDuplicate} />
          <HeaderIconButton label="Delete selection" icon={Trash} disabled={!canDelete} tone="danger" onClick={onDelete} />
        </div>
        <div className="workspace-command-divider workspace-canvas-command-divider" />
        <div className="workspace-command-group workspace-canvas-command-group" role="group" aria-label="Canvas controls">
          <button
            type="button"
            className="workspace-auto-layout-button workspace-tooltip-trigger"
            aria-label="Auto-layout graph"
            data-tooltip="Auto-layout graph"
            disabled={!canAutoLayout}
            onClick={onAutoLayout}
          >
            <TreeStructure aria-hidden="true" size={15} weight="bold" />
            <span>Auto-layout</span>
          </button>
          <HeaderIconButton label="Fit graph" icon={FrameCorners} onClick={onFit} />
          <HeaderIconButton label="Reset example graph" icon={ArrowsClockwise} disabled={proposalPending} onClick={onReset} />
        </div>
      </section>

      <section className="workspace-island workspace-action-island">
        <WorkspaceThemeMenu theme={theme} onChange={onThemeChange} />
        <span className={`workspace-status-badge ${graphStatus === 'frozen' ? 'is-frozen' : 'is-draft'}`}>
          {graphStatus}
        </span>
        {graphStatus === 'frozen' ? (
          <button
            type="button"
            className="workspace-freeze-button is-secondary"
            aria-label="Unfreeze contract; currently frozen"
            onClick={onUnfreeze}
          >
            <LockSimpleOpen aria-hidden="true" size={15} weight="bold" />
            <span>Unfreeze</span>
          </button>
        ) : (
          <button
            type="button"
            className="workspace-freeze-button"
            aria-label="Confirm and freeze contract; currently draft"
            disabled={!canFreeze}
            onClick={onFreeze}
          >
            <LockSimple aria-hidden="true" size={15} weight="bold" />
            <span>Confirm &amp; freeze</span>
          </button>
        )}
      </section>
    </header>
  );
}

function WorkspaceThemeMenu({
  theme,
  onChange,
}: {
  theme: WorkspaceTheme;
  onChange: (theme: WorkspaceTheme) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedTheme = WORKSPACE_THEMES.find((option) => option.value === theme) ?? WORKSPACE_THEMES[0];

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>('.workspace-theme-trigger')?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="workspace-theme-menu">
      <button
        type="button"
        className="workspace-theme-trigger"
        aria-label={`Workspace theme: ${selectedTheme.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')?.focus());
        }}
      >
        <Palette aria-hidden="true" size={15} weight="duotone" />
        <span className="workspace-theme-label">{selectedTheme.label}</span>
        <CaretDown aria-hidden="true" size={12} weight="bold" />
      </button>
      {open && (
        <div className="workspace-theme-popover" role="menu" aria-label="Workspace theme">
          {WORKSPACE_THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.value}
              className={`workspace-theme-option ${theme === option.value ? 'is-selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {theme === option.value && <Check aria-hidden="true" size={14} weight="bold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const GITHUB_REPOSITORY_URL = 'https://github.com/vijaybadana/graphcontract';
const GITHUB_STARS_CACHE_KEY = 'graphcontract:github-stars';
const GITHUB_STARS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function readCachedGithubStars() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage.getItem(GITHUB_STARS_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as { count?: unknown; savedAt?: unknown };
    return (
      typeof parsed.count === 'number'
      && typeof parsed.savedAt === 'number'
      && Date.now() - parsed.savedAt < GITHUB_STARS_CACHE_TTL_MS
    ) ? parsed.count : null;
  } catch {
    return null;
  }
}

function GithubRepositoryLink() {
  const [starCount, setStarCount] = useState<number | null>(readCachedGithubStars);
  const starRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => starRequestRef.current?.abort();
  }, []);

  const requestStarCount = () => {
    if (starCount !== null || starRequestRef.current) return;
    const controller = new AbortController();
    starRequestRef.current = controller;

    void fetch('https://api.github.com/repos/vijaybadana/graphcontract', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { stargazers_count?: unknown } | null) => {
        if (typeof payload?.stargazers_count !== 'number') return;
        setStarCount(payload.stargazers_count);
        try {
          window.localStorage.setItem(
            GITHUB_STARS_CACHE_KEY,
            JSON.stringify({ count: payload.stargazers_count, savedAt: Date.now() }),
          );
        } catch {
          // Storage is an optional optimization; the visible link remains usable.
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      })
      .finally(() => {
        if (starRequestRef.current === controller) starRequestRef.current = null;
      });
  };

  const starLabel = starCount === null ? 'Star' : starCount.toLocaleString();
  return (
    <a
      className="workspace-github-link"
      href={GITHUB_REPOSITORY_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open GraphContract on GitHub${starCount === null ? '' : `, ${starLabel} stars`}`}
      onFocus={requestStarCount}
      onPointerEnter={requestStarCount}
    >
      <GitHubBrandMark size={14} />
      <Star aria-hidden="true" size={12} weight="fill" />
      <span>{starLabel}</span>
    </a>
  );
}

function WorkspacePresentationSwitch({
  active,
  scenarioCount,
  proposalPending,
  runtimeAvailable,
  runtimeUnavailableReason,
  onChange,
}: {
  active: WorkspacePresentationMode;
  scenarioCount: number;
  proposalPending: boolean;
  runtimeAvailable: boolean;
  runtimeUnavailableReason?: string;
  onChange: (mode: WorkspacePresentationMode) => void;
}) {
  const options: ReadonlyArray<{
    mode: WorkspacePresentationMode;
    label: string;
    compactLabel: string;
    available: boolean;
    unavailableReason?: string;
  }> = [
    {
      mode: 'design',
      label: 'Design',
      compactLabel: 'Design',
      available: !proposalPending,
      unavailableReason: 'A proposal is awaiting human review.',
    },
    {
      mode: 'scenario',
      label: 'Scenario',
      compactLabel: 'Cases',
      available: scenarioCount > 0 && !proposalPending,
      unavailableReason: proposalPending
        ? 'A proposal is awaiting human review.'
        : 'Freeze a valid contract to generate scenarios.',
    },
    {
      mode: 'proposal',
      label: 'Proposal',
      compactLabel: 'Review',
      available: proposalPending,
      unavailableReason: 'No proposal is awaiting human review.',
    },
    {
      mode: 'runtime',
      label: 'Runtime',
      compactLabel: 'Run',
      available: runtimeAvailable && !proposalPending,
      unavailableReason: proposalPending
        ? 'A proposal is awaiting human review.'
        : runtimeUnavailableReason ?? 'No runtime trace or fixture is available.',
    },
  ];

  const optionRefs = useRef<Partial<Record<WorkspacePresentationMode, HTMLButtonElement | null>>>({});
  const availableOptions = options.filter((option) => option.available);
  const rovingMode = options.some((option) => option.mode === active && option.available)
    ? active
    : availableOptions[0]?.mode;

  const selectByKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentMode: WorkspacePresentationMode,
  ) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const currentIndex = availableOptions.findIndex((option) => option.mode === currentMode);
    if (currentIndex < 0 || availableOptions.length === 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = availableOptions.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % availableOptions.length;
    } else {
      nextIndex = (currentIndex - 1 + availableOptions.length) % availableOptions.length;
    }

    const nextMode = availableOptions[nextIndex]?.mode;
    if (!nextMode) return;
    optionRefs.current[nextMode]?.focus();
    if (nextMode !== active) onChange(nextMode);
  };

  return (
    <div
      className="workspace-command-group workspace-view-command-group"
      role="radiogroup"
      aria-label="Canvas projection"
      aria-orientation="horizontal"
    >
      {options.map((option) => (
        <button
          key={option.mode}
          ref={(element) => { optionRefs.current[option.mode] = element; }}
          type="button"
          role="radio"
          aria-checked={active === option.mode}
          aria-label={option.available ? option.label : `${option.label} unavailable: ${option.unavailableReason}`}
          className={`workspace-view-button ${active === option.mode ? 'is-active' : ''}`}
          disabled={!option.available}
          tabIndex={option.available && option.mode === rovingMode ? 0 : -1}
          title={option.available ? `Show ${option.label.toLowerCase()} projection` : option.unavailableReason}
          onClick={() => onChange(option.mode)}
          onKeyDown={(event) => selectByKeyboard(event, option.mode)}
        >
          <span className="workspace-view-label-full" aria-hidden="true">{option.label}</span>
          <span className="workspace-view-label-compact" aria-hidden="true">{option.compactLabel}</span>
        </button>
      ))}
    </div>
  );
}

function HeaderIconButton({
  label,
  icon: IconComponent,
  disabled,
  active,
  mirrored,
  tone,
  onClick,
}: {
  label: string;
  icon: Icon;
  disabled?: boolean;
  active?: boolean;
  mirrored?: boolean;
  tone?: 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tooltip={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`workspace-icon-button workspace-tooltip-trigger ${active ? 'is-active' : ''} ${tone === 'danger' ? 'is-danger' : ''}`}
    >
      <IconComponent aria-hidden="true" size={16} weight="bold" className={mirrored ? '-scale-x-100' : ''} />
    </button>
  );
}
