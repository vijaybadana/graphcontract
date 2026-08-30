'use client';

import { ArrowSquareOut, CheckCircle, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  GRAPH_LIBRARY_DISCLAIMER,
  graphLibrarySourceLabel,
  type GraphLibraryEntry,
} from '@/src/application/graph-library-contract';

import './graph-library-sheet.css';

export type GraphLibrarySheetProps = {
  open: boolean;
  entries: readonly GraphLibraryEntry[];
  currentLoadedId?: string | null;
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
  replacementBlockedReason,
  onRequestOpen,
  onClose,
}: GraphLibrarySheetProps) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<ReadonlySet<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

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
    onClose();
    requestAnimationFrame(() => {
      if (priorFocusRef.current?.isConnected) priorFocusRef.current.focus();
    });
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
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={onDialogKeyDown}
      >
        <header className="graph-library-sheet__header">
          <div>
            <p className="graph-library-sheet__eyebrow">Workflow templates</p>
            <h2 id={titleId}>Graph library</h2>
            <p id={descriptionId}>{entries.length} graph templates, normalized into editable GraphContract workflows.</p>
          </div>
          <button className="graph-library-sheet__close" type="button" aria-label="Close graph library" onClick={requestClose}>
            <X aria-hidden="true" size={18} weight="bold" />
          </button>
        </header>

        {replacementBlockedReason && (
          <p className="graph-library-sheet__blocked" role="status">
            {replacementBlockedReason}
          </p>
        )}

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

        <div className="graph-library-sheet__results-summary" aria-live="polite" aria-atomic="true">
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
                onRequestOpen={onRequestOpen}
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
  onRequestOpen: (entry: GraphLibraryEntry) => void;
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
        onClick={() => onRequestOpen(entry)}
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
          <span className="graph-library-card__open-label">Open graph</span>
        </span>
      </button>
      <footer className="graph-library-card__footer">
        <span className="graph-library-card__source">
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${sourceLabel} on GitHub`}>
              {sourceLabel} <ArrowSquareOut aria-hidden="true" size={13} weight="bold" />
            </a>
          ) : (
            <span title="The source URL is unavailable because it is not a supported GitHub repository URL.">{sourceLabel}</span>
          )}
        </span>
        <span>{GRAPH_LIBRARY_DISCLAIMER}</span>
        {entry.source.note && <span className="graph-library-card__source-note">{entry.source.note}</span>}
      </footer>
    </article>
  );
}

/** A small, graph-derived topology projection; no repository media is used. */
export function GraphTopologyThumbnail({ entry }: { entry: Pick<GraphLibraryEntry, 'graph'> }) {
  const { nodes, subgraphs } = topologyGeometry(entry.graph);
  const positions = nodes;
  const byId = new Map(positions.map((position) => [position.id, position]));
  return (
    <svg className="graph-library-topology" viewBox="0 0 164 88" role="img" aria-label={`${entry.graph.name} topology`}>
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
