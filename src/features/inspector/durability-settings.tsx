'use client';

import { KeyboardEvent, ReactNode, RefCallback, useState } from 'react';

import {
  CheckpointerCapability,
  CapabilitySource,
  GraphCapabilities,
  GraphCapabilityOverrides,
  GraphSubgraph,
  LongTermStoreCapability,
  RetryPolicy,
  StepGraphNode,
  StepStoreAccess,
  WorkingStateCapability,
  WorkflowGraph,
  resolveEffectiveCapabilities,
} from '@/src/domain';
import { useGraphStore } from '@/src/state/workspace-store';

export type GraphDurabilityTab = 'state' | 'checkpoint' | 'store' | 'runtime';
type DurabilityTab = GraphDurabilityTab;
type ScopedCapability = keyof GraphCapabilityOverrides;

const durabilityTabs: Array<{ id: DurabilityTab; label: string }> = [
  { id: 'state', label: 'State' },
  { id: 'checkpoint', label: 'Checkpoint' },
  { id: 'store', label: 'Store' },
  { id: 'runtime', label: 'Runtime' },
];

const optionalText = (value: string) => value.trim() || undefined;
const commaSeparated = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

function replaceOptional<T extends object, K extends keyof T>(value: T, key: K, input: string): T {
  const next = { ...value };
  const normalized = optionalText(input);
  if (normalized) next[key] = normalized as T[K];
  else delete next[key];
  return next;
}

const reducersToText = (reducers: WorkingStateCapability['reducers']) =>
  reducers.map((reducer) => `${reducer.key}: ${reducer.summary}`).join('\n');

const reducersFromText = (value: string): WorkingStateCapability['reducers'] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const separator = line.indexOf(':');
      if (separator < 1 || !line.slice(separator + 1).trim()) return [];
      return [{ key: line.slice(0, separator).trim(), summary: line.slice(separator + 1).trim() }];
    });

function DurabilityField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="context-inspector__field"><span>{label}</span><div>{children}</div></label>;
}

function StateCapabilityFields({
  value,
  disabled,
  onChange,
}: {
  value: WorkingStateCapability;
  disabled: boolean;
  onChange: (value: WorkingStateCapability) => void;
}) {
  return (
    <div className="context-inspector__fields">
      <label className="context-inspector__toggle-label">
        <span>State enabled</span>
        <input
          type="checkbox"
          aria-label="State enabled"
          checked={value.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
      </label>
      <DurabilityField label="State summary">
        <input
          className="input"
          value={value.schema.summary ?? ''}
          disabled={disabled}
          onChange={(event) => onChange({
            ...value,
            schema: replaceOptional(value.schema, 'summary', event.target.value),
          })}
        />
      </DurabilityField>
      <DurabilityField label="State fields">
        <input
          className="input"
          aria-label="State fields"
          value={value.schema.fields.join(', ')}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, schema: { ...value.schema, fields: commaSeparated(event.target.value) } })}
          placeholder="messages, results"
        />
      </DurabilityField>
      <DurabilityField label="Reducer summaries">
        <textarea
          className="input min-h-16 resize-y"
          aria-label="Reducer summaries"
          value={reducersToText(value.reducers)}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, reducers: reducersFromText(event.target.value) })}
          placeholder="messages: Append messages"
        />
      </DurabilityField>
    </div>
  );
}

function CheckpointCapabilityFields({
  value,
  disabled,
  onChange,
}: {
  value: CheckpointerCapability;
  disabled: boolean;
  onChange: (value: CheckpointerCapability) => void;
}) {
  return (
    <div className="context-inspector__fields">
      <label className="context-inspector__toggle-label">
        <span>Checkpoint enabled</span>
        <input
          type="checkbox"
          aria-label="Checkpoint enabled"
          checked={value.enabled}
          disabled={disabled}
          onChange={(event) => onChange({
            ...value,
            enabled: event.target.checked,
            durableThread: event.target.checked ? value.durableThread : { ...value.durableThread, required: false },
          })}
        />
      </label>
      <label className="context-inspector__toggle-label">
        <span>Durable thread required</span>
        <input
          type="checkbox"
          aria-label="Durable thread required"
          checked={value.durableThread.required}
          disabled={disabled || !value.enabled}
          onChange={(event) => onChange({ ...value, durableThread: { ...value.durableThread, required: event.target.checked } })}
        />
      </label>
      <DurabilityField label="Checkpoint backend">
        <input
          className="input"
          aria-label="Checkpoint backend"
          value={value.backend ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(replaceOptional(value, 'backend', event.target.value))}
          placeholder="MemorySaver"
        />
      </DurabilityField>
      <DurabilityField label="Thread ID source">
        <input
          className="input"
          aria-label="Thread ID source"
          value={value.durableThread.threadIdSource ?? ''}
          disabled={disabled || !value.durableThread.required}
          onChange={(event) => onChange({ ...value, durableThread: replaceOptional(value.durableThread, 'threadIdSource', event.target.value) })}
          placeholder="request.threadId"
        />
      </DurabilityField>
    </div>
  );
}

function StoreCapabilityFields({
  value,
  disabled,
  onChange,
}: {
  value: LongTermStoreCapability;
  disabled: boolean;
  onChange: (value: LongTermStoreCapability) => void;
}) {
  return (
    <div className="context-inspector__fields">
      <label className="context-inspector__toggle-label">
        <span>Store available</span>
        <input
          type="checkbox"
          aria-label="Store available"
          checked={value.available}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, available: event.target.checked })}
        />
      </label>
      <DurabilityField label="Store namespace">
        <input
          className="input"
          aria-label="Store namespace"
          value={value.namespace ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(replaceOptional(value, 'namespace', event.target.value))}
          placeholder="preferences"
        />
      </DurabilityField>
      <DurabilityField label="Default retention">
        <input
          className="input"
          aria-label="Default Store retention"
          value={value.retention ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(replaceOptional(value, 'retention', event.target.value))}
          placeholder="session"
        />
      </DurabilityField>
    </div>
  );
}

function DurabilityTabList({
  active,
  onChange,
  includeRuntime = true,
  autoFocusActive = false,
}: {
  active: DurabilityTab;
  onChange: (tab: DurabilityTab) => void;
  includeRuntime?: boolean;
  autoFocusActive?: boolean;
}) {
  const tabs = includeRuntime ? durabilityTabs : durabilityTabs.filter((tab) => tab.id !== 'runtime');
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, current: DurabilityTab) => {
    const index = tabs.findIndex((tab) => tab.id === current);
    let next: DurabilityTab | undefined;
    if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length]?.id;
    if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length]?.id;
    if (event.key === 'Home') next = tabs[0]?.id;
    if (event.key === 'End') next = tabs[tabs.length - 1]?.id;
    if (!next) return;
    event.preventDefault();
    onChange(next);
  };
  return (
    <div className="context-inspector__durability-tabs" role="tablist" aria-label="Durability settings">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          tabIndex={active === tab.id ? 0 : -1}
          autoFocus={autoFocusActive && active === tab.id}
          className={active === tab.id ? 'is-active' : ''}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => handleKey(event, tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function GraphDurabilitySettings({
  graph,
  editable,
  initialTab = 'state',
  focusInitialTab = false,
}: {
  graph: WorkflowGraph;
  editable: boolean;
  initialTab?: GraphDurabilityTab;
  focusInitialTab?: boolean;
}) {
  const updateGraphCapabilities = useGraphStore((state) => state.updateGraphCapabilities);
  const [active, setActive] = useState<DurabilityTab>(initialTab);
  const update = (patch: Partial<GraphCapabilities>) => updateGraphCapabilities(patch);

  return (
    <section className="context-inspector__group context-inspector__group--tinted" aria-labelledby="graph-settings-heading">
      <h3 id="graph-settings-heading">Graph settings</h3>
      <p className="context-inspector__help">State, Checkpoint, Store, and Runtime are separate capabilities. Scope and backend details stay here, not on topology.</p>
      <DurabilityTabList active={active} onChange={setActive} autoFocusActive={focusInitialTab} />
      <div className="context-inspector__durability-panel" role="tabpanel" aria-label={`${active} graph settings`}>
        {active === 'state' && <StateCapabilityFields value={graph.capabilities.state} disabled={!editable} onChange={(state) => update({ state })} />}
        {active === 'checkpoint' && <CheckpointCapabilityFields value={graph.capabilities.checkpointer} disabled={!editable} onChange={(checkpointer) => update({ checkpointer })} />}
        {active === 'store' && <StoreCapabilityFields value={graph.capabilities.store} disabled={!editable} onChange={(store) => update({ store })} />}
        {active === 'runtime' && (
          <div className="context-inspector__fields">
            <DurabilityField label="Runtime mode">
              <select
                className="input"
                aria-label="Runtime mode"
                value={graph.capabilities.runtimeMode.mode}
                disabled={!editable}
                onChange={(event) => {
                  const mode = event.target.value as GraphCapabilities['runtimeMode']['mode'];
                  update({ runtimeMode: mode === 'unspecified' ? { mode } : { mode, input: mode === 'voice' ? 'audio' : 'text' } });
                }}
              >
                <option value="unspecified">Unspecified</option>
                <option value="text">Text</option>
                <option value="voice">Voice</option>
              </select>
            </DurabilityField>
            <p className="context-inspector__read-only" role="status">Runtime mode applies at graph level; subgraphs cannot override it.</p>
          </div>
        )}
      </div>
      {!editable && <p className="context-inspector__read-only" role="status">Graph settings are read-only while this contract is frozen or a proposal awaits review.</p>}
    </section>
  );
}

function OverrideCapability({
  label,
  capability,
  source,
  disabled,
  children,
  onToggle,
}: {
  label: string;
  capability: ScopedCapability;
  source: CapabilitySource;
  disabled: boolean;
  children: ReactNode;
  onToggle: (enabled: boolean) => void;
}) {
  const overridden = source === 'overridden';
  return (
    <section className="context-inspector__override-capability" data-capability={capability}>
      <div className="context-inspector__toggle-row">
        <strong>{label} · {overridden ? 'Override' : 'Inherits graph'}</strong>
        <label className="context-inspector__toggle-label">
          <span>Override</span>
          <input type="checkbox" aria-label={`Override ${label}`} checked={overridden} disabled={disabled} onChange={(event) => onToggle(event.target.checked)} />
        </label>
      </div>
      {overridden ? children : <p className="context-inspector__help">This subgraph inherits the graph-level {label} configuration.</p>}
    </section>
  );
}

export function SubgraphDurabilityOverrides({
  graph,
  subgraph,
  editable,
}: {
  graph: WorkflowGraph;
  subgraph: GraphSubgraph;
  editable: boolean;
}) {
  const setSubgraphCapabilityOverride = useGraphStore((state) => state.setSubgraphCapabilityOverride);
  const [active, setActive] = useState<DurabilityTab>('state');
  const effective = resolveEffectiveCapabilities(graph, subgraph.id);
  const setOverride = (
    capability: ScopedCapability,
    value: GraphCapabilityOverrides[ScopedCapability] | null,
  ) => setSubgraphCapabilityOverride(subgraph.id, capability, value);

  const enableOverride = (capability: ScopedCapability, enabled: boolean) => {
    if (!enabled) return setOverride(capability, null);
    setOverride(capability, structuredClone(effective[capability].value));
  };

  return (
    <section className="context-inspector__group context-inspector__group--tinted" aria-labelledby="subgraph-durability-heading">
      <h3 id="subgraph-durability-heading">Durability scope</h3>
      <p className="context-inspector__help">State, Checkpoint, and Store inherit independently. Runtime mode always stays graph-level.</p>
      <DurabilityTabList active={active} onChange={setActive} includeRuntime={false} />
      <div className="context-inspector__durability-panel" role="tabpanel" aria-label={`${active} subgraph override`}>
        {active === 'state' && (
          <OverrideCapability label="State" capability="state" source={effective.state.source} disabled={!editable} onToggle={(enabled) => enableOverride('state', enabled)}>
            <StateCapabilityFields value={effective.state.value} disabled={!editable} onChange={(value) => setOverride('state', value)} />
          </OverrideCapability>
        )}
        {active === 'checkpoint' && (
          <OverrideCapability label="Checkpoint" capability="checkpointer" source={effective.checkpointer.source} disabled={!editable} onToggle={(enabled) => enableOverride('checkpointer', enabled)}>
            <CheckpointCapabilityFields value={effective.checkpointer.value} disabled={!editable} onChange={(value) => setOverride('checkpointer', value)} />
          </OverrideCapability>
        )}
        {active === 'store' && (
          <OverrideCapability label="Store" capability="store" source={effective.store.source} disabled={!editable} onToggle={(enabled) => enableOverride('store', enabled)}>
            <StoreCapabilityFields value={effective.store.value} disabled={!editable} onChange={(value) => setOverride('store', value)} />
          </OverrideCapability>
        )}
      </div>
    </section>
  );
}

const noStoreAccess = (access: StepStoreAccess) => !access.read && !access.write;

export function StepDurabilitySettings({
  graph,
  node,
  editable,
  storeAccessRef,
  retryRef,
}: {
  graph: WorkflowGraph;
  node: StepGraphNode;
  editable: boolean;
  storeAccessRef?: RefCallback<HTMLElement>;
  retryRef?: RefCallback<HTMLElement>;
}) {
  const updateStepStoreAccess = useGraphStore((state) => state.updateStepStoreAccess);
  const updateStepRetry = useGraphStore((state) => state.updateStepRetry);
  const effective = resolveEffectiveCapabilities(graph, node.parentId);
  const storeAvailable = effective.store.value.available;
  const storeAccess = node.storeAccess ?? {};
  const retry = node.retry;

  const setStoreAccess = (next: StepStoreAccess) =>
    updateStepStoreAccess(node.id, noStoreAccess(next) ? null : next);
  const setReadEnabled = (enabled: boolean) => {
    const next = { ...storeAccess };
    if (enabled) next.read = next.read ?? {};
    else delete next.read;
    setStoreAccess(next);
  };
  const setWriteEnabled = (enabled: boolean) => {
    const next = { ...storeAccess };
    if (enabled) next.write = next.write ?? {};
    else delete next.write;
    setStoreAccess(next);
  };
  const setRetry = (next: RetryPolicy) => updateStepRetry(node.id, next);

  return (
    <>
      <section ref={storeAccessRef} id="inspector-step-store-access" data-inspector-section="storeAccess" tabIndex={-1} className="context-inspector__group context-inspector__group--tinted" aria-labelledby="step-store-access-heading">
        <div className="context-inspector__toggle-row">
          <h3 id="step-store-access-heading">Store access</h3>
          <span className={`context-inspector__scope-status ${storeAvailable ? 'is-available' : 'is-unavailable'}`}>
            {storeAvailable ? `Available · ${effective.store.source}` : `Unavailable · ${effective.store.source}`}
          </span>
        </div>
        <p className="context-inspector__help">Only direct access appears on this Step’s modifier rail. Enable Store in its effective scope before adding new access.</p>
        <div className="context-inspector__fields">
          <label className="context-inspector__toggle-label">
            <span>Direct Store read</span>
            <input type="checkbox" aria-label="Direct Store read" checked={Boolean(storeAccess.read)} disabled={!editable || (!storeAvailable && !storeAccess.read)} onChange={(event) => setReadEnabled(event.target.checked)} />
          </label>
          {storeAccess.read && (
            <div className="context-inspector__two-column-fields">
              <DurabilityField label="Read namespace">
                <input className="input" aria-label="Read Store namespace" value={storeAccess.read.namespace ?? ''} disabled={!editable} onChange={(event) => setStoreAccess({ ...storeAccess, read: replaceOptional(storeAccess.read!, 'namespace', event.target.value) })} />
              </DurabilityField>
              <DurabilityField label="Read key">
                <input className="input" aria-label="Read Store key" value={storeAccess.read.key ?? ''} disabled={!editable} onChange={(event) => setStoreAccess({ ...storeAccess, read: replaceOptional(storeAccess.read!, 'key', event.target.value) })} />
              </DurabilityField>
            </div>
          )}
          <label className="context-inspector__toggle-label">
            <span>Direct Store write</span>
            <input type="checkbox" aria-label="Direct Store write" checked={Boolean(storeAccess.write)} disabled={!editable || (!storeAvailable && !storeAccess.write)} onChange={(event) => setWriteEnabled(event.target.checked)} />
          </label>
          {storeAccess.write && (
            <div className="context-inspector__fields">
              <div className="context-inspector__two-column-fields">
                <DurabilityField label="Write namespace">
                  <input className="input" aria-label="Write Store namespace" value={storeAccess.write.namespace ?? ''} disabled={!editable} onChange={(event) => setStoreAccess({ ...storeAccess, write: replaceOptional(storeAccess.write!, 'namespace', event.target.value) })} />
                </DurabilityField>
                <DurabilityField label="Write key">
                  <input className="input" aria-label="Write Store key" value={storeAccess.write.key ?? ''} disabled={!editable} onChange={(event) => setStoreAccess({ ...storeAccess, write: replaceOptional(storeAccess.write!, 'key', event.target.value) })} />
                </DurabilityField>
              </div>
              <DurabilityField label="Write retention">
                <input className="input" aria-label="Write Store retention" value={storeAccess.write.retention ?? ''} disabled={!editable} onChange={(event) => setStoreAccess({ ...storeAccess, write: replaceOptional(storeAccess.write!, 'retention', event.target.value) })} />
              </DurabilityField>
            </div>
          )}
        </div>
      </section>
      <section ref={retryRef} id="inspector-step-retry" data-inspector-section="retry" tabIndex={-1} className="context-inspector__group context-inspector__group--tinted" aria-labelledby="step-retry-heading">
        <div className="context-inspector__toggle-row">
          <h3 id="step-retry-heading">Retry policy</h3>
          <label className="context-inspector__toggle-label">
            <span>Enabled</span>
            <input
              type="checkbox"
              aria-label="Retry policy enabled"
              checked={Boolean(retry)}
              disabled={!editable}
              onChange={(event) => updateStepRetry(node.id, event.target.checked ? { maxAttempts: 2, backoff: { strategy: 'fixed', initialDelayMs: 0 } } : null)}
            />
          </label>
        </div>
        <p className="context-inspector__help">Retry repeats this Step internally. It does not add a route, an edge, or a topology loop.</p>
        {retry && (
          <div className="context-inspector__fields">
            <div className="context-inspector__two-column-fields">
              <DurabilityField label="Maximum attempts">
                <input className="input" type="number" min="2" max="10" aria-label="Retry maximum attempts" value={retry.maxAttempts ?? 2} disabled={!editable} onChange={(event) => setRetry({ ...retry, maxAttempts: Math.max(2, Math.min(10, Math.trunc(Number(event.target.value) || 2)) ) })} />
              </DurabilityField>
              <DurabilityField label="Backoff strategy">
                <select className="input" aria-label="Retry backoff strategy" value={retry.backoff?.strategy ?? 'fixed'} disabled={!editable} onChange={(event) => setRetry({ ...retry, backoff: { ...retry.backoff!, strategy: event.target.value as 'fixed' | 'exponential' } })}>
                  <option value="fixed">Fixed</option>
                  <option value="exponential">Exponential</option>
                </select>
              </DurabilityField>
            </div>
            <div className="context-inspector__two-column-fields">
              <DurabilityField label="Initial delay (ms)">
                <input className="input" type="number" min="0" aria-label="Retry initial delay" value={retry.backoff?.initialDelayMs ?? 0} disabled={!editable} onChange={(event) => setRetry({ ...retry, backoff: { ...retry.backoff!, initialDelayMs: Math.max(0, Math.trunc(Number(event.target.value) || 0)) } })} />
              </DurabilityField>
              <DurabilityField label="Maximum delay (ms)">
                <input className="input" type="number" min="0" aria-label="Retry maximum delay" value={retry.backoff?.maxDelayMs ?? ''} disabled={!editable} onChange={(event) => {
                  const value = event.target.value.trim();
                  const backoff = { ...retry.backoff! };
                  if (value) backoff.maxDelayMs = Math.max(backoff.initialDelayMs ?? 0, Math.trunc(Number(value) || 0));
                  else delete backoff.maxDelayMs;
                  setRetry({ ...retry, backoff });
                }} />
              </DurabilityField>
            </div>
            <DurabilityField label="Retry conditions">
              <input className="input" aria-label="Retry conditions" value={retry.retryOn?.join(', ') ?? ''} disabled={!editable} onChange={(event) => {
                const retryOn = commaSeparated(event.target.value);
                const next = { ...retry };
                if (retryOn.length) next.retryOn = retryOn;
                else delete next.retryOn;
                setRetry(next);
              }} placeholder="provider.timeout, rate_limited" />
            </DurabilityField>
            <div className="context-inspector__two-column-fields">
              <DurabilityField label="Fallback provider">
                <input className="input" aria-label="Retry fallback provider" value={retry.fallback?.provider ?? ''} disabled={!editable} onChange={(event) => {
                  const provider = optionalText(event.target.value);
                  const fallback = { ...retry.fallback };
                  if (provider) fallback.provider = provider;
                  else delete fallback.provider;
                  const next = { ...retry };
                  if (Object.keys(fallback).length) next.fallback = fallback;
                  else delete next.fallback;
                  setRetry(next);
                }} />
              </DurabilityField>
              <DurabilityField label="Fallback model">
                <input className="input" aria-label="Retry fallback model" value={retry.fallback?.model ?? ''} disabled={!editable} onChange={(event) => {
                  const model = optionalText(event.target.value);
                  const fallback = { ...retry.fallback };
                  if (model) fallback.model = model;
                  else delete fallback.model;
                  const next = { ...retry };
                  if (Object.keys(fallback).length) next.fallback = fallback;
                  else delete next.fallback;
                  setRetry(next);
                }} />
              </DurabilityField>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
