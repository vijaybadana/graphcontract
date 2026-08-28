import { ReactNode } from 'react';

import { GraphEdge, GraphNode } from '@/src/domain';
import {
  InspectorSelect,
  InspectorSelectOption,
} from '@/src/features/inspector/inspector-select';
import { useGraphStore } from '@/src/state/workspace-store';

const hitlTimingOptions: readonly InspectorSelectOption<
  NonNullable<GraphNode['hitl']>['timing']
>[] = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'conditional', label: 'Conditional' },
];
const hitlInputOptions: readonly InspectorSelectOption<
  NonNullable<GraphNode['hitl']>['inputType']
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
    <section className="rounded-2xl border border-black/8 bg-white p-4">
      <p className="eyebrow">Inspector</p>
      {!node && !edge && (
        <p className="mt-3 text-xs leading-5 text-black/50">
          Select a node or edge to configure it. Shift-click or drag-select multiple nodes.
        </p>
      )}
      {selection.nodeIds.length + selection.edgeIds.length > 1 && (
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
          {selection.nodeIds.length + selection.edgeIds.length} elements selected
        </p>
      )}
      {node && (
        <div className="mt-3 space-y-3">
          <Field label="Label">
            <input value={node.label} disabled={!editable} onChange={(event) => updateNode(node.id, { label: event.target.value })} className="input" />
          </Field>
          <Field label="Description">
            <textarea value={node.description ?? ''} disabled={!editable} onChange={(event) => updateNode(node.id, { description: event.target.value })} className="input min-h-16 resize-y" placeholder="What happens at this step?" />
          </Field>
          {['agent', 'action', 'tool'].includes(node.kind) && (
            <div className="rounded-xl border border-black/8 bg-[#f7f6f2] p-3">
              <label className="flex items-center justify-between gap-3 text-xs font-semibold">
                Embedded human input
                <input
                  type="checkbox"
                  checked={Boolean(node.hitl?.enabled)}
                  disabled={!editable}
                  onChange={(event) => updateNode(node.id, { hitl: { enabled: event.target.checked, timing: node.hitl?.timing ?? 'before', inputType: node.hitl?.inputType ?? 'approval' } })}
                />
              </label>
              {node.hitl?.enabled && (
                <div className="mt-3 grid grid-cols-2 gap-2">
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
            </div>
          )}
          <button disabled={!editable} onClick={() => removeNode(node.id)} className="danger-button">Remove node</button>
        </div>
      )}
      {edge && (
        <div className="mt-3 space-y-3">
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
          <button disabled={!editable} onClick={() => removeEdge(edge.id)} className="danger-button">Remove edge</button>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-[10px] font-bold uppercase tracking-wider text-black/45">{label}<div className="mt-1.5 normal-case tracking-normal text-black">{children}</div></label>;
}
