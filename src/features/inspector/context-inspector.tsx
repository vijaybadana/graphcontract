import { useReactFlow } from '@xyflow/react';
import { ReactNode } from 'react';

import './context-inspector.css';

import { GraphEdge, GraphNode, GraphSubgraph } from '@/src/domain';
import {
  InspectorSelect,
  InspectorSelectOption,
} from '@/src/features/inspector/inspector-select';
import { useGraphStore } from '@/src/state/workspace-store';

const hitlTimingOptions: readonly InspectorSelectOption<
  NonNullable<NonNullable<GraphNode['hitl']>['timing']>
>[] = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'conditional', label: 'Conditional' },
];
const hitlInputOptions: readonly InspectorSelectOption<
  NonNullable<NonNullable<GraphNode['hitl']>['inputType']>
>[] = [
  { value: 'approval', label: 'Approval' },
  { value: 'text', label: 'Text' },
  { value: 'selection', label: 'Selection' },
];
const edgeModeOptions: readonly InspectorSelectOption<GraphEdge['mode']>[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'fallback', label: 'Fallback' },
];

const noParentSubgraphValue = '__no_subgraph__';

export function subgraphParentOptions(
  subgraphs: GraphSubgraph[],
): readonly InspectorSelectOption<string>[] {
  return [
    { value: noParentSubgraphValue, label: 'No subgraph' },
    ...subgraphs.map((subgraph) => ({ value: subgraph.id, label: subgraph.label })),
  ];
}

const normalizedDimension = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(160, Math.round(parsed)) : fallback;
};

export function ContextInspector() {
  const graph = useGraphStore((state) => state.graph);
  const proposal = useGraphStore((state) => state.proposal);
  const selection = useGraphStore((state) => state.selection);
  const updateNode = useGraphStore((state) => state.updateNode);
  const updateSubgraph = useGraphStore((state) => state.updateSubgraph);
  const setSubgraphCollapsed = useGraphStore((state) => state.setSubgraphCollapsed);
  const assignNodesToSubgraph = useGraphStore((state) => state.assignNodesToSubgraph);
  const assignNodeToSubgraph = useGraphStore((state) => state.assignNodesToSubgraph);
  const removeNodeFromSubgraph = useGraphStore((state) => state.removeNodeFromSubgraph);
  const dissolveSubgraph = useGraphStore((state) => state.dissolveSubgraph);
  const removeNode = useGraphStore((state) => state.removeNode);
  const duplicateSelection = useGraphStore((state) => state.duplicateSelection);
  const updateEdge = useGraphStore((state) => state.updateEdge);
  const removeEdge = useGraphStore((state) => state.removeEdge);
  const editable = graph.status === 'draft' && !proposal;
  const { fitView } = useReactFlow();
  const primary = selection.primary;
  const node = primary?.type === 'node' ? graph.nodes.find((item) => item.id === primary.id) : undefined;
  const subgraph =
    primary?.type === 'subgraph'
      ? graph.subgraphs.find((item) => item.id === primary.id)
      : undefined;
  const edge = primary?.type === 'edge' ? graph.edges.find((item) => item.id === primary.id) : undefined;
  const selectedNodeIds = selection.nodeIds.filter((nodeId) =>
    graph.nodes.some((node) => node.id === nodeId),
  );
  const parentOptions = subgraphParentOptions(graph.subgraphs);

  return (
    <section className="context-inspector" aria-label="Context inspector">
      <header className="context-inspector__header">
        <p className="context-inspector__eyebrow">Context</p>
        <h2>Inspector</h2>
      </header>
      {!node && !subgraph && !edge && (
        <p className="context-inspector__empty">
          Select a node, subgraph, or edge to configure it. Shift-click or drag-select multiple nodes.
        </p>
      )}
      {selection.nodeIds.length + selection.subgraphIds.length + selection.edgeIds.length > 1 && (
        <p className="context-inspector__selection-summary" role="status" aria-live="polite">
          {selection.nodeIds.length + selection.subgraphIds.length + selection.edgeIds.length} elements selected
        </p>
      )}
      {subgraph && (
        <div className="context-inspector__content">
          <section className="context-inspector__group" aria-labelledby="subgraph-details-heading">
            <h3 id="subgraph-details-heading">Subgraph details</h3>
            <div className="context-inspector__fields">
              <Field label="Label">
                <input
                  value={subgraph.label}
                  disabled={!editable}
                  onChange={(event) => updateSubgraph(subgraph.id, { label: event.target.value })}
                  className="input"
                />
              </Field>
              <label className="context-inspector__toggle-label">
                <span>Collapsed on canvas</span>
                <input
                  type="checkbox"
                  checked={subgraph.collapsed}
                  disabled={!editable}
                  onChange={(event) => setSubgraphCollapsed(subgraph.id, event.target.checked)}
                />
              </label>
              <button
                type="button"
                disabled={!editable}
                aria-expanded={!subgraph.collapsed}
                aria-label={`${subgraph.collapsed ? 'Expand' : 'Collapse'} subgraph ${subgraph.label}`}
                onClick={() => setSubgraphCollapsed(subgraph.id, !subgraph.collapsed)}
                className="secondary-button"
              >
                {subgraph.collapsed ? 'Expand subgraph' : 'Collapse subgraph'}
              </button>
              <div className="context-inspector__two-column-fields">
                <Field label="Width">
                  <input
                    type="number"
                    min="160"
                    step="12"
                    inputMode="numeric"
                    value={subgraph.dimensions.width}
                    disabled={!editable}
                    onChange={(event) =>
                      updateSubgraph(subgraph.id, {
                        dimensions: {
                          ...subgraph.dimensions,
                          width: normalizedDimension(event.target.value, subgraph.dimensions.width),
                        },
                      })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Height">
                  <input
                    type="number"
                    min="160"
                    step="12"
                    inputMode="numeric"
                    value={subgraph.dimensions.height}
                    disabled={!editable}
                    onChange={(event) =>
                      updateSubgraph(subgraph.id, {
                        dimensions: {
                          ...subgraph.dimensions,
                          height: normalizedDimension(event.target.value, subgraph.dimensions.height),
                        },
                      })
                    }
                    className="input"
                  />
                </Field>
              </div>
            </div>
          </section>
          <section className="context-inspector__group context-inspector__group--tinted" aria-labelledby="subgraph-members-heading">
            <div className="context-inspector__toggle-row">
              <h3 id="subgraph-members-heading">Member nodes</h3>
              <span className="context-inspector__member-count">{graph.nodes.filter((node) => node.parentId === subgraph.id).length}</span>
            </div>
            <p className="context-inspector__help">Add a Start and End node before freezing this subgraph.</p>
            <button
              type="button"
              disabled={!editable || selectedNodeIds.length === 0}
              onClick={() => assignNodesToSubgraph(subgraph.id, selectedNodeIds)}
              className="secondary-button context-inspector__member-action"
            >
              Add selected nodes ({selectedNodeIds.length})
            </button>
            <ul className="context-inspector__member-list">
              {graph.nodes
                .filter((node) => node.parentId === subgraph.id)
                .map((member) => (
                  <li key={member.id}>
                    <span>
                      <strong>{member.label}</strong>
                      <small>{member.kind}</small>
                    </span>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => removeNodeFromSubgraph(member.id)}
                      className="secondary-button"
                    >
                      Remove from group
                    </button>
                  </li>
                ))}
              {graph.nodes.every((node) => node.parentId !== subgraph.id) && (
                <li className="context-inspector__member-empty">No member nodes yet.</li>
              )}
            </ul>
          </section>
          <div className="context-inspector__actions">
            <button
              type="button"
              onClick={() => void fitView({ nodes: [{ id: subgraph.id }], duration: 180, padding: 1.4 })}
              className="secondary-button"
            >
              Focus subgraph
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={() => dissolveSubgraph(subgraph.id)}
              className="danger-button"
            >
              Dissolve subgraph — keep child nodes and edges
            </button>
          </div>
        </div>
      )}
      {node && (
        <div className="context-inspector__content">
          <section className="context-inspector__group" aria-labelledby="node-details-heading">
            <h3 id="node-details-heading">Node details</h3>
            <div className="context-inspector__fields">
              <Field label="Label">
                <input value={node.label} disabled={!editable} onChange={(event) => updateNode(node.id, { label: event.target.value })} className="input" />
              </Field>
              <Field label="Description">
                <textarea value={node.description ?? ''} disabled={!editable} onChange={(event) => updateNode(node.id, { description: event.target.value })} className="input min-h-16 resize-y" placeholder="What happens at this step?" />
              </Field>
              <Field label="Parent subgraph">
                <InspectorSelect
                  value={node.parentId ?? noParentSubgraphValue}
                  options={parentOptions}
                  disabled={!editable}
                  onChange={(subgraphId) => {
                    if (subgraphId === noParentSubgraphValue) {
                      removeNodeFromSubgraph(node.id);
                    } else {
                      assignNodeToSubgraph(subgraphId, [node.id]);
                    }
                  }}
                />
                <p className="context-inspector__help">Choose a group or remove this node while keeping its canvas position. Dragging outside a group does not ungroup it.</p>
              </Field>
            </div>
          </section>
          {['agent', 'action', 'tool'].includes(node.kind) && (
            <section className="context-inspector__group context-inspector__group--tinted" aria-labelledby="human-input-heading">
              <div className="context-inspector__toggle-row">
                <h3 id="human-input-heading">Human input</h3>
                <label className="context-inspector__toggle-label">
                  <span>Enabled</span>
                <input
                  type="checkbox"
                  checked={Boolean(node.hitl?.enabled)}
                  disabled={!editable}
                  onChange={(event) => updateNode(node.id, { hitl: { enabled: event.target.checked, timing: node.hitl?.timing ?? 'before', inputType: node.hitl?.inputType ?? 'approval' } })}
                />
                </label>
              </div>
              {node.hitl?.enabled && (
                <div className="context-inspector__two-column-fields">
                  <Field label="Timing">
                    <InspectorSelect
                      disabled={!editable}
                      value={node.hitl.timing ?? 'before'}
                      options={hitlTimingOptions}
                      onChange={(timing) =>
                        updateNode(node.id, { hitl: { ...node.hitl!, timing } })
                      }
                    />
                  </Field>
                  <Field label="Input">
                    <InspectorSelect
                      disabled={!editable}
                      value={node.hitl.inputType ?? 'approval'}
                      options={hitlInputOptions}
                      onChange={(inputType) =>
                        updateNode(node.id, { hitl: { ...node.hitl!, inputType } })
                      }
                    />
                  </Field>
                </div>
              )}
            </section>
          )}
          <div className="context-inspector__actions">
            <button
              type="button"
              onClick={() => void fitView({ nodes: [{ id: node.id }], duration: 180, padding: 1.4 })}
              className="secondary-button"
            >
              Focus node
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={duplicateSelection}
              className="secondary-button"
            >
              Duplicate selection
            </button>
            <button disabled={!editable} onClick={() => removeNode(node.id)} className="danger-button">Remove node</button>
          </div>
        </div>
      )}
      {edge && (
        <div className="context-inspector__content">
          <section className="context-inspector__group" aria-labelledby="edge-routing-heading">
            <h3 id="edge-routing-heading">Edge routing</h3>
            <div className="context-inspector__fields">
              <Field label="Routing mode">
                <InspectorSelect
                  value={edge.mode}
                  options={edgeModeOptions}
                  disabled={!editable}
                  onChange={(mode) =>
                    updateEdge(edge.id, {
                      mode,
                      label: mode === 'normal' ? undefined : edge.label,
                    })
                  }
                />
              </Field>
          {edge.mode !== 'normal' && (
            <Field label={edge.mode === 'fallback' ? 'Fallback label' : 'Unique branch label'}>
              <input value={edge.label ?? ''} disabled={!editable} onChange={(event) => updateEdge(edge.id, { label: event.target.value })} className="input" placeholder={edge.mode === 'fallback' ? 'fallback' : 'e.g. high_value'} />
            </Field>
          )}
          {edge.mode === 'conditional' && (
            <Field label="Trigger condition">
              <input value={edge.condition ?? ''} disabled={!editable} onChange={(event) => updateEdge(edge.id, { condition: event.target.value })} className="input" placeholder="refund_total > 500" />
            </Field>
          )}
            </div>
          </section>
          <div className="context-inspector__actions">
            <button disabled={!editable} onClick={() => removeEdge(edge.id)} className="danger-button">Remove edge</button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="context-inspector__field"><span>{label}</span><div>{children}</div></label>;
}
