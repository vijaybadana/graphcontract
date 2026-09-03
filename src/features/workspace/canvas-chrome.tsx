import {
  CheckCircle,
  CirclesThreePlus,
  HourglassHigh,
  LockSimple,
  Path,
  ShareNetwork,
  WarningCircle,
} from '@phosphor-icons/react';

import { enumerateScenariosBounded, type WorkflowGraph } from '@/src/domain';

import './canvas-chrome.css';

/**
 * Frozen scenarios are the persisted source of truth. While authoring, the
 * status strip previews that same bounded domain enumeration without mutating
 * workspace state or unlocking the Scenario review surface.
 */
export function scenarioCountForStatus(graph: WorkflowGraph, frozenScenarioCount: number) {
  if (graph.status === 'frozen') return frozenScenarioCount;
  const enumeration = enumerateScenariosBounded(graph);
  return enumeration.ok ? enumeration.scenarios.length : 0;
}

export function CanvasStatusStrip({
  graph,
  issueCount,
  proposalPending,
  scenarioCount,
}: {
  graph: WorkflowGraph;
  issueCount: number;
  proposalPending: boolean;
  scenarioCount: number;
}) {
  const status = issueCount > 0
    ? {
        kind: 'warning',
        label: `${issueCount} issue${issueCount === 1 ? '' : 's'}`,
        Icon: WarningCircle,
      }
    : proposalPending
      ? { kind: 'pending', label: 'Proposal pending', Icon: HourglassHigh }
      : graph.status === 'frozen'
        ? { kind: 'frozen', label: 'Contract frozen', Icon: LockSimple }
        : { kind: 'healthy', label: 'Ready to freeze', Icon: CheckCircle };
  const StatusIcon = status.Icon;
  const displayedScenarioCount = scenarioCountForStatus(graph, scenarioCount);

  return (
    <div className="canvas-status-strip" aria-label="Graph status">
      <span><CirclesThreePlus aria-hidden="true" size={12} weight="bold" /><strong>{graph.nodes.length}</strong> nodes</span>
      <span><ShareNetwork aria-hidden="true" size={12} weight="bold" /><strong>{graph.edges.length}</strong> edges</span>
      <span><Path aria-hidden="true" size={12} weight="bold" /><strong>{displayedScenarioCount}</strong> scenarios</span>
      <span className={`is-${status.kind}`}><StatusIcon aria-hidden="true" size={12} weight="fill" />{status.label}</span>
    </div>
  );
}
