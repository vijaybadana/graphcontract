import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  DownloadSimpleIcon,
  PathIcon,
} from '@phosphor-icons/react';

import {
  buildGraphContractDownload,
  buildGraphScenariosDownload,
  buildPythonTestsDownload,
  DownloadArtifact,
} from '@/src/adapters/exports/downloads';
import { BranchScenario, WorkflowGraph } from '@/src/domain';
import { graphNodeVisualKind, NodeVisualIcon } from '@/src/features/canvas/node-visual-taxonomy';
import { ModePanelShell, ModePathStrip } from '@/src/features/workspace/mode-panel';
import {
  scenarioDecisionsFor,
  scenarioPlaybackRequestFor,
  scenarioTerminalLabelFor,
  type ScenarioPlaybackRequest,
} from './scenario-presentation';
import './scenario-presentation.css';

type ScenarioPanelProps = {
  graph: WorkflowGraph;
  scenarios: BranchScenario[];
  selectedScenarioId?: string | null;
  onScenarioSelect?: (scenarioId: string | null) => void;
  /** Ephemeral ordered playback only; the workspace owns the canvas projection. */
  onScenarioReplay?: (request: ScenarioPlaybackRequest) => void;
  onCollapse?: () => void;
};

const SCENARIO_PAGE_SIZE = 24;

const downloadLabel = (artifact: DownloadArtifact) => {
  if (artifact.filename === 'graph-contract.json') return 'JSON';
  if (artifact.filename === 'graph-test-scenarios.json') return 'Tests';
  if (artifact.filename === 'test_graph_paths.py') return 'Python';
  return artifact.filename;
};

export function ScenarioPanel({
  graph,
  scenarios,
  selectedScenarioId,
  onScenarioSelect,
  onScenarioReplay,
  onCollapse = () => {},
}: ScenarioPanelProps) {
  const [localSelectedScenarioId, setLocalSelectedScenarioId] = useState<string | null>(null);
  const [requestedPageIndex, setRequestedPageIndex] = useState(0);
  const pageStatusRef = useRef<HTMLParagraphElement>(null);
  const focusPageStatusAfterRenderRef = useRef(false);
  const replayIdRef = useRef(0);
  const activeScenarioId = selectedScenarioId === undefined
    ? localSelectedScenarioId
    : selectedScenarioId;
  const pageCount = Math.max(1, Math.ceil(scenarios.length / SCENARIO_PAGE_SIZE));
  const pageIndex = Math.min(requestedPageIndex, pageCount - 1);
  const pageStart = pageIndex * SCENARIO_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + SCENARIO_PAGE_SIZE, scenarios.length);
  const visibleScenarios = scenarios.slice(pageStart, pageEnd);
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
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
  const downloads = useMemo(
    () => [
      buildGraphContractDownload(graph),
      buildGraphScenariosDownload(graph, scenarios),
      buildPythonTestsDownload(graph, scenarios),
    ],
    [graph, scenarios],
  );
  const requestScenarioReplay = (scenarioId: string) => {
    const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
    if (!scenario || !onScenarioReplay) return;
    onScenarioReplay(scenarioPlaybackRequestFor(
      scenario,
      ++replayIdRef.current,
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    ));
  };
  const selectScenario = (scenarioId: string) => {
    const nextScenarioId = activeScenarioId === scenarioId ? null : scenarioId;
    if (selectedScenarioId === undefined) setLocalSelectedScenarioId(nextScenarioId);
    onScenarioSelect?.(nextScenarioId);
    if (nextScenarioId) requestScenarioReplay(scenarioId);
  };
  const showPage = (nextPageIndex: number) => {
    focusPageStatusAfterRenderRef.current = true;
    setRequestedPageIndex(Math.max(0, Math.min(nextPageIndex, pageCount - 1)));
  };

  useLayoutEffect(() => {
    if (!focusPageStatusAfterRenderRef.current) return;
    focusPageStatusAfterRenderRef.current = false;
    pageStatusRef.current?.focus();
  }, [pageIndex]);

  if (graph.status !== 'frozen') {
    return (
      <ModePanelShell title="Scenarios" icon={<PathIcon size={16} weight="bold" />} tone="scenario" badge="Draft" onCollapse={onCollapse}>
        <div className="mode-panel__section"><p className="mode-panel__empty">Freeze a valid contract to generate bounded deterministic scenarios.</p></div>
      </ModePanelShell>
    );
  }

  return (
    <ModePanelShell
      title="Scenarios"
      icon={<PathIcon size={16} weight="bold" />}
      tone="scenario"
      badge={`${scenarios.length} paths`}
      onCollapse={onCollapse}
      footer={(
        <div className="scenario-panel__footer">
          <div className="scenario-panel__downloads" aria-label="Contract downloads">
            {downloads.map((download) => <DownloadLink key={download.filename} artifact={download} />)}
          </div>
          {pageCount > 1 && (
            <nav className="scenario-pagination__controls" aria-label="Scenario pages">
              <button type="button" disabled={pageIndex === 0} aria-label="Previous scenario page" onClick={() => showPage(pageIndex - 1)}><CaretLeftIcon size={15} weight="bold" aria-hidden="true" /></button>
              <span aria-label={`Page ${pageIndex + 1} of ${pageCount}`}>{pageIndex + 1} / {pageCount}</span>
              <button type="button" disabled={pageIndex === pageCount - 1} aria-label="Next scenario page" onClick={() => showPage(pageIndex + 1)}><CaretRightIcon size={15} weight="bold" aria-hidden="true" /></button>
            </nav>
          )}
        </div>
      )}
    >
      {scenarios.length > 0 && (
        <p
          ref={pageStatusRef}
          className="mode-panel__visually-hidden scenario-pagination__status"
          tabIndex={-1}
          aria-live="polite"
        >
          Showing {pageStart + 1}–{pageEnd} of {scenarios.length} scenarios. Page {pageIndex + 1} of {pageCount}.
        </p>
      )}
      <div className="scenario-panel__list" role="list" aria-label="Generated scenarios">
        {visibleScenarios.map((scenario, index) => {
          const expanded = activeScenarioId === scenario.id;
          const detailsId = `scenario-details-${scenario.id}`;
          const decisions = scenarioDecisionsFor(scenario);
          const terminalLabel = scenarioTerminalLabelFor(graph, scenario);
          const loopCount = scenario.traversedEdges.filter((edge) => edge.isLoop).length;
          return (
            <article
              key={scenario.id}
              className={`scenario-row ${expanded ? 'is-selected' : ''}`}
              role="listitem"
            >
              <button
                type="button"
                className="scenario-row__select"
                data-scenario-id={scenario.id}
                aria-pressed={expanded}
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => selectScenario(scenario.id)}
              >
                <span className="scenario-row__heading"><strong>Path {pageStart + index + 1}</strong><small>{terminalLabel}</small></span>
                <span className={`scenario-row__path ${expanded ? 'is-expanded' : ''}`}>
                  <ModePathStrip
                    items={pathItems(scenario)}
                    expanded={expanded}
                    loopCount={loopCount}
                  />
                </span>
              </button>
              {expanded && (
                <div id={detailsId} className="scenario-row__expanded" aria-label={`Path ${pageStart + index + 1} details`}>
                  <dl>
                    <div>
                      <dt>Decisions</dt>
                      <dd>
                        {decisions.length > 0 ? (
                          <ul className="scenario-row__decisions">
                            {decisions.map((decision) => (
                              <li key={decision.id} data-decision-kind={decision.kind}>
                                <span>{decision.sourceLabel}</span><strong> — {decision.valueLabel}</strong>
                              </li>
                            ))}
                          </ul>
                        ) : 'No routing decision'}
                      </dd>
                    </div>
                    {loopCount > 0 && <div><dt>Loop</dt><dd>Traversed {loopCount}× within the configured bound</dd></div>}
                    <div>
                      <dt>Ends at</dt>
                      <dd>
                        <span>{terminalLabel}</span>
                        <button
                          type="button"
                          className="mode-panel__action scenario-row__replay"
                          aria-label={`Replay path ${pageStart + index + 1}`}
                          title="Replay path"
                          onClick={() => requestScenarioReplay(scenario.id)}
                        >
                          <ArrowCounterClockwiseIcon size={14} weight="bold" aria-hidden="true" />
                        </button>
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </ModePanelShell>
  );
}

function DownloadLink({ artifact }: { artifact: DownloadArtifact }) {
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    const url = URL.createObjectURL(new Blob([artifact.content], { type: artifact.type }));
    const anchor = anchorRef.current;
    if (!anchor) {
      URL.revokeObjectURL(url);
      return;
    }

    // The visible native anchor owns a ready Blob URL before the click. This
    // lets Chromium consume the real user gesture instead of relying on a
    // synthetic nested click or a same-event href mutation.
    anchor.href = url;
    return () => {
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    };
  }, [artifact.content, artifact.type]);

  return (
    <a
      ref={anchorRef}
      href="#download"
      download={artifact.filename}
      aria-label={`Download ${artifact.filename}`}
      title={`Download ${artifact.filename}`}
      className="download-button scenario-panel__download"
    >
      <DownloadSimpleIcon size={13} weight="bold" aria-hidden="true" />
      <span>{downloadLabel(artifact)}</span>
    </a>
  );
}
