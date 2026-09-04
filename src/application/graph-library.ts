import {
  createDefaultGraphCapabilities,
  enumerateScenariosBounded,
  humanControlHitlDemoGraph,
  normalizeWorkflowGraph,
  researchIntakeRoutingGraph,
  researchSupervisorGraph,
  validateGraph,
  type GraphNode,
  type GraphCapabilities,
  type OpaqueStepMetadata,
  type StepExecutor,
  type ScenarioEnumerationResult,
  type WorkflowGraph,
} from '@/src/domain';

import { dynamicParallelismDemoGraph } from './package-three-demo';
import { layoutWorkflowGraph } from './layout-workflow';

import {
  GRAPH_LIBRARY_ENTRY_COUNT,
  type GraphLibraryDefinition,
  type GraphLibraryEntry,
  type GraphLibrarySource,
} from './graph-library-contract';

type StepOptions = Omit<Extract<GraphNode, { kind: 'step' }>, 'id' | 'kind' | 'label' | 'position'>;

const UPDATED_AT = '2026-08-30T00:00:00.000Z';

const start = (id: string, x: number, y: number, parentId?: string): GraphNode => ({
  id,
  kind: 'start',
  label: 'Start',
  position: { x, y },
  ...(parentId ? { parentId } : {}),
});

const end = (id: string, label: string, x: number, y: number, parentId?: string): GraphNode => ({
  id,
  kind: 'end',
  label,
  position: { x, y },
  ...(parentId ? { parentId } : {}),
});

const step = (
  id: string,
  label: string,
  executor: StepExecutor,
  x: number,
  y: number,
  options: StepOptions = {},
): GraphNode => ({ id, kind: 'step', label, executor, position: { x, y }, ...options });

const opaque = (factoryLabel: string): OpaqueStepMetadata => ({
  factoryLabel,
  inputPorts: [],
  outputPorts: [],
  runtimeInspection: { available: false },
});

const source = (owner: string, repository: string, note?: string): GraphLibrarySource => ({
  owner,
  repository,
  url: `https://github.com/${owner}/${repository}` as `https://github.com/${string}`,
  ...(note ? { note } : {}),
});

const graph = (
  id: string,
  name: string,
  nodes: GraphNode[],
  edges: WorkflowGraph['edges'],
  subgraphs: WorkflowGraph['subgraphs'] = [],
  capabilities: GraphCapabilities = createDefaultGraphCapabilities(),
): WorkflowGraph => normalizeWorkflowGraph({
  schemaVersion: '6',
  id,
  name,
  status: 'draft',
  updatedAt: UPDATED_AT,
  capabilities,
  nodes,
  edges,
  subgraphs,
  relationships: [],
});

/**
 * Library durability records reflect verified source behavior only. They are
 * design-time capability declarations, not a claim that opening a template
 * connects to, or executes against, its source repository.
 */
const durability = (patch: Partial<GraphCapabilities>): GraphCapabilities => ({
  ...createDefaultGraphCapabilities(),
  ...patch,
});

const definitions: readonly GraphLibraryDefinition[] = [
  {
    id: 'research-supervisor-demo',
    title: 'Research Supervisor',
    outcome: 'Inspect a compact supervisor-and-tools workflow inside a movable subgraph.',
    domain: 'research',
    complexity: 'foundational',
    concepts: ['subgraph'],
    source: source('vijaybadana', 'graphcontract'),
    graph: researchSupervisorGraph,
  },
  {
    id: 'research-intake-routing-demo',
    title: 'Research Intake Routing',
    outcome: 'Review normal, conditional, command, fallback, and bounded loop routing in one contract.',
    domain: 'research',
    complexity: 'advanced',
    concepts: ['conditional repair', 'command routing', 'bounded loop'],
    source: source('vijaybadana', 'graphcontract'),
    graph: researchIntakeRoutingGraph,
  },
  {
    id: 'human-control-hitl-demo',
    title: 'Human Control & HITL',
    outcome: 'Preview human approval, request-changes, and rejection outcomes without runtime mutation.',
    domain: 'engineering',
    complexity: 'advanced',
    concepts: ['human approval', 'human review', 'sensitive action'],
    source: source('vijaybadana', 'graphcontract'),
    graph: humanControlHitlDemoGraph,
  },
  {
    id: 'dynamic-parallelism-merge-demo',
    title: 'Parallel research · Send ×N',
    outcome: 'Design one dynamic worker template, merge its results, and inspect an explicit runtime fixture.',
    domain: 'research',
    complexity: 'advanced',
    concepts: ['send fan-out', 'merge'],
    source: source('vijaybadana', 'graphcontract'),
    graph: dynamicParallelismDemoGraph,
  },
  {
    id: 'hierarchical-deep-research',
    title: 'Hierarchical Deep Research',
    outcome: 'Supervise concurrent researcher subgraph runs and turn their compressed findings into a final report.',
    domain: 'research',
    complexity: 'advanced',
    concepts: ['subgraph', 'command routing', 'tool loop', 'bounded loop'],
    source: source(
      'langchain-ai',
      'open_deep_research',
      'Normalized from pinned source commit 1b7d2e8. supervisor_tools imperatively invokes zero-to-five researcher_subgraph runs with asyncio.gather; the canvas shows that invocation as an evidenced ConductResearch ×N command path and does not invent a Send/Merge pair. Source defaults of six supervisor rounds and ten researcher tool-call rounds are recorded on the nodes, while representative canvas loops are capped at two to keep scenario review bounded. No production Checkpointer or Store is claimed.',
    ),
    layout: {
      authoredSubgraphIds: ['research-cell', 'researcher-workflow'],
      preserveGraphGeometry: true,
    },
    graph: graph(
      'library-hierarchical-deep-research',
      'Hierarchical Deep Research',
      [
        start('research-start', 40, 360),
        step('clarify-request', 'Clarify request', 'ai', 300, 360, {
          description: 'Resolve ambiguity before creating the research brief.',
        }),
        end('awaiting-user-reply', 'Awaiting user reply', 580, 180),
        step('write-brief', 'Write research brief', 'ai', 580, 540, {
          description: 'Convert the clarified request into a focused research brief.',
        }),
        start('research-cell-start', 50, 100, 'research-cell'),
        step('supervisor-agent', 'Supervisor Agent', 'ai', 310, 100, {
          parentId: 'research-cell',
          description: 'Plan research and choose think_tool, ConductResearch, or ResearchComplete.',
          participation: { internalTools: true },
          config: { sourceNode: 'supervisor', maxResearcherIterations: 6 },
        }),
        step('supervisor-tools', 'Supervisor Tools', 'tool', 600, 100, {
          parentId: 'research-cell',
          description: 'Execute reflection and research tool calls, then return their results to the Supervisor.',
          config: {
            sourceNode: 'supervisor_tools',
            tools: ['think_tool', 'ConductResearch', 'ResearchComplete'],
            maxConcurrentResearchUnits: 5,
          },
        }),
        end('research-cell-end', 'Research complete', 1320, 100, 'research-cell'),
        start('researcher-start', 40, 170, 'researcher-workflow'),
        step('researcher-agent', 'Researcher Agent', 'ai', 260, 160, {
          parentId: 'researcher-workflow',
          description: 'Research one delegated topic using configured search, MCP, and reflection tools.',
          participation: { internalTools: true },
          retry: { maxAttempts: 3, backoff: { strategy: 'fixed', initialDelayMs: 0 } },
          config: { maxReactToolCalls: 10 },
        }),
        step('researcher-tools', 'Researcher Tools', 'tool', 520, 160, {
          parentId: 'researcher-workflow',
          description: 'Execute configured research tools and either continue researching or compress the result.',
          config: { sourceNode: 'researcher_tools', maxReactToolCalls: 10 },
        }),
        step('compress-research', 'Compress Research', 'ai', 780, 160, {
          parentId: 'researcher-workflow',
          description: 'Compress one researcher run into a focused result and preserve its raw notes.',
          retry: { maxAttempts: 3, backoff: { strategy: 'fixed', initialDelayMs: 0 } },
        }),
        end('researcher-end', 'Researcher complete', 1020, 170, 'researcher-workflow'),
        step('final-report', 'Final report generation', 'ai', 2650, 360, {
          description: 'Synthesize the collected supervisor notes into the final cited report.',
          retry: { maxAttempts: 3, backoff: { strategy: 'fixed', initialDelayMs: 0 } },
        }),
        end('research-complete', 'Report complete', 2930, 360),
      ],
      [
        { id: 'research-clarify', source: 'research-start', target: 'clarify-request', mode: 'normal' },
        { id: 'clarify-wait', source: 'clarify-request', target: 'awaiting-user-reply', mode: 'command', label: 'needs clarification', condition: 'need_clarification == true' },
        { id: 'clarify-write', source: 'clarify-request', target: 'write-brief', mode: 'command', label: 'ready or disabled' },
        { id: 'enter-research-cell', source: 'write-brief', target: 'research-cell-start', mode: 'command', label: 'brief prepared' },
        { id: 'research-cell-supervisor', source: 'research-cell-start', target: 'supervisor-agent', mode: 'normal' },
        { id: 'supervisor-call-tools', source: 'supervisor-agent', target: 'supervisor-tools', mode: 'command', label: 'tool calls' },
        { id: 'supervisor-continue', source: 'supervisor-tools', target: 'supervisor-agent', mode: 'command', label: 'continue', condition: 'think or research results', loopCap: 2 },
        {
          id: 'supervisor-conduct-research',
          source: 'supervisor-tools',
          target: 'researcher-start',
          mode: 'command',
          label: 'ConductResearch ×N',
          condition: 'one or more ConductResearch tool calls',
          provenance: {
            representation: 'derived-semantic',
            evidence: {
              source: 'langchain-ai/open_deep_research@1b7d2e8:deep_researcher.py#L282-L305',
              evidenceClass: 'imperative-async-subgraph-invocation',
              confidence: 'high',
              details: 'supervisor_tools invokes zero-to-five researcher_subgraph runs concurrently with asyncio.gather.',
            },
          },
        },
        { id: 'supervisor-finish', source: 'supervisor-tools', target: 'research-cell-end', mode: 'command', label: 'finish research', condition: 'ResearchComplete | no tool calls | iteration cap | research error' },
        { id: 'researcher-start-agent', source: 'researcher-start', target: 'researcher-agent', mode: 'normal' },
        { id: 'researcher-call-tools', source: 'researcher-agent', target: 'researcher-tools', mode: 'command', label: 'tool calls' },
        { id: 'researcher-continue', source: 'researcher-tools', target: 'researcher-agent', mode: 'command', label: 'continue', condition: 'more tool work required', loopCap: 2 },
        { id: 'researcher-compress', source: 'researcher-tools', target: 'compress-research', mode: 'command', label: 'compress', condition: 'no tool calls | ResearchComplete | tool-call cap' },
        { id: 'researcher-complete', source: 'compress-research', target: 'researcher-end', mode: 'normal' },
        {
          id: 'researcher-return',
          source: 'researcher-end',
          target: 'supervisor-tools',
          mode: 'normal',
          loopCap: 2,
          provenance: {
            representation: 'derived-semantic',
            evidence: {
              source: 'langchain-ai/open_deep_research@1b7d2e8:deep_researcher.py#L305-L313',
              evidenceClass: 'imperative-subgraph-result-return',
              confidence: 'high',
              details: 'Each researcher_subgraph result is converted to a ConductResearch ToolMessage inside supervisor_tools before that handler returns to the Supervisor.',
            },
          },
        },
        { id: 'leave-research-cell', source: 'research-cell-end', target: 'final-report', mode: 'normal' },
        { id: 'brief-complete', source: 'final-report', target: 'research-complete', mode: 'normal' },
      ],
      [
        {
          id: 'research-cell',
          label: 'Research Supervisor',
          position: { x: 850, y: 50 },
          dimensions: { width: 1660, height: 1000 },
          collapsed: false,
        },
        {
          id: 'researcher-workflow',
          label: 'Researcher ×N',
          parentId: 'research-cell',
          position: { x: 250, y: 380 },
          dimensions: { width: 1180, height: 500 },
          collapsed: false,
        },
      ],
      durability({
        state: { enabled: true, schema: { fields: ['messages', 'researchBrief', 'supervisorMessages', 'researchIterations', 'notes', 'rawNotes', 'finalReport'], summary: 'Per-run request, brief, supervisor conversation, collected notes, raw notes, and final report.' }, reducers: [{ key: 'supervisorMessages', summary: 'Override or append supervisor messages by message ID' }, { key: 'notes', summary: 'Collect compressed researcher results from supervisor tool calls' }, { key: 'rawNotes', summary: 'Append raw notes returned by researcher runs' }] },
      }),
    ),
  },
  {
    id: 'guarded-coding-agent-delivery',
    title: 'Guarded Coding-Agent Delivery',
    outcome: 'Prepare a bounded coding task for a guarded agent and publish an approved change.',
    domain: 'engineering',
    complexity: 'advanced',
    concepts: ['opaque agent', 'guardrail', 'approval'],
    source: source(
      'langchain-ai',
      'open-swe',
      'Framework-generated agent internals, dynamic subagents, and cross-run approval lifecycle are deferred rather than represented as invented topology.',
    ),
    graph: graph(
      'library-guarded-coding-agent-delivery',
      'Guarded Coding-Agent Delivery',
      [
        start('coding-start', 40, 180),
        step('prepare-workspace', 'Prepare bounded workspace', 'deterministic', 240, 180, { modifiers: { guardrail: true } }),
        step('coding-agent', 'Guarded coding agent', 'ai', 490, 180, { opaque: opaque('Guarded coding agent factory'), modifiers: { retryFallback: true }, participation: { internalTools: true } }),
        step('publish-change', 'Publish approved change', 'tool', 760, 180, {
          sensitive: { target: 'Repository change publication', authorization: 'Release owner', approvalRequired: true, idempotency: 'Change request key' },
          hitl: { enabled: true, timing: 'before', activation: { reason: 'Publishing changes requires an explicit approval.' }, response: { type: 'approval', allowedOutcomes: [{ id: 'approve', label: 'Approve publication', resumeNodeId: 'coding-delivered' }] } },
        }),
        end('coding-delivered', 'Change delivered', 1030, 180),
      ],
      [
        { id: 'coding-prepare', source: 'coding-start', target: 'prepare-workspace', mode: 'normal' },
        { id: 'prepare-agent', source: 'prepare-workspace', target: 'coding-agent', mode: 'normal' },
        { id: 'agent-publish', source: 'coding-agent', target: 'publish-change', mode: 'normal' },
        { id: 'publish-delivered', source: 'publish-change', target: 'coding-delivered', mode: 'normal' },
      ],
      [],
      durability({
        state: { enabled: true, schema: { fields: ['task', 'plan', 'workspace'], summary: 'Per-run coding task and workspace context.' }, reducers: [] },
        checkpointer: { enabled: true, backend: 'Deployment checkpointer', durableThread: { required: true, threadIdSource: 'deployment.threadId' } },
        store: { available: true, namespace: 'organization/user skills', retention: 'deployment-managed' },
      }),
    ),
  },
  {
    id: 'evidence-to-approved-social-content',
    title: 'Evidence-to-Approved Social Content',
    outcome: 'Map source evidence into candidate posts, consolidate them, and schedule an approved draft.',
    domain: 'content',
    complexity: 'advanced',
    concepts: ['send fan-out', 'merge', 'human review'],
    source: source(
      'CopilotKit',
      'open-fullstack-social-media-agent',
      'Spawned runs, media generation, and live scheduling integrations are intentionally deferred.',
    ),
    graph: graph(
      'library-evidence-to-approved-social-content',
      'Evidence-to-Approved Social Content',
      [
        start('content-start', 40, 230),
        step('collect-evidence', 'Collect approved evidence', 'tool', 220, 230),
        step('map-evidence', 'Map evidence to drafts', 'ai', 440, 230),
        step('draft-template', 'Draft post template', 'ai', 650, 230, { storeAccess: { read: { namespace: 'saved_data', key: 'used_urls' }, write: { namespace: 'saved_data', key: 'used_urls' } } }),
        { id: 'draft-merge', kind: 'merge', label: 'Combine candidate drafts', position: { x: 870, y: 230 }, merge: { reducer: { name: 'combine_drafts', aggregateState: 'drafts' }, completion: { mode: 'all' }, continuation: { mode: 'once' }, waitingForDynamicInputs: true } },
        step('polish-content', 'Polish content set', 'ai', 1080, 230),
        step('content-review', 'Editorial review', 'human', 1290, 230, { hitl: { enabled: true, timing: 'inside', response: { type: 'selection', selectionChoices: [{ id: 'approve', label: 'Approve' }, { id: 'revise', label: 'Revise' }], allowedOutcomes: [{ id: 'approve', label: 'Approve draft', resumeNodeId: 'schedule-post' }, { id: 'revise', label: 'Request revision', resumeNodeId: 'revise-content' }] } } }),
        step('revise-content', 'Revise content', 'ai', 1290, 430),
        step('schedule-post', 'Schedule post', 'tool', 1520, 180, { sensitive: { target: 'Publication schedule', authorization: 'Content owner', approvalRequired: true, idempotency: 'Post schedule key' }, hitl: { enabled: true, timing: 'before', response: { type: 'approval', allowedOutcomes: [{ id: 'approve', label: 'Confirm schedule', resumeNodeId: 'content-published' }] } } }),
        end('content-published', 'Content scheduled', 1740, 180),
      ],
      [
        { id: 'content-collect', source: 'content-start', target: 'collect-evidence', mode: 'normal' },
        { id: 'collect-map', source: 'collect-evidence', target: 'map-evidence', mode: 'normal' },
        { id: 'map-send', source: 'map-evidence', target: 'draft-template', mode: 'send', send: { destinationTemplateId: 'draft-template', multiplicity: 'dynamic', payloadLabel: 'evidence item', mergeNodeId: 'draft-merge' } },
        { id: 'draft-to-merge', source: 'draft-template', target: 'draft-merge', mode: 'normal' },
        { id: 'merge-polish', source: 'draft-merge', target: 'polish-content', mode: 'normal' },
        { id: 'polish-review', source: 'polish-content', target: 'content-review', mode: 'normal' },
        { id: 'review-schedule', source: 'content-review', target: 'schedule-post', mode: 'conditional', label: 'approve', condition: 'review.approved' },
        { id: 'review-revise', source: 'content-review', target: 'revise-content', mode: 'conditional', label: 'revise', condition: 'review.revisionRequested' },
        { id: 'revise-review', source: 'revise-content', target: 'content-review', mode: 'normal', loopCap: 2 },
        { id: 'schedule-published', source: 'schedule-post', target: 'content-published', mode: 'normal' },
      ],
      [],
      durability({
        state: { enabled: true, schema: { fields: ['evidence', 'drafts', 'review'], summary: 'Per-run evidence and draft set.' }, reducers: [{ key: 'drafts', summary: 'Aggregate candidate drafts' }] },
        store: { available: true, namespace: 'saved_data', retention: 'cross-thread dedupe and preferences' },
      }),
    ),
  },
  {
    id: 'multi-stage-expert-review',
    title: 'Multi-Stage Expert Review',
    outcome: 'Compare expert perspectives, challenge a proposal, and produce a review decision.',
    domain: 'analysis',
    complexity: 'advanced',
    concepts: ['tool loop', 'debate loop', 'multi-stage review'],
    source: source('TauricResearch', 'TradingAgents', 'Verified optional checkpointing and decision-log availability are represented as capabilities; runtime analyst selection remains omitted.'),
    graph: graph(
      'library-multi-stage-expert-review',
      'Multi-Stage Expert Review',
      [
        start('review-start', 40, 220), step('gather-signals', 'Gather signals', 'ai', 220, 220), step('inspect-signals', 'Inspect supporting data', 'tool', 420, 220), step('support-case', 'Develop supporting case', 'ai', 650, 140), step('challenge-case', 'Develop challenge case', 'ai', 650, 300), step('review-judge', 'Judge expert review', 'ai', 880, 220), step('risk-challenge', 'Challenge decision risk', 'ai', 1100, 140), step('risk-balance', 'Balance decision risk', 'ai', 1100, 300), step('final-review', 'Finalize review', 'ai', 1330, 220), end('review-complete', 'Review complete', 1540, 220),
      ],
      [
        { id: 'review-gather', source: 'review-start', target: 'gather-signals', mode: 'normal' }, { id: 'gather-inspect', source: 'gather-signals', target: 'inspect-signals', mode: 'conditional', label: 'inspect data', condition: 'signals.needEvidence' }, { id: 'gather-support', source: 'gather-signals', target: 'support-case', mode: 'conditional', label: 'sufficient evidence', condition: 'signals.ready' }, { id: 'inspect-gather', source: 'inspect-signals', target: 'gather-signals', mode: 'normal', loopCap: 2 }, { id: 'support-challenge', source: 'support-case', target: 'challenge-case', mode: 'normal' }, { id: 'challenge-judge', source: 'challenge-case', target: 'review-judge', mode: 'normal' }, { id: 'judge-risk-challenge', source: 'review-judge', target: 'risk-challenge', mode: 'normal' }, { id: 'risk-challenge-balance', source: 'risk-challenge', target: 'risk-balance', mode: 'normal' }, { id: 'risk-balance-challenge', source: 'risk-balance', target: 'risk-challenge', mode: 'conditional', label: 'recheck risk', condition: 'risk.needsRecheck', loopCap: 2 }, { id: 'risk-balance-final', source: 'risk-balance', target: 'final-review', mode: 'conditional', label: 'risk accepted', condition: 'risk.accepted' }, { id: 'final-complete', source: 'final-review', target: 'review-complete', mode: 'normal' },
      ],
      [],
      durability({
        state: { enabled: true, schema: { fields: ['reports', 'debate', 'decision'], summary: 'Per-run analyst reports and debate state.' }, reducers: [{ key: 'messages', summary: 'Append debate messages' }] },
        checkpointer: { enabled: true, backend: 'SqliteSaver (optional)', durableThread: { required: false, threadIdSource: 'ticker/date/graph signature' } },
        store: { available: true, namespace: 'decision log', retention: 'cross-run reflections' },
      }),
    ),
  },
  {
    id: 'guarded-natural-language-to-sql',
    title: 'Guarded Natural-Language-to-SQL',
    outcome: 'Validate an analytical request, repair a query when needed, and run an approved read.',
    domain: 'data',
    complexity: 'intermediate',
    concepts: ['guardrail', 'conditional repair', 'approval gate'],
    source: source('tharunramavath', 'AI-Powered-SQL-Agent', 'Verified state, MemorySaver checkpointing, and bounded conversation memory are represented as capabilities; live database execution details remain inspector-only.'),
    graph: graph(
      'library-guarded-natural-language-to-sql',
      'Guarded Natural-Language-to-SQL',
      [
        start('sql-start', 40, 220), step('check-request', 'Check request policy', 'deterministic', 220, 220, { modifiers: { guardrail: true } }), step('shape-query', 'Shape analytical query', 'ai', 450, 220, { storeAccess: { read: { namespace: 'conversation', key: 'recent_messages' } } }), step('validate-query', 'Validate query', 'tool', 680, 220), step('run-query', 'Run approved query', 'tool', 930, 140, { sensitive: { target: 'Analytical database read', authorization: 'Data steward', approvalRequired: true, idempotency: 'Query request key' }, hitl: { enabled: true, timing: 'before', response: { type: 'approval', allowedOutcomes: [{ id: 'approve', label: 'Approve query', resumeNodeId: 'sql-complete' }] } } }), end('sql-rejected', 'Request rejected', 450, 420), end('sql-complete', 'Query complete', 1180, 140),
      ],
      [
        { id: 'sql-check', source: 'sql-start', target: 'check-request', mode: 'normal' }, { id: 'check-shape', source: 'check-request', target: 'shape-query', mode: 'conditional', label: 'permitted', condition: 'policy.permitted' }, { id: 'check-reject', source: 'check-request', target: 'sql-rejected', mode: 'conditional', label: 'reject', condition: 'policy.rejected' }, { id: 'shape-validate', source: 'shape-query', target: 'validate-query', mode: 'normal' }, { id: 'validate-run', source: 'validate-query', target: 'run-query', mode: 'conditional', label: 'valid', condition: 'query.valid' }, { id: 'validate-repair', source: 'validate-query', target: 'shape-query', mode: 'conditional', label: 'repair', condition: 'query.needsRepair', loopCap: 3 }, { id: 'run-complete', source: 'run-query', target: 'sql-complete', mode: 'normal' },
      ],
      [],
      durability({
        state: { enabled: true, schema: { fields: ['query', 'attempts', 'approval', 'result'], summary: 'Per-run SQL request and result.' }, reducers: [{ key: 'attempts', summary: 'Accumulate generation attempts' }] },
        checkpointer: { enabled: true, backend: 'MemorySaver', durableThread: { required: true, threadIdSource: 'request.threadId' } },
        store: { available: true, namespace: 'conversation', retention: 'bounded in-process history' },
      }),
    ),
  },
  {
    id: 'email-triage-with-human-review',
    title: 'Email Triage with Human Review',
    outcome: 'Route a message to a review path or an assisted response loop.',
    domain: 'communications',
    complexity: 'advanced',
    concepts: ['command routing', 'subgraph', 'human review'],
    source: source('langchain-ai', 'agents-from-scratch-ts', 'Verified in-process preference Store access is represented; runtime tool inventories remain deferred.'),
    graph: graph(
      'library-email-triage-with-human-review',
      'Email Triage with Human Review',
      [
        start('email-start', 40, 220), step('classify-message', 'Classify message', 'ai', 220, 220, { storeAccess: { read: { namespace: 'preferences', key: 'profile' } } }), step('notification-review', 'Review notification', 'human', 470, 350, { storeAccess: { write: { namespace: 'preferences', key: 'triage' } }, hitl: { enabled: true, timing: 'inside', response: { type: 'selection', selectionChoices: [{ id: 'respond', label: 'Respond' }, { id: 'dismiss', label: 'Dismiss' }], allowedOutcomes: [{ id: 'respond', label: 'Prepare response', resumeNodeId: 'enter-response-cell' }, { id: 'dismiss', label: 'Dismiss message', resumeNodeId: 'email-dismissed' }] } } }), step('enter-response-cell', 'Enter response assistant', 'deterministic', 470, 100), start('response-start', 650, 100, 'response-cell'), step('decide-response', 'Decide next response action', 'ai', 840, 100, { parentId: 'response-cell', storeAccess: { read: { namespace: 'preferences', key: 'profile' } } }), step('review-response-action', 'Review response action', 'human', 1060, 100, { parentId: 'response-cell', storeAccess: { write: { namespace: 'preferences', key: 'profile' } }, hitl: { enabled: true, timing: 'inside', response: { type: 'text', allowedOutcomes: [{ id: 'continue', label: 'Continue response', resumeNodeId: 'decide-response' }] } } }), end('response-end', 'Response complete', 1280, 100, 'response-cell'), end('email-dismissed', 'Message dismissed', 760, 420), end('email-complete', 'Email handled', 1540, 220),
      ],
      [
        { id: 'email-classify', source: 'email-start', target: 'classify-message', mode: 'normal' }, { id: 'classify-ignore', source: 'classify-message', target: 'email-dismissed', mode: 'command', label: 'ignore', condition: 'triage.ignore' }, { id: 'classify-notify', source: 'classify-message', target: 'notification-review', mode: 'command', label: 'notify', condition: 'triage.notify' }, { id: 'classify-respond', source: 'classify-message', target: 'enter-response-cell', mode: 'command', label: 'respond', condition: 'triage.respond' }, { id: 'notification-response', source: 'notification-review', target: 'enter-response-cell', mode: 'conditional', label: 'respond', condition: 'review.respond' }, { id: 'notification-dismiss', source: 'notification-review', target: 'email-dismissed', mode: 'conditional', label: 'dismiss', condition: 'review.dismiss' }, { id: 'enter-response', source: 'enter-response-cell', target: 'response-start', mode: 'normal' }, { id: 'response-decide', source: 'response-start', target: 'decide-response', mode: 'normal' }, { id: 'decide-review', source: 'decide-response', target: 'review-response-action', mode: 'conditional', label: 'review action', condition: 'response.needsReview' }, { id: 'decide-finish', source: 'decide-response', target: 'response-end', mode: 'conditional', label: 'finish', condition: 'response.complete' }, { id: 'review-decide', source: 'review-response-action', target: 'decide-response', mode: 'normal', loopCap: 2 }, { id: 'response-exit', source: 'response-end', target: 'email-complete', mode: 'normal' },
      ],
      [{ id: 'response-cell', label: 'Response assistant', position: { x: 420, y: 40 }, dimensions: { width: 790, height: 220 }, collapsed: false }],
      durability({
        state: { enabled: true, schema: { fields: ['email', 'messages', 'classification'], summary: 'Per-run email and response context.' }, reducers: [{ key: 'messages', summary: 'Append conversation messages' }] },
        store: { available: true, namespace: 'preferences', retention: 'running graph instance' },
      }),
    ),
  },
  {
    id: 'human-approved-incident-response',
    title: 'Human-Approved Incident Response',
    outcome: 'Triage an alert, research material incidents, and carry out an approved response.',
    domain: 'operations',
    complexity: 'intermediate',
    concepts: ['guardrail', 'human approval', 'sensitive action'],
    source: source('AttiR', 'OpsCanvas', 'External retry, escalation, and dead-letter orchestration are intentionally not rendered as in-graph edges.'),
    graph: graph(
      'library-human-approved-incident-response',
      'Human-Approved Incident Response',
      [
        start('incident-start', 40, 220), step('triage-alert', 'Triage alert', 'ai', 230, 220, { modifiers: { guardrail: true } }), step('research-incident', 'Research incident', 'tool', 470, 220, { modifiers: { readiness: 'degraded' } }), step('draft-response', 'Draft incident response', 'ai', 700, 220), step('apply-response', 'Apply approved response', 'tool', 950, 220, { sensitive: { target: 'Incident response action', authorization: 'Incident commander', approvalRequired: true, idempotency: 'Incident action key' }, hitl: { enabled: true, timing: 'before', activation: { reason: 'Operational action requires commander approval.' }, response: { type: 'approval', allowedOutcomes: [{ id: 'approve', label: 'Approve response', resumeNodeId: 'incident-resolved' }] } } }), end('incident-auto-closed', 'Auto-closed alert', 480, 420), end('incident-resolved', 'Incident response complete', 1210, 220),
      ],
      [
        { id: 'incident-triage', source: 'incident-start', target: 'triage-alert', mode: 'normal' }, { id: 'triage-close', source: 'triage-alert', target: 'incident-auto-closed', mode: 'conditional', label: 'low impact', condition: 'triage.autoClose' }, { id: 'triage-research', source: 'triage-alert', target: 'research-incident', mode: 'conditional', label: 'investigate', condition: 'triage.requiresResearch' }, { id: 'research-draft', source: 'research-incident', target: 'draft-response', mode: 'normal' }, { id: 'draft-apply', source: 'draft-response', target: 'apply-response', mode: 'normal' }, { id: 'apply-complete', source: 'apply-response', target: 'incident-resolved', mode: 'normal' },
      ],
      [],
      durability({
        state: { enabled: true, schema: { fields: ['alert', 'approval', 'action'], summary: 'Per-run incident and approval state.' }, reducers: [] },
        checkpointer: { enabled: true, backend: 'RedisSaver with MemorySaver fallback', durableThread: { required: true, threadIdSource: 'run_id' } },
      }),
    ),
  },
  {
    id: 'specialist-travel-support',
    title: 'Specialist Travel Support',
    outcome: 'Route a traveler to a specialist and gate a sensitive itinerary change.',
    domain: 'support',
    complexity: 'intermediate',
    concepts: ['specialist routing', 'safe/sensitive tools', 'handoff loop'],
    source: source('ro-anderson', 'multi-agent-rag-customer-support', 'Verified MemorySaver and dialog-stack reducer scope are represented; concrete tool fallbacks remain deferred.'),
    graph: graph(
      'library-specialist-travel-support',
      'Specialist Travel Support',
      [
        start('travel-start', 40, 240), step('travel-triage', 'Route traveler request', 'ai', 230, 240), step('answer-account-question', 'Answer account question', 'tool', 500, 120), step('plan-itinerary-change', 'Plan itinerary change', 'ai', 500, 340), step('apply-itinerary-change', 'Apply itinerary change', 'tool', 760, 340, { sensitive: { target: 'Traveler itinerary', authorization: 'Traveler confirmation', approvalRequired: true, idempotency: 'Itinerary change key' }, hitl: { enabled: true, timing: 'before', response: { type: 'approval', allowedOutcomes: [{ id: 'approve', label: 'Approve change', resumeNodeId: 'travel-complete' }] } } }), end('travel-complete', 'Traveler request complete', 1030, 240),
      ],
      [
        { id: 'travel-triage', source: 'travel-start', target: 'travel-triage', mode: 'normal' }, { id: 'triage-account', source: 'travel-triage', target: 'answer-account-question', mode: 'conditional', label: 'account question', condition: 'request.account' }, { id: 'triage-change', source: 'travel-triage', target: 'plan-itinerary-change', mode: 'conditional', label: 'itinerary change', condition: 'request.change' }, { id: 'triage-complete', source: 'travel-triage', target: 'travel-complete', mode: 'conditional', label: 'complete', condition: 'request.complete' }, { id: 'account-triage', source: 'answer-account-question', target: 'travel-triage', mode: 'command', label: 'continue support', condition: 'support.needsFollowUp', loopCap: 2 }, { id: 'account-complete', source: 'answer-account-question', target: 'travel-complete', mode: 'command', label: 'answer delivered', condition: 'support.resolved' }, { id: 'plan-apply', source: 'plan-itinerary-change', target: 'apply-itinerary-change', mode: 'normal' }, { id: 'apply-complete', source: 'apply-itinerary-change', target: 'travel-complete', mode: 'normal' },
      ],
      [],
      durability({
        state: { enabled: true, schema: { fields: ['messages', 'userInfo', 'dialogState'], summary: 'Per-run traveler and dialog state.' }, reducers: [{ key: 'dialogState', summary: 'Push and pop specialist context' }] },
        checkpointer: { enabled: true, backend: 'MemorySaver', durableThread: { required: true, threadIdSource: 'configurable.thread_id' } },
      }),
    ),
  },
  {
    id: 'voice-specialist-handoffs',
    title: 'Voice Specialist Handoffs',
    outcome: 'Hand a conversation between role-scoped specialists and end the current turn safely.',
    domain: 'voice support',
    complexity: 'advanced',
    concepts: ['command handoff', 'opaque agent', 'end of turn'],
    source: source('langchain-ai', 'pipecat-langgraph-example', 'Voice-mode transcript-derived state is represented as runtime metadata; generated agent internals remain omitted.'),
    graph: graph(
      'library-voice-specialist-handoffs',
      'Voice Specialist Handoffs',
      [
        start('voice-start', 40, 220), step('voice-triage', 'Voice triage', 'ai', 250, 220, { opaque: opaque('Voice triage factory'), participation: { internalTools: true } }), step('membership-specialist', 'Membership specialist', 'ai', 520, 80, { opaque: opaque('Membership specialist factory'), participation: { internalTools: true }, sensitive: { target: 'Membership status', authorization: 'Member request', approvalRequired: false, idempotency: 'Conversation turn key' } }), step('credit-specialist', 'Credit specialist', 'ai', 520, 220, { opaque: opaque('Credit specialist factory'), participation: { internalTools: true } }), step('booking-specialist', 'Booking specialist', 'ai', 520, 360, { opaque: opaque('Booking specialist factory'), participation: { internalTools: true }, sensitive: { target: 'Class booking', authorization: 'Member request', approvalRequired: false, idempotency: 'Conversation turn key' } }), end('voice-turn-complete', 'End of turn', 840, 220),
      ],
      [
        { id: 'voice-triage', source: 'voice-start', target: 'voice-triage', mode: 'conditional', label: 'default owner', condition: 'owner.default' }, { id: 'voice-membership', source: 'voice-start', target: 'membership-specialist', mode: 'conditional', label: 'membership owner', condition: 'owner.membership' }, { id: 'voice-credit', source: 'voice-start', target: 'credit-specialist', mode: 'conditional', label: 'credit owner', condition: 'owner.credit' }, { id: 'voice-booking', source: 'voice-start', target: 'booking-specialist', mode: 'conditional', label: 'booking owner', condition: 'owner.booking' }, { id: 'triage-membership', source: 'voice-triage', target: 'membership-specialist', mode: 'command', label: 'handoff membership', condition: 'handoff.membership' }, { id: 'triage-credit', source: 'voice-triage', target: 'credit-specialist', mode: 'command', label: 'handoff credit', condition: 'handoff.credit' }, { id: 'triage-booking', source: 'voice-triage', target: 'booking-specialist', mode: 'command', label: 'handoff booking', condition: 'handoff.booking' }, { id: 'triage-end', source: 'voice-triage', target: 'voice-turn-complete', mode: 'command', label: 'reply complete', condition: 'turn.complete' }, { id: 'membership-triage', source: 'membership-specialist', target: 'voice-triage', mode: 'command', label: 'return to triage', condition: 'handoff.triage' }, { id: 'membership-end', source: 'membership-specialist', target: 'voice-turn-complete', mode: 'command', label: 'reply complete', condition: 'turn.complete' }, { id: 'credit-triage', source: 'credit-specialist', target: 'voice-triage', mode: 'command', label: 'return to triage', condition: 'handoff.triage' }, { id: 'credit-end', source: 'credit-specialist', target: 'voice-turn-complete', mode: 'command', label: 'reply complete', condition: 'turn.complete' }, { id: 'booking-triage', source: 'booking-specialist', target: 'voice-triage', mode: 'command', label: 'return to triage', condition: 'handoff.triage' }, { id: 'booking-end', source: 'booking-specialist', target: 'voice-turn-complete', mode: 'command', label: 'reply complete', condition: 'turn.complete' },
      ],
      [],
      durability({
        state: { enabled: true, schema: { fields: ['messages', 'activeAgent'], summary: 'Voice-mode transcript-derived conversation context.' }, reducers: [{ key: 'messages', summary: 'Append transcript messages' }] },
        runtimeMode: { mode: 'voice', input: 'audio' },
      }),
    ),
  },
  {
    id: 'parallel-research-with-reflection',
    title: 'Parallel Research with Reflection',
    outcome: 'Map focused questions to researchers, merge findings, and refine a final synthesis.',
    domain: 'research',
    complexity: 'advanced',
    concepts: ['send fan-out', 'merge', 'reflection loop'],
    source: source('google-gemini', 'gemini-fullstack-langgraph-quickstart', 'Reducer-backed working state is represented as a capability; live web retrieval and runtime worker cardinality remain deferred.'),
    graph: graph(
      'library-parallel-research-with-reflection',
      'Parallel Research with Reflection',
      [
        start('parallel-start', 40, 220), step('formulate-questions', 'Formulate research questions', 'ai', 220, 220), step('dispatch-questions', 'Dispatch research questions', 'deterministic', 440, 220), step('researcher-template', 'Researcher template', 'tool', 650, 220), { id: 'research-merge', kind: 'merge', label: 'Merge research findings', position: { x: 880, y: 220 }, merge: { reducer: { name: 'merge_findings', aggregateState: 'findings' }, completion: { mode: 'all' }, continuation: { mode: 'once' }, waitingForDynamicInputs: true } }, step('synthesize-findings', 'Synthesize findings', 'ai', 1100, 220), step('reflect-on-answer', 'Reflect on answer', 'ai', 1330, 220), end('research-answer-complete', 'Research answer complete', 1580, 140),
      ],
      [
        { id: 'parallel-formulate', source: 'parallel-start', target: 'formulate-questions', mode: 'normal' }, { id: 'formulate-dispatch', source: 'formulate-questions', target: 'dispatch-questions', mode: 'normal' }, { id: 'questions-send', source: 'dispatch-questions', target: 'researcher-template', mode: 'send', send: { destinationTemplateId: 'researcher-template', multiplicity: 'dynamic', payloadLabel: 'research question', mergeNodeId: 'research-merge' } }, { id: 'researcher-merge', source: 'researcher-template', target: 'research-merge', mode: 'normal' }, { id: 'merge-synthesize', source: 'research-merge', target: 'synthesize-findings', mode: 'normal' }, { id: 'synthesize-reflect', source: 'synthesize-findings', target: 'reflect-on-answer', mode: 'normal' }, { id: 'reflect-complete', source: 'reflect-on-answer', target: 'research-answer-complete', mode: 'conditional', label: 'answer sufficient', condition: 'reflection.complete' }, { id: 'reflect-refine', source: 'reflect-on-answer', target: 'formulate-questions', mode: 'conditional', label: 'refine research', condition: 'reflection.refine', loopCap: 2 },
      ],
      [],
      durability({
        state: { enabled: true, schema: { fields: ['searchQuery', 'webResearchResult', 'sourcesGathered', 'followUpQueries'], summary: 'Per-run research aggregate.' }, reducers: [{ key: 'webResearchResult', summary: 'Append research results' }, { key: 'sourcesGathered', summary: 'Append cited sources' }] },
      }),
    ),
  },
];

export type GraphLibraryRegistryIssue = {
  code:
    | 'ENTRY_COUNT'
    | 'DUPLICATE_ID'
    | 'INVALID_SOURCE'
    | 'INVALID_GRAPH'
    | 'EMPTY_SCENARIOS'
    | 'SCENARIO_BUDGET_EXCEEDED';
  entryId?: string;
  reason?: string;
};

type ScenarioEnumerator = (graph: WorkflowGraph) => ScenarioEnumerationResult;

function inspectGraphLibraryDefinitions(
  entries: readonly GraphLibraryDefinition[],
  enumerate: ScenarioEnumerator,
): { issues: GraphLibraryRegistryIssue[]; materialized: GraphLibraryEntry[] } {
  const issues: GraphLibraryRegistryIssue[] = [];
  const materialized: GraphLibraryEntry[] = [];
  if (entries.length !== GRAPH_LIBRARY_ENTRY_COUNT) issues.push({ code: 'ENTRY_COUNT' });
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) issues.push({ code: 'DUPLICATE_ID', entryId: entry.id });
    ids.add(entry.id);
    const canonicalUrl = `https://github.com/${entry.source.owner}/${entry.source.repository}`;
    if (!/^https:\/\/github\.com\/[^/?#]+\/[^/?#]+$/.test(entry.source.url) || entry.source.url !== canonicalUrl) {
      issues.push({ code: 'INVALID_SOURCE', entryId: entry.id });
    }
    const graph = structuredClone(entry.graph);
    const graphIssues = validateGraph(graph);
    if (graphIssues.length > 0) {
      issues.push({ code: 'INVALID_GRAPH', entryId: entry.id, reason: graphIssues.map((issue) => `${issue.code}@${issue.path ?? ''}`).join('|') });
      continue;
    }
    const enumeration = enumerate(graph);
    if (!enumeration.ok) {
      issues.push({
        code: 'SCENARIO_BUDGET_EXCEEDED',
        entryId: entry.id,
        reason: `${enumeration.code}: ${enumeration.message}`,
      });
      continue;
    }
    if (enumeration.scenarios.length === 0) {
      issues.push({ code: 'EMPTY_SCENARIOS', entryId: entry.id });
      continue;
    }
    materialized.push({
      ...entry,
      graph,
      scenarioSummary: {
        pathCount: enumeration.scenarios.length,
        scenarios: enumeration.scenarios,
      },
    });
  }
  return { issues, materialized };
}

/** Validation keeps fixtures honest before presentation code consumes them. */
export function validateGraphLibraryDefinitions(
  entries: readonly GraphLibraryDefinition[],
  enumerate: ScenarioEnumerator = enumerateScenariosBounded,
): GraphLibraryRegistryIssue[] {
  return inspectGraphLibraryDefinitions(entries, enumerate).issues;
}

export function createGraphLibraryEntries(
  entries: readonly GraphLibraryDefinition[],
  enumerate: ScenarioEnumerator = enumerateScenariosBounded,
): Promise<readonly GraphLibraryEntry[]> {
  return Promise.all(entries.map(async (entry) => ({
    ...entry,
    graph: entry.layout?.preserveGraphGeometry
      ? structuredClone(entry.graph)
      : await layoutWorkflowGraph(
        entry.graph,
        entry.layout?.authoredSubgraphIds
          ? { authoredSubgraphIds: new Set(entry.layout.authoredSubgraphIds) }
          : undefined,
      ),
  }))).then((laidOutEntries) => {
    const { issues, materialized } = inspectGraphLibraryDefinitions(laidOutEntries, enumerate);
    if (issues.length === 0) return materialized;
    throw new Error(
      `Invalid graph library registry: ${issues.map((issue) => `${issue.code}${issue.entryId ? `:${issue.entryId}` : ''}${issue.reason ? ` (${issue.reason})` : ''}`).join(', ')}`,
    );
  });
}

function createPrelaidGraphLibraryEntries(
  entries: readonly GraphLibraryDefinition[],
  enumerate: ScenarioEnumerator = enumerateScenariosBounded,
): readonly GraphLibraryEntry[] {
  const { issues, materialized } = inspectGraphLibraryDefinitions(entries, enumerate);
  if (issues.length > 0) {
    throw new Error(
      `Invalid graph library registry: ${issues.map((issue) => `${issue.code}${issue.entryId ? `:${issue.entryId}` : ''}${issue.reason ? ` (${issue.reason})` : ''}`).join(', ')}`,
    );
  }
  return materialized;
}

/**
 * Display code needs a synchronous registry. These source fixtures carry their
 * authored geometry already; callers that materialize supplied definitions use
 * the asynchronous ELK-backed `createGraphLibraryEntries` above.
 */
export const graphLibraryEntries = createPrelaidGraphLibraryEntries(definitions);
