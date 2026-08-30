'use client';

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsClockwise,
  Books,
  Copy,
  FrameCorners,
  GitBranch,
  LockSimple,
  LockSimpleOpen,
  SidebarSimple,
  Trash,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

import './workspace-header.css';

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
  viewMode: 'design' | 'runtime';
  runtimeAvailable: boolean;
  runtimeUnavailableReason?: string;
  onTogglePalette: () => void;
  onToggleInspector: () => void;
  onOpenLibrary: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFit: () => void;
  onReset: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onViewModeChange: (mode: 'design' | 'runtime') => void;
};

export function WorkspaceHeader({
  graphName,
  graphStatus,
  webMcpStatus,
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
  viewMode,
  runtimeAvailable,
  runtimeUnavailableReason,
  onTogglePalette,
  onToggleInspector,
  onOpenLibrary,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onFit,
  onReset,
  onFreeze,
  onUnfreeze,
  onViewModeChange,
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
          <span>Human-approved workflows</span>
        </div>
        <div className="workspace-history-controls" role="group" aria-label="History controls">
          <HeaderIconButton label="Undo" icon={ArrowCounterClockwise} disabled={!canUndo} onClick={onUndo} />
          <HeaderIconButton label="Redo" icon={ArrowClockwise} disabled={!canRedo} onClick={onRedo} />
        </div>
      </section>

      <section className="workspace-island workspace-command-island">
        <div className="workspace-contract-summary">
          <span className="workspace-contract-label">Contract</span>
          <strong title={graphName}>{graphName}</strong>
          <span className={`workspace-contract-state ${issueCount > 0 ? 'is-warning' : 'is-valid'}`}>
            {contractState}
          </span>
          <span className="workspace-contract-counts" aria-label={`${nodeCount} nodes and ${edgeCount} branches`}>
            {nodeCount} nodes · {edgeCount} branches
          </span>
        </div>
        <div className="workspace-command-divider workspace-panel-command-divider" />
        <button
          type="button"
          className={`workspace-library-button ${libraryOpen ? 'is-active' : ''}`}
          aria-label={`Graph library, ${libraryEntryCount} templates`}
          aria-haspopup="dialog"
          aria-expanded={libraryOpen}
          onClick={onOpenLibrary}
        >
          <Books aria-hidden="true" size={15} weight="duotone" />
          <span>Graph library</span>
          <strong aria-hidden="true">{libraryEntryCount}</strong>
        </button>
        <div className="workspace-command-divider workspace-library-command-divider" />
        <div className="workspace-command-group workspace-panel-command-group" role="group" aria-label="Panel controls">
          <HeaderIconButton label={paletteOpen ? 'Hide inventory' : 'Show inventory'} icon={SidebarSimple} active={paletteOpen} onClick={onTogglePalette} />
          <HeaderIconButton label={inspectorOpen ? 'Hide inspector' : 'Show inspector'} icon={SidebarSimple} active={inspectorOpen} mirrored onClick={onToggleInspector} />
        </div>
        <div className="workspace-command-divider workspace-edit-command-divider" />
        <div className="workspace-command-group workspace-view-command-group" role="radiogroup" aria-label="Canvas projection">
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'design'}
            className={`workspace-view-button ${viewMode === 'design' ? 'is-active' : ''}`}
            onClick={() => onViewModeChange('design')}
          >
            Design
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'runtime'}
            aria-label={
              runtimeAvailable
                ? 'Runtime'
                : `Runtime unavailable: ${runtimeUnavailableReason ?? 'No runtime trace or fixture is available.'}`
            }
            className={`workspace-view-button ${viewMode === 'runtime' ? 'is-active' : ''}`}
            disabled={!runtimeAvailable}
            title={runtimeAvailable ? 'Show observed runtime instances' : runtimeUnavailableReason}
            onClick={() => onViewModeChange('runtime')}
          >
            Runtime
          </button>
        </div>
        <div className="workspace-command-divider workspace-view-command-divider" />
        <div className="workspace-command-group workspace-edit-command-group" role="group" aria-label="Edit controls">
          <HeaderIconButton label="Duplicate selection" icon={Copy} disabled={!canDuplicate} onClick={onDuplicate} />
          <HeaderIconButton label="Delete selection" icon={Trash} disabled={!canDelete} tone="danger" onClick={onDelete} />
        </div>
        <div className="workspace-command-divider workspace-canvas-command-divider" />
        <div className="workspace-command-group workspace-canvas-command-group" role="group" aria-label="Canvas controls">
          <HeaderIconButton label="Fit graph" icon={FrameCorners} onClick={onFit} />
          <HeaderIconButton label="Reset example graph" icon={ArrowsClockwise} disabled={proposalPending} onClick={onReset} />
        </div>
      </section>

      <section className="workspace-island workspace-action-island">
        <WebMcpPill status={webMcpStatus} />
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
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`workspace-icon-button ${active ? 'is-active' : ''} ${tone === 'danger' ? 'is-danger' : ''}`}
    >
      <IconComponent aria-hidden="true" size={16} weight="bold" className={mirrored ? '-scale-x-100' : ''} />
    </button>
  );
}

function WebMcpPill({ status }: { status: WebMcpStatus }) {
  const presentation = {
    unavailable: ['Browser preview', 'is-warning'],
    registering: ['Connecting', 'is-progress'],
    connected: ['WebMCP · 3 tools', 'is-connected'],
    error: ['WebMCP error', 'is-error'],
  }[status];

  return (
    <div className={`workspace-webmcp ${presentation[1]}`} title={presentation[0]}>
      <span className="workspace-webmcp-dot" />
      <span>{presentation[0]}</span>
      <GitBranch aria-hidden="true" size={13} weight="bold" />
    </div>
  );
}
