import { CheckCircle, GitBranch, Selection, Snowflake, WarningCircle } from '@phosphor-icons/react';

import type { WorkflowGraph } from '@/src/domain';

import './canvas-chrome.css';

export function CanvasInstructionStrip({
  editable,
  runtimeMode = false,
}: {
  editable: boolean;
  runtimeMode?: boolean;
}) {
  return (
    <div className="canvas-instruction-strip" role="note">
      {editable ? (
        <>
          <span>Drag nodes to arrange</span>
          <span>Shift-drag to multi-select</span>
          <span>Connect from Node ports</span>
        </>
      ) : runtimeMode ? (
        <span>Runtime projection · observed instances are read-only and do not change the contract</span>
      ) : (
        <span>Review mode · graph editing is temporarily locked</span>
      )}
    </div>
  );
}

export function CanvasStatusStrip({
  graph,
  issueCount,
  selectionCount,
  proposalPending,
  scenarioCount,
}: {
  graph: WorkflowGraph;
  issueCount: number;
  selectionCount: number;
  proposalPending: boolean;
  scenarioCount: number;
}) {
  const health = proposalPending
    ? 'Proposal review'
    : issueCount > 0
      ? `${issueCount} issue${issueCount === 1 ? '' : 's'}`
      : graph.status === 'frozen'
        ? `${scenarioCount} frozen path${scenarioCount === 1 ? '' : 's'}`
        : 'Contract valid';
  const HealthIcon = issueCount > 0 ? WarningCircle : graph.status === 'frozen' ? Snowflake : CheckCircle;

  return (
    <div className="canvas-status-strip" aria-label="Graph status">
      <span><strong>{graph.nodes.length}</strong> nodes</span>
      <span><GitBranch aria-hidden="true" size={12} weight="bold" /><strong>{graph.edges.length}</strong> branches</span>
      {selectionCount > 0 && <span><Selection aria-hidden="true" size={12} weight="bold" /><strong>{selectionCount}</strong> selected</span>}
      <span className={issueCount > 0 ? 'is-warning' : 'is-healthy'}><HealthIcon aria-hidden="true" size={12} weight="fill" />{health}</span>
    </div>
  );
}
