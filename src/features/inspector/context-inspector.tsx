import { ReactNode } from 'react';

import './context-inspector.css';

import { GraphEdge, GraphNode } from '@/src/domain';
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

export function ContextInspector() {
  const graph = useGraphStore((state) => state.graph);
  const proposal = useGraphStore((state) => state.proposal);
  const selection = useGraphStore((state) => state.selection);
  const updateNode = useGraphStore((state) => state.updateNode);
  const removeNode = useGraphStore((state) => state.removeNode);
  const updateEdge = useGraphStore((state) => state.updateEdge);
  const removeEdge = useGraphStore((state) => state.removeEdge);
  const editable = graph.status === 'draft' && !proposal;
  const primary = selection.primary;
  const node = primary?.type === 'node' ? graph.nodes.find((item) => item.id === primary.id) : undefined;
  const edge = primary?.type === 'edge' ? graph.edges.find((item) => item.id === primary.id) : undefined;

  return (
    <section className="context-inspector" aria-label="Context inspector">
      <header className="context-inspector__header">
        <p className="context-inspector__eyebrow">Context</p>
        <h2>Inspector</h2>
      </header>
      {!node && !edge && (
        <p className="context-inspector__empty">
          Select a node or edge to configure it. Shift-click or drag-select multiple nodes.
        </p>
      )}
      {selection.nodeIds.length + selection.edgeIds.length > 1 && (
        <p className="context-inspector__selection-summary" role="status" aria-live="polite">
          {selection.nodeIds.length + selection.edgeIds.length} elements selected
        </p>
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
