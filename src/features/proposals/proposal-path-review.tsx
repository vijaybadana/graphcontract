'use client';

import { CaretDownIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';

import { proposalScenarioKey } from '@/src/application/proposal-review';
import type { BranchScenario, WorkflowGraph } from '@/src/domain';
import { graphNodeVisualKind, NodeVisualIcon } from '@/src/features/canvas/node-visual-taxonomy';
import { scenarioDecisionsFor, scenarioTerminalLabelFor } from '@/src/features/scenarios/scenario-presentation';
import { ModePathStrip } from '@/src/features/workspace/mode-panel';
import { ReviewNoteComposer } from './review-note-composer';

import '@/src/features/scenarios/scenario-presentation.css';

const PAGE_SIZE = 24;

export function ProposalPathReview({
  graph,
  scenarios,
  activePathKey,
  notes,
  disabled = false,
  onPathSelect,
  onNoteSave,
  onNoteRemove,
}: {
  graph: WorkflowGraph;
  scenarios: BranchScenario[];
  activePathKey: string | null;
  notes: ReadonlyMap<string, string>;
  disabled?: boolean;
  onPathSelect: (scenario: BranchScenario | null) => void;
  onNoteSave: (targetKey: string, feedback: string) => void;
  onNoteRemove: (targetKey: string) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [pageIndex, setPageIndex] = useState(0);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const outcomes = useMemo(() => {
    const counts = new Map<string, number>();
    scenarios.forEach((scenario) => {
      const label = scenarioTerminalLabelFor(graph, scenario);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [graph, scenarios]);
  const filtered = outcomeFilter === 'all'
    ? scenarios
    : scenarios.filter((scenario) => scenarioTerminalLabelFor(graph, scenario) === outcomeFilter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = safePageIndex * PAGE_SIZE;
  const visible = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const pathItems = (scenario: BranchScenario) => scenario.orderedPath.map((nodeId) => {
    const node = nodeById.get(nodeId);
    const kind = node ? graphNodeVisualKind(node) : 'task';
    return {
      id: nodeId,
      label: node?.label ?? nodeId,
      icon: <NodeVisualIcon kind={kind} size={12} weight="bold" />,
      tone: kind,
    };
  });

  return (
    <section className="proposal-path-review" aria-label="Proposed paths">
      <div className="proposal-review-filters" aria-label="Filter paths by outcome">
        <button type="button" aria-pressed={outcomeFilter === 'all'} onClick={() => { setOutcomeFilter('all'); setPageIndex(0); }}>All <span>{scenarios.length}</span></button>
        {outcomes.map(([outcome, count]) => (
          <button key={outcome} type="button" aria-pressed={outcomeFilter === outcome} onClick={() => { setOutcomeFilter(outcome); setPageIndex(0); }}>
            {outcome} <span>{count}</span>
          </button>
        ))}
      </div>
      {filtered.length > 0 && <p className="scenario-pagination__status">Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} · Page {safePageIndex + 1} of {pageCount}</p>}
      <div className="scenario-panel__list" role="list" aria-label="Candidate graph paths">
        {visible.map((scenario, index) => {
          const key = proposalScenarioKey(scenario);
          const expanded = expandedKey === key;
          const selected = activePathKey === key;
          const terminalLabel = scenarioTerminalLabelFor(graph, scenario);
          const loopCount = scenario.traversedEdges.filter((edge) => edge.isLoop).length;
          const decisions = scenarioDecisionsFor(scenario);
          const detailsId = `proposal-path-${pageStart + index}-details`;
          return (
            <article key={key} className={`scenario-row ${selected ? 'is-selected' : ''} ${expanded ? 'is-expanded' : ''}`} role="listitem">
              <div className="scenario-row__summary">
                <button type="button" className="scenario-row__select" aria-pressed={selected} onClick={() => onPathSelect(selected ? null : scenario)}>
                  <span className="scenario-row__heading"><strong>Path {pageStart + index + 1}</strong><small>{terminalLabel}</small></span>
                  <span className={`scenario-row__path ${expanded ? 'is-expanded' : ''}`}><ModePathStrip items={pathItems(scenario)} expanded={expanded} loopCount={loopCount} /></span>
                </button>
                <button type="button" className="scenario-row__disclosure" aria-label={`${expanded ? 'Hide' : 'Show'} details for path ${pageStart + index + 1}`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpandedKey(expanded ? null : key)}>
                  <CaretDownIcon size={14} weight="bold" aria-hidden="true" />
                </button>
              </div>
              {expanded && (
                <div id={detailsId} className="scenario-row__expanded">
                  <dl>
                    <div><dt>Decisions</dt><dd>{decisions.length > 0 ? decisions.map((decision) => `${decision.sourceLabel}: ${decision.valueLabel}`).join(' · ') : 'No routing decision'}</dd></div>
                    {loopCount > 0 && <div><dt>Loop</dt><dd>Traversed {loopCount}× within the configured bound</dd></div>}
                    <div><dt>Outcome</dt><dd>{terminalLabel}</dd></div>
                  </dl>
                  <ReviewNoteComposer
                    label="Add path note"
                    placeholder="What should change on this path?"
                    value={notes.get(key)}
                    disabled={disabled}
                    onSave={(feedback) => onNoteSave(key, feedback)}
                    onRemove={() => onNoteRemove(key)}
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
      {pageCount > 1 && (
        <nav className="scenario-pagination__controls proposal-path-review__pagination" aria-label="Candidate path pages">
          <button type="button" disabled={safePageIndex === 0} aria-label="Previous path page" onClick={() => setPageIndex(safePageIndex - 1)}><CaretLeftIcon size={15} weight="bold" /></button>
          <span>{safePageIndex + 1} / {pageCount}</span>
          <button type="button" disabled={safePageIndex === pageCount - 1} aria-label="Next path page" onClick={() => setPageIndex(safePageIndex + 1)}><CaretRightIcon size={15} weight="bold" /></button>
        </nav>
      )}
    </section>
  );
}
