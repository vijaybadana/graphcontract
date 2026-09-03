'use client';

import { CheckCircle, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { graphLibrarySourceLabel, type GraphLibraryEntry } from '@/src/application/graph-library-contract';
import { GitHubBrandMark } from '@/src/features/brand/github-brand-mark';

import './graph-library-sheet.css';

export type GraphLibrarySheetProps = {
  open: boolean;
  entries: readonly GraphLibraryEntry[];
  currentLoadedId?: string | null;
  /** Existing canvas content requires an explicit in-product replacement confirmation. */
  confirmationRequired?: boolean;
  /** A pending proposal or frozen graph prevents replacement at the application boundary. */
  replacementBlockedReason?: string | null;
  onRequestOpen: (entry: GraphLibraryEntry) => void;
  onClose: () => void;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

function isSafeGithubUrl(value: string): value is `https://github.com/${string}` {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

function focusableElements(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((candidate) => !candidate.hasAttribute('disabled') && candidate.getAttribute('aria-hidden') !== 'true');
}

/**
 * A presentation-only, controlled Graph Library. Graph selection is delegated
 * to the application boundary so browsing and source links cannot mutate state.
 */
export function GraphLibrarySheet({
  open,
  entries,
  currentLoadedId,
  confirmationRequired = true,
  replacementBlockedReason,
  onRequestOpen,
  onClose,
}: GraphLibrarySheetProps) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingEntry, setPendingEntry] = useState<GraphLibraryEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const pendingTriggerRef = useRef<HTMLElement | null>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  const domains = useMemo(
    () => [...new Set(entries.map((entry) => entry.domain))].sort((left, right) => left.localeCompare(right)),
    [entries],
  );
  const availableConcepts = useMemo(
    () => [...new Set(entries.flatMap((entry) => entry.concepts))].sort((left, right) => left.localeCompare(right)),
    [entries],
  );
  const visibleEntries = useMemo(() => {
    const search = normalized(query);
    return entries.filter((entry) => {
      const searchable = [
        entry.title,
        entry.outcome,
        entry.domain,
        entry.source.owner,
        entry.source.repository,
        ...entry.concepts,
      ].join(' ').toLocaleLowerCase();
      return (!search || searchable.includes(search))
        && (!domain || entry.domain === domain)
        && [...concepts].every((concept) => entry.concepts.includes(concept));
    });
  }, [concepts, domain, entries, query]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      priorFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    if (!open && wasOpenRef.current && priorFocusRef.current?.isConnected) {
      priorFocusRef.current.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  const resetFilters = () => {
    setQuery('');
    setDomain(null);
    setConcepts(new Set());
  };

  const requestClose = () => {
    setPendingEntry(null);
    onClose();
    requestAnimationFrame(() => {
      if (priorFocusRef.current?.isConnected) priorFocusRef.current.focus();
    });
  };

  const requestEntryOpen = (entry: GraphLibraryEntry, trigger: HTMLElement) => {
    if (!confirmationRequired) {
      onRequestOpen(entry);
      return;
    }
    pendingTriggerRef.current = trigger;
    setPendingEntry(entry);
    requestAnimationFrame(() => confirmationCancelRef.current?.focus());
  };

  const cancelEntryOpen = () => {
    setPendingEntry(null);
    requestAnimationFrame(() => {
      if (pendingTriggerRef.current?.isConnected) pendingTriggerRef.current.focus();
    });
  };

  const confirmEntryOpen = () => {
    if (!pendingEntry) return;
    const entry = pendingEntry;
    setPendingEntry(null);
    onRequestOpen(entry);
  };

  const toggleConcept = (concept: string) => {
    setConcepts((active) => {
      const next = new Set(active);
      if (next.has(concept)) next.delete(concept);
      else next.add(concept);
      return next;
    });
  };

  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = focusableElements(dialogRef.current);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onConfirmationKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEntryOpen();
      return;
    }
    if (event.key !== 'Tab' || !confirmationRef.current) return;
    const focusable = focusableElements(confirmationRef.current);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="graph-library-sheet"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <aside
        ref={dialogRef}
        className="graph-library-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Graph library"
        onKeyDown={onDialogKeyDown}
      >
        <div className="graph-library-sheet__toolbar">
          <div className="graph-library-sheet__search">
            <MagnifyingGlass aria-hidden="true" size={17} weight="bold" />
            <label className="sr-only" htmlFor="graph-library-search">Search graph library</label>
            <input
              ref={searchRef}
              id="graph-library-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, source, domain, outcome, or concept"
              autoComplete="off"
            />
          </div>
          <button className="graph-library-sheet__close" type="button" aria-label="Close graph library" onClick={requestClose}>
            <X aria-hidden="true" size={18} weight="bold" />
          </button>
        </div>

        {replacementBlockedReason && (
          <p className="graph-library-sheet__blocked" role="status">
            {replacementBlockedReason}
          </p>
        )}

        <div className="graph-library-sheet__filters" aria-label="Graph library filters">
          <div className="graph-library-sheet__filter-row">
            <span>Domain</span>
            <button type="button" className={!domain ? 'is-selected' : ''} aria-pressed={!domain} onClick={() => setDomain(null)}>All</button>
            {domains.map((item) => (
              <button key={item} type="button" className={domain === item ? 'is-selected' : ''} aria-pressed={domain === item} onClick={() => setDomain(domain === item ? null : item)}>{item}</button>
            ))}
          </div>
          <div className="graph-library-sheet__filter-row">
            <span>Concept</span>
            {availableConcepts.map((item) => (
              <button key={item} type="button" className={concepts.has(item) ? 'is-selected' : ''} aria-pressed={concepts.has(item)} onClick={() => toggleConcept(item)}>{item}</button>
            ))}
          </div>
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Showing {visibleEntries.length} of {entries.length} templates
        </div>

        {visibleEntries.length ? (
          <div className="graph-library-sheet__cards" aria-label="Graph library templates">
            {visibleEntries.map((entry) => (
              <GraphLibraryCard
                key={entry.id}
                entry={entry}
                isCurrent={entry.id === currentLoadedId}
                disabledReason={replacementBlockedReason}
                onRequestOpen={requestEntryOpen}
              />
            ))}
          </div>
        ) : (
          <section className="graph-library-sheet__empty" aria-labelledby="graph-library-empty-title">
            <h3 id="graph-library-empty-title">No matching templates</h3>
            <p>Try a different source, domain, or concept. Your existing graph remains unchanged while browsing.</p>
            <button type="button" onClick={resetFilters}>Clear search and filters</button>
          </section>
        )}

      </aside>
      {pendingEntry && (
        <div className="graph-library-confirmation" role="presentation">
          <div
            ref={confirmationRef}
            className="graph-library-confirmation__dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="graph-library-confirmation-title"
            aria-describedby="graph-library-confirmation-description"
            onKeyDown={onConfirmationKeyDown}
          >
            <p className="graph-library-confirmation__eyebrow">Replace current canvas</p>
            <h2 id="graph-library-confirmation-title">Open “{pendingEntry.title}”?</h2>
            <p id="graph-library-confirmation-description">
              This opens an editable normalized template. One Undo restores your current workflow.
            </p>
            <div className="graph-library-confirmation__actions">
              <button ref={confirmationCancelRef} type="button" onClick={cancelEntryOpen}>Cancel</button>
              <button className="is-primary" type="button" onClick={confirmEntryOpen}>Replace canvas</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function GraphLibraryCard({
  entry,
  isCurrent,
  disabledReason,
  onRequestOpen,
}: {
  entry: GraphLibraryEntry;
  isCurrent: boolean;
  disabledReason?: string | null;
  onRequestOpen: (entry: GraphLibraryEntry, trigger: HTMLElement) => void;
}) {
  const sourceLabel = graphLibrarySourceLabel(entry.source);
  const sourceUrl = isSafeGithubUrl(entry.source.url) ? entry.source.url : null;
  const actionLabel = disabledReason ? `Open ${entry.title} unavailable: ${disabledReason}` : `Open ${entry.title}`;

  return (
    <article className={`graph-library-card ${isCurrent ? 'is-current' : ''}`} data-entry-id={entry.id}>
      <button
        type="button"
        className="graph-library-card__activation"
        aria-label={actionLabel}
        aria-describedby={`graph-library-card-outcome-${entry.id}`}
        disabled={Boolean(disabledReason)}
        onClick={(event) => onRequestOpen(entry, event.currentTarget)}
      >
        <GraphTopologyThumbnail entry={entry} />
        <span className="graph-library-card__body">
          <span className="graph-library-card__title-row">
            <strong>{entry.title}</strong>
            {isCurrent && <span className="graph-library-card__current"><CheckCircle aria-hidden="true" size={14} weight="fill" /> Loaded</span>}
          </span>
          <span id={`graph-library-card-outcome-${entry.id}`} className="graph-library-card__outcome">{entry.outcome}</span>
          <span className="graph-library-card__chips">
            <span className="graph-library-card__domain">{entry.domain}</span>
            {entry.concepts.map((concept) => <span key={concept}>{concept}</span>)}
            <span className="graph-library-card__complexity">{entry.complexity}</span>
          </span>
        </span>
      </button>
      <footer className="graph-library-card__footer">
        <span className="graph-library-card__source">
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${sourceLabel} on GitHub`}>
              <GitHubBrandMark className="graph-library-card__github-mark" size={17} />
              <span><strong>GitHub</strong> · {sourceLabel}</span>
            </a>
          ) : (
            <span title="The source URL is unavailable because it is not a supported GitHub repository URL.">{sourceLabel}</span>
          )}
        </span>
      </footer>
    </article>
  );
}

/** A small, graph-derived topology projection; no repository media is used. */
export function GraphTopologyThumbnail({ entry }: { entry: Pick<GraphLibraryEntry, 'graph' | 'title'> }) {
  const { nodes, subgraphs } = topologyGeometry(entry.graph);
  const positions = nodes;
  const byId = new Map(positions.map((position) => [position.id, position]));
  return (
    <svg className="graph-library-topology" viewBox="0 0 164 88" role="img" aria-label={`${entry.title} topology`}>
      {subgraphs.map((subgraph) => (
        <rect key={subgraph.id} x={subgraph.x} y={subgraph.y} width={subgraph.width} height={subgraph.height} rx="5" />
      ))}
      {entry.graph.edges.map((edge) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return null;
        return <path key={edge.id} d={`M ${source.x} ${source.y} L ${target.x} ${target.y}`} className={edge.mode === 'send' ? 'is-send' : ''} />;
      })}
      {positions.map((node) => <circle key={node.id} cx={node.x} cy={node.y} r={node.kind === 'merge' ? 5.5 : 4.5} className={`is-${node.kind}`} />)}
    </svg>
  );
}

function topologyGeometry(graph: GraphLibraryEntry['graph']) {
  const parentById = new Map(graph.subgraphs.map((subgraph) => [subgraph.id, subgraph]));
  const absoluteNodes = graph.nodes.map((node) => {
    const parent = node.parentId ? parentById.get(node.parentId) : undefined;
    return {
      id: node.id,
      kind: node.kind,
      x: node.position.x + (parent?.position.x ?? 0),
      y: node.position.y + (parent?.position.y ?? 0),
    };
  });
  if (!absoluteNodes.length) return { nodes: [], subgraphs: [] };
  const xValues = [
    ...absoluteNodes.map((node) => node.x),
    ...graph.subgraphs.flatMap((subgraph) => [subgraph.position.x, subgraph.position.x + subgraph.dimensions.width]),
  ];
  const yValues = [
    ...absoluteNodes.map((node) => node.y),
    ...graph.subgraphs.flatMap((subgraph) => [subgraph.position.y, subgraph.position.y + subgraph.dimensions.height]),
  ];
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const projectX = (x: number) => 14 + ((x - minX) / xRange) * 136;
  const projectY = (y: number) => 14 + ((y - minY) / yRange) * 60;
  return {
    nodes: absoluteNodes.map((node, index) => ({
      ...node,
      x: absoluteNodes.length === 1 ? 82 : projectX(node.x),
      y: absoluteNodes.length === 1
        ? 44
        : projectY(node.y) + (maxY === minY ? ((index % 3) - 1) * 13 : 0),
    })),
    subgraphs: graph.subgraphs.map((subgraph) => ({
      id: subgraph.id,
      x: projectX(subgraph.position.x),
      y: projectY(subgraph.position.y),
      width: Math.max(12, (subgraph.dimensions.width / xRange) * 136),
      height: Math.max(12, (subgraph.dimensions.height / yRange) * 60),
    })),
  };
}
