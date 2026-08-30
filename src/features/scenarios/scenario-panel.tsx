import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  buildGraphContractDownload,
  buildGraphScenarioDownload,
  buildGraphScenariosDownload,
  buildPythonScenarioDownload,
  buildPythonTestsDownload,
  DownloadArtifact,
} from '@/src/adapters/exports/downloads';
import { BranchScenario, WorkflowGraph } from '@/src/domain';
import './scenario-presentation.css';

type ScenarioPanelProps = {
  graph: WorkflowGraph;
  scenarios: BranchScenario[];
  selectedScenarioId?: string | null;
  onScenarioSelect?: (scenarioId: string | null) => void;
};

const outcomeLabel = (scenario: BranchScenario) =>
  scenario.expectedTerminalOutcome.detail?.trim() ||
  scenario.expectedTerminalOutcome.kind.replaceAll('-', ' ');

export function ScenarioPanel({
  graph,
  scenarios,
  selectedScenarioId,
  onScenarioSelect,
}: ScenarioPanelProps) {
  const [localSelectedScenarioId, setLocalSelectedScenarioId] = useState<string | null>(null);
  const activeScenarioId = selectedScenarioId === undefined
    ? localSelectedScenarioId
    : selectedScenarioId;
  const selectedScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? null;
  const nodeLabels = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.label])),
    [graph.nodes],
  );
  const downloads = useMemo(
    () => [
      buildGraphContractDownload(graph),
      buildGraphScenariosDownload(graph, scenarios),
      buildPythonTestsDownload(graph, scenarios),
    ],
    [graph, scenarios],
  );
  const selectedDownloads = useMemo(
    () => selectedScenario
      ? [
          buildGraphScenarioDownload(graph, selectedScenario),
          buildPythonScenarioDownload(graph, selectedScenario),
        ]
      : [],
    [graph, selectedScenario],
  );
  const selectScenario = (scenarioId: string) => {
    const nextScenarioId = activeScenarioId === scenarioId ? null : scenarioId;
    if (selectedScenarioId === undefined) setLocalSelectedScenarioId(nextScenarioId);
    onScenarioSelect?.(nextScenarioId);
  };

  if (graph.status !== 'frozen') {
    return (
      <div className="rounded-2xl border border-dashed border-black/15 bg-white p-5 text-center">
        <p className="text-sm font-semibold">Freeze a valid contract</p>
        <p className="mt-2 text-xs leading-5 text-black/50">Every reachable Start-to-End path will be generated here.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="rounded-2xl bg-[#18211d] p-4 text-white">
        <p className="eyebrow !text-white/50">Frozen contract</p>
        <p className="mt-2 text-2xl font-semibold">{scenarios.length} paths</p>
        <p className="mt-1 text-[11px] leading-5 text-white/60">Bounded deterministic execution scenarios; each loop is traversed at most once per path.</p>
      </div>
      <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto pr-1">
        {scenarios.map((scenario) => (
          <article
            key={scenario.id}
            className={`scenario-row ${activeScenarioId === scenario.id ? 'is-selected' : ''}`}
          >
            <button
              type="button"
              className="scenario-row__select"
              data-scenario-id={scenario.id}
              aria-pressed={activeScenarioId === scenario.id}
              onClick={() => selectScenario(scenario.id)}
            >
              <span className="scenario-row__title">{scenario.name}</span>
              <span className="scenario-row__detail">
                <strong>Conditions</strong>
                <span>
                  {scenario.triggeringConditions.length
                    ? scenario.triggeringConditions.map((condition) => condition.label).join(' · ')
                    : 'Always'}
                </span>
              </span>
              <span className="scenario-row__detail">
                <strong>Ordered path</strong>
                <span>{scenario.orderedPath.map((nodeId) => nodeLabels.get(nodeId) ?? nodeId).join(' → ')}</span>
              </span>
              <span className="scenario-row__detail">
                <strong>Expected outcome</strong>
                <span>{outcomeLabel(scenario)}</span>
              </span>
            </button>
            {activeScenarioId === scenario.id && (
              <div className="scenario-row__downloads" aria-label={`Downloads for ${scenario.name}`}>
                {selectedDownloads.map((download) => (
                  <DownloadLink key={download.filename} artifact={download} compact />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {downloads.map((download) => <DownloadLink key={download.filename} artifact={download} />)}
      </div>
    </section>
  );
}

function DownloadLink({ artifact, compact = false }: { artifact: DownloadArtifact; compact?: boolean }) {
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
      className={compact ? 'scenario-row__download' : 'download-button'}
    >
      Download {artifact.filename}
    </a>
  );
}
