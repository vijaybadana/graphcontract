import { z } from 'zod';

export const nodeKinds = [
  'start',
  'agent',
  'action',
  'tool',
  'human_input',
  'end',
] as const;

export type NodeKind = (typeof nodeKinds)[number];
export type EdgeMode = 'normal' | 'conditional' | 'command' | 'fallback';

export type HitlConfig = {
  enabled: boolean;
  timing?: 'before' | 'after' | 'conditional';
  inputType?: 'approval' | 'text' | 'selection';
  condition?: string;
};

export type GraphPosition = { x: number; y: number };
export type GraphDimensions = { width: number; height: number };

export type GraphSubgraph = {
  id: string;
  label: string;
  position: GraphPosition;
  dimensions: GraphDimensions;
  collapsed: boolean;
};

export type GraphNode = {
  id: string;
  kind: NodeKind;
  label: string;
  description?: string;
  /** Relative to its parent subgraph when parentId is present. */
  position: GraphPosition;
  parentId?: string;
  config?: Record<string, unknown>;
  hitl?: HitlConfig;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  mode: EdgeMode;
  label?: string;
  condition?: string;
};

export type WorkflowGraph = {
  schemaVersion: '1';
  id: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  subgraphs: GraphSubgraph[];
  status: 'draft' | 'frozen';
  updatedAt: string;
};

export type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type GraphOperation =
  | { type: 'add_node'; node: GraphNode }
  | {
      type: 'update_node';
      nodeId: string;
      patch: Partial<Omit<GraphNode, 'id' | 'parentId'>>;
    }
  | { type: 'remove_node'; nodeId: string }
  | { type: 'add_subgraph'; subgraph: GraphSubgraph }
  | {
      type: 'update_subgraph';
      subgraphId: string;
      patch: Partial<Omit<GraphSubgraph, 'id'>>;
    }
  | { type: 'assign_nodes_to_subgraph'; subgraphId: string; nodeIds: string[] }
  | { type: 'remove_nodes_from_subgraph'; nodeIds: string[] }
  | { type: 'dissolve_subgraph'; subgraphId: string }
  | { type: 'add_edge'; edge: GraphEdge }
  | {
      type: 'update_edge';
      edgeId: string;
      patch: Partial<Omit<GraphEdge, 'id'>>;
    }
  | { type: 'remove_edge'; edgeId: string };

export type ProposalDiff = {
  addedNodeIds: string[];
  updatedNodeIds: string[];
  removedNodeIds: string[];
  addedSubgraphIds: string[];
  updatedSubgraphIds: string[];
  removedSubgraphIds: string[];
  membershipChangedNodeIds: string[];
  addedEdgeIds: string[];
  updatedEdgeIds: string[];
  removedEdgeIds: string[];
};

export type GraphProposal = {
  id: string;
  baseGraphId: string;
  baseUpdatedAt: string;
  operations: GraphOperation[];
  rationale: string;
  status: 'pending' | 'approved' | 'rejected' | 'invalid' | 'stale';
  createdAt: string;
  validationErrors?: ValidationIssue[];
  diff: ProposalDiff;
};

export type BranchCondition = {
  nodeId: string;
  nodeLabel: string;
  edgeId: string;
  label: string;
  condition?: string;
  isFallback?: boolean;
};

export type BranchScenario = {
  id: string;
  name: string;
  triggeringConditions: BranchCondition[];
  orderedPath: string[];
  expectedNodes: string[];
  expectedTerminalNode: string;
};

const positionSchema = z.object({ x: z.number(), y: z.number() });
const dimensionsSchema = z.object({ width: z.number().positive(), height: z.number().positive() });

export const hitlSchema = z.object({
  enabled: z.boolean(),
  timing: z.enum(['before', 'after', 'conditional']).optional(),
  inputType: z.enum(['approval', 'text', 'selection']).optional(),
  condition: z.string().optional(),
});

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(nodeKinds),
  label: z.string().min(1),
  description: z.string().optional(),
  position: positionSchema,
  parentId: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  hitl: hitlSchema.optional(),
});

export const graphSubgraphSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  position: positionSchema,
  dimensions: dimensionsSchema,
  collapsed: z.boolean(),
});

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  mode: z.enum(['normal', 'conditional', 'command', 'fallback']),
  label: z.string().optional(),
  condition: z.string().optional(),
});

export const workflowGraphSchema = z.object({
  schemaVersion: z.literal('1'),
  id: z.string().min(1),
  name: z.string().min(1),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  // A default keeps every pre-subgraph persisted graph readable without
  // changing its node positions, topology, or other authored data.
  subgraphs: z.array(graphSubgraphSchema).default([]),
  status: z.enum(['draft', 'frozen']),
  updatedAt: z.string().min(1),
});

export const graphOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_node'), node: graphNodeSchema }),
  z.object({
    type: z.literal('update_node'),
    nodeId: z.string().min(1),
    patch: graphNodeSchema.omit({ id: true, parentId: true }).partial().strict(),
  }),
  z.object({ type: z.literal('remove_node'), nodeId: z.string().min(1) }),
  z.object({ type: z.literal('add_subgraph'), subgraph: graphSubgraphSchema }),
  z.object({
    type: z.literal('update_subgraph'),
    subgraphId: z.string().min(1),
    patch: graphSubgraphSchema.omit({ id: true }).partial().strict(),
  }),
  z.object({
    type: z.literal('assign_nodes_to_subgraph'),
    subgraphId: z.string().min(1),
    nodeIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('remove_nodes_from_subgraph'),
    nodeIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({ type: z.literal('dissolve_subgraph'), subgraphId: z.string().min(1) }),
  z.object({ type: z.literal('add_edge'), edge: graphEdgeSchema }),
  z.object({
    type: z.literal('update_edge'),
    edgeId: z.string().min(1),
    patch: graphEdgeSchema.omit({ id: true }).partial(),
  }),
  z.object({ type: z.literal('remove_edge'), edgeId: z.string().min(1) }),
]);

export const proposalInputSchema = z.object({
  operations: z.array(graphOperationSchema).min(1),
  rationale: z.string().min(1),
  expectedGraphUpdatedAt: z.string().min(1).optional(),
});

export const sampleGraph: WorkflowGraph = {
  schemaVersion: '1',
  id: 'customer-support-contract',
  name: 'Customer Support Workflow',
  status: 'draft',
  updatedAt: '2026-08-28T00:00:00.000Z',
  nodes: [
    { id: 'start', kind: 'start', label: 'Start', position: { x: 40, y: 230 } },
    {
      id: 'classifier',
      kind: 'agent',
      label: 'Classifier Agent',
      description: 'Classifies the support request.',
      position: { x: 230, y: 220 },
    },
    {
      id: 'billing',
      kind: 'agent',
      label: 'Billing Agent',
      position: { x: 480, y: 60 },
    },
    {
      id: 'diagnostic',
      kind: 'action',
      label: 'Diagnostic Action',
      position: { x: 480, y: 220 },
    },
    {
      id: 'human',
      kind: 'human_input',
      label: 'Human Input',
      position: { x: 480, y: 380 },
    },
    {
      id: 'refund',
      kind: 'tool',
      label: 'Refund Tool',
      position: { x: 730, y: 60 },
    },
    { id: 'end', kind: 'end', label: 'End', position: { x: 940, y: 220 } },
  ],
  edges: [
    { id: 'start-classifier', source: 'start', target: 'classifier', mode: 'normal' },
    {
      id: 'classifier-billing',
      source: 'classifier',
      target: 'billing',
      mode: 'conditional',
      label: 'billing',
    },
    {
      id: 'classifier-diagnostic',
      source: 'classifier',
      target: 'diagnostic',
      mode: 'conditional',
      label: 'technical',
    },
    {
      id: 'classifier-human',
      source: 'classifier',
      target: 'human',
      mode: 'conditional',
      label: 'unknown',
    },
    { id: 'billing-refund', source: 'billing', target: 'refund', mode: 'normal' },
    { id: 'refund-end', source: 'refund', target: 'end', mode: 'normal' },
    { id: 'diagnostic-end', source: 'diagnostic', target: 'end', mode: 'normal' },
    { id: 'human-end', source: 'human', target: 'end', mode: 'normal' },
  ],
  subgraphs: [],
};

/** A compact valid fixture for the first-class subgraph interaction. */
export const researchSupervisorGraph: WorkflowGraph = {
  schemaVersion: '1',
  id: 'research-supervisor-demo',
  name: 'Research Supervisor Workflow',
  status: 'draft',
  updatedAt: '2026-08-29T00:00:00.000Z',
  nodes: [
    {
      id: 'research-outer-start',
      kind: 'start',
      label: 'Start',
      position: { x: 60, y: 250 },
    },
    {
      id: 'research-subgraph-start',
      kind: 'start',
      label: 'Research Start',
      parentId: 'research-supervisor',
      position: { x: 36, y: 130 },
    },
    {
      id: 'research-supervisor-agent',
      kind: 'agent',
      label: 'Supervisor',
      description: 'Plans the research sequence and synthesizes the result.',
      parentId: 'research-supervisor',
      position: { x: 220, y: 130 },
      config: { role: 'research_supervisor', capability: 'ai' },
    },
    {
      id: 'research-supervisor-tools',
      kind: 'tool',
      label: 'Supervisor Tools',
      description: 'Research retrieval and source-review tools available to the supervisor.',
      parentId: 'research-supervisor',
      position: { x: 415, y: 130 },
      config: { capability: 'research_tools', tools: ['search', 'source_review'] },
    },
    {
      id: 'research-subgraph-end',
      kind: 'end',
      label: 'Research Complete',
      parentId: 'research-supervisor',
      position: { x: 600, y: 130 },
    },
    {
      id: 'research-outer-end',
      kind: 'end',
      label: 'End',
      position: { x: 930, y: 250 },
    },
  ],
  edges: [
    {
      id: 'research-enter-subgraph',
      source: 'research-outer-start',
      target: 'research-subgraph-start',
      mode: 'normal',
    },
    {
      id: 'research-start-supervisor',
      source: 'research-subgraph-start',
      target: 'research-supervisor-agent',
      mode: 'normal',
    },
    {
      id: 'research-supervisor-tools',
      source: 'research-supervisor-agent',
      target: 'research-supervisor-tools',
      mode: 'normal',
    },
    {
      id: 'research-tools-end',
      source: 'research-supervisor-tools',
      target: 'research-subgraph-end',
      mode: 'normal',
    },
    {
      id: 'research-exit-subgraph',
      source: 'research-subgraph-end',
      target: 'research-outer-end',
      mode: 'normal',
    },
  ],
  subgraphs: [
    {
      id: 'research-supervisor',
      label: 'Research Supervisor',
      position: { x: 220, y: 120 },
      dimensions: { width: 760, height: 320 },
      collapsed: false,
    },
  ],
};

/** The canonical routing-semantics fixture. A return edge is normal topology,
 * so loop presentation can be derived without persisting a separate mode. */
export const researchIntakeRoutingGraph: WorkflowGraph = {
  schemaVersion: '1',
  id: 'research-intake-routing-demo',
  name: 'Research Intake Routing',
  status: 'draft',
  updatedAt: '2026-08-30T00:00:00.000Z',
  nodes: [
    { id: 'research-intake-start', kind: 'start', label: 'Start', position: { x: 40, y: 280 } },
    {
      id: 'clarify-request',
      kind: 'agent',
      label: 'Clarify Request',
      description: 'Clarifies the research request before authoring the brief.',
      position: { x: 180, y: 280 },
    },
    {
      id: 'awaiting-user-reply',
      kind: 'end',
      label: 'Awaiting user reply',
      position: { x: 420, y: 80 },
    },
    {
      id: 'write-research-brief',
      kind: 'agent',
      label: 'Write Research Brief',
      position: { x: 480, y: 280 },
    },
    {
      id: 'research-supervisor',
      kind: 'agent',
      label: 'Research Supervisor',
      position: { x: 730, y: 280 },
    },
    {
      id: 'final-report',
      kind: 'agent',
      label: 'Final Report',
      position: { x: 980, y: 280 },
    },
    { id: 'report-complete', kind: 'end', label: 'Report complete', position: { x: 1180, y: 280 } },
    {
      id: 'researcher',
      kind: 'agent',
      label: 'Researcher',
      position: { x: 700, y: 500 },
    },
    {
      id: 'human-review',
      kind: 'end',
      label: 'Human Review',
      description: 'The fallback route ends in human review.',
      position: { x: 980, y: 500 },
    },
  ],
  edges: [
    { id: 'research-intake-start-clarify', source: 'research-intake-start', target: 'clarify-request', mode: 'normal' },
    {
      id: 'clarify-write-brief',
      source: 'clarify-request',
      target: 'write-research-brief',
      mode: 'command',
      label: 'ready',
      condition: 'state.ready === true',
    },
    {
      id: 'clarify-await-reply',
      source: 'clarify-request',
      target: 'awaiting-user-reply',
      mode: 'command',
      label: 'needs clarification',
      condition: 'state.needsClarification === true',
    },
    {
      id: 'brief-supervisor',
      source: 'write-research-brief',
      target: 'research-supervisor',
      mode: 'normal',
    },
    {
      id: 'supervisor-final-report',
      source: 'research-supervisor',
      target: 'final-report',
      mode: 'conditional',
      label: 'enough evidence',
      condition: 'evidence.isSufficient === true',
    },
    {
      id: 'supervisor-researcher',
      source: 'research-supervisor',
      target: 'researcher',
      mode: 'conditional',
      label: 'more research',
      condition: 'evidence.isSufficient === false',
    },
    {
      id: 'supervisor-human-review',
      source: 'research-supervisor',
      target: 'human-review',
      mode: 'fallback',
      label: 'fallback',
    },
    { id: 'final-report-complete', source: 'final-report', target: 'report-complete', mode: 'normal' },
    {
      id: 'researcher-continue',
      source: 'researcher',
      target: 'research-supervisor',
      mode: 'normal',
      label: 'continue',
    },
  ],
  subgraphs: [],
};

const issue = (code: string, message: string, path?: string): ValidationIssue => ({
  code,
  message,
  path,
});

export function validateGraph(graph: WorkflowGraph): ValidationIssue[] {
  const parsed = workflowGraphSchema.safeParse(graph);
  if (!parsed.success) {
    return parsed.error.issues.map((entry) =>
      issue('INVALID_SCHEMA', entry.message, entry.path.join('.')),
    );
  }

  const normalized = parsed.data;
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const subgraphIds = new Set<string>();
  const nodeById = new Map<string, GraphNode>();

  for (const subgraph of normalized.subgraphs) {
    if (subgraphIds.has(subgraph.id)) {
      issues.push(
        issue('DUPLICATE_SUBGRAPH_ID', `Subgraph ID “${subgraph.id}” is duplicated.`, `subgraphs.${subgraph.id}`),
      );
    }
    subgraphIds.add(subgraph.id);
  }

  for (const node of normalized.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push(issue('DUPLICATE_NODE_ID', `Node ID “${node.id}” is duplicated.`, `nodes.${node.id}`));
    }
    nodeIds.add(node.id);
    nodeById.set(node.id, node);
    if (subgraphIds.has(node.id)) {
      issues.push(
        issue(
          'SUBGRAPH_NODE_ID_CONFLICT',
          `Node ID “${node.id}” conflicts with a subgraph ID.`,
          `nodes.${node.id}`,
        ),
      );
    }
    if (node.parentId && !subgraphIds.has(node.parentId)) {
      issues.push(
        issue(
          'MISSING_NODE_PARENT',
          `Node “${node.label}” references a subgraph that does not exist.`,
          `nodes.${node.id}.parentId`,
        ),
      );
    }
    if (node.hitl?.enabled && !['agent', 'action', 'tool'].includes(node.kind)) {
      issues.push(
        issue(
          'INVALID_HITL_NODE',
          'Embedded human-in-the-loop controls are only allowed on Agent, Action, and Tool nodes.',
          `nodes.${node.id}.hitl`,
        ),
      );
    }
  }

  for (const edge of normalized.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push(issue('DUPLICATE_EDGE_ID', `Edge ID “${edge.id}” is duplicated.`, `edges.${edge.id}`));
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push(
        issue(
          'MISSING_EDGE_NODE',
          `Edge “${edge.id}” references a node that does not exist.`,
          `edges.${edge.id}`,
        ),
      );
      continue;
    }

    const source = nodeById.get(edge.source)!;
    const target = nodeById.get(edge.target)!;
    if (source.parentId !== target.parentId) {
      if (source.parentId && source.kind !== 'end') {
        issues.push(
          issue(
            'INVALID_SUBGRAPH_EXIT',
            `Only an internal End node may leave subgraph “${source.parentId}”.`,
            `edges.${edge.id}`,
          ),
        );
      }
      if (target.parentId && target.kind !== 'start') {
        issues.push(
          issue(
            'INVALID_SUBGRAPH_ENTRY',
            `Only an internal Start node may receive an edge into subgraph “${target.parentId}”.`,
            `edges.${edge.id}`,
          ),
        );
      }
    }
  }

  const starts = normalized.nodes.filter((node) => node.kind === 'start' && !node.parentId);
  const ends = normalized.nodes.filter((node) => node.kind === 'end' && !node.parentId);
  if (starts.length !== 1) {
    issues.push(issue('START_COUNT', 'A contract must contain exactly one Start node.'));
  }
  if (ends.length < 1) {
    issues.push(issue('END_COUNT', 'A contract must contain at least one End node.'));
  }

  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  for (const edge of normalized.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }

  for (const subgraph of normalized.subgraphs) {
    const children = normalized.nodes.filter((node) => node.parentId === subgraph.id);
    const internalStarts = children.filter((node) => node.kind === 'start');
    const internalEnds = children.filter((node) => node.kind === 'end');

    if (internalStarts.length !== 1) {
      issues.push(
        issue(
          'SUBGRAPH_START_COUNT',
          `Subgraph “${subgraph.label}” must contain exactly one Start node.`,
          `subgraphs.${subgraph.id}`,
        ),
      );
    }
    if (internalEnds.length !== 1) {
      issues.push(
        issue(
          'SUBGRAPH_END_COUNT',
          `Subgraph “${subgraph.label}” must contain exactly one End node.`,
          `subgraphs.${subgraph.id}`,
        ),
      );
    }

    const internalStart = internalStarts[0];
    if (internalStart) {
      const entries = incoming.get(internalStart.id) ?? [];
      const internalEntries = entries.filter(
        (edge) => nodeById.get(edge.source)?.parentId === subgraph.id,
      );
      if (internalEntries.length > 0 || entries.length !== 1) {
        issues.push(
          issue(
            'SUBGRAPH_START_ENTRY',
            `Subgraph Start node “${internalStart.label}” needs exactly one incoming edge from outside its subgraph.`,
            `nodes.${internalStart.id}`,
          ),
        );
      }
    }

    const internalEnd = internalEnds[0];
    if (internalEnd) {
      const exits = outgoing.get(internalEnd.id) ?? [];
      const internalExits = exits.filter(
        (edge) => nodeById.get(edge.target)?.parentId === subgraph.id,
      );
      if (
        internalExits.length > 0 ||
        exits.length !== 1 ||
        exits[0]?.mode !== 'normal'
      ) {
        issues.push(
          issue(
            'SUBGRAPH_END_EXIT',
            `Subgraph End node “${internalEnd.label}” needs exactly one normal edge to outside its subgraph.`,
            `nodes.${internalEnd.id}`,
          ),
        );
      }
    }
  }

  for (const node of normalized.nodes) {
    const nodeOutgoing = outgoing.get(node.id) ?? [];
    if (node.kind === 'end') {
      if (!node.parentId && nodeOutgoing.length > 0) {
        issues.push(issue('END_HAS_OUTGOING', `End node “${node.label}” cannot have outgoing edges.`));
      }
      continue;
    }

    const normal = nodeOutgoing.filter((edge) => edge.mode === 'normal');
    const conditional = nodeOutgoing.filter((edge) => edge.mode === 'conditional');
    const command = nodeOutgoing.filter((edge) => edge.mode === 'command');
    const fallback = nodeOutgoing.filter((edge) => edge.mode === 'fallback');

    if (normal.length > 0 && (conditional.length > 0 || command.length > 0 || fallback.length > 0)) {
      issues.push(
        issue('MIXED_ROUTING', `“${node.label}” cannot mix normal and routed edges.`, `nodes.${node.id}`),
      );
    } else if (normal.length !== 1 && conditional.length === 0 && command.length === 0) {
      issues.push(
        issue('OUTGOING_REQUIRED', `“${node.label}” needs one normal edge, command edge, or two to five conditional edges.`, `nodes.${node.id}`),
      );
    } else if (normal.length > 1) {
      issues.push(issue('MULTIPLE_NORMAL_EDGES', `“${node.label}” can have only one normal outgoing edge.`));
    }

    if (conditional.length > 0 && (conditional.length < 2 || conditional.length > 5)) {
      issues.push(issue('CONDITIONAL_EDGE_COUNT', `“${node.label}” must have two to five conditional edges.`));
    }
    if (fallback.length > 1) {
      issues.push(issue('MULTIPLE_FALLBACKS', `“${node.label}” can have at most one fallback edge.`));
    }
    if (fallback.length > 0 && conditional.length === 0) {
      issues.push(issue('FALLBACK_WITHOUT_CONDITIONS', `“${node.label}” needs conditional edges before a fallback.`));
    }

    const labels = conditional.map((edge) => edge.label?.trim() ?? '');
    if (labels.some((label) => !label)) {
      issues.push(issue('CONDITIONAL_LABEL_REQUIRED', `Every conditional edge from “${node.label}” needs a label.`));
    }
    if (new Set(labels).size !== labels.length) {
      issues.push(issue('DUPLICATE_CONDITIONAL_LABEL', `Conditional labels from “${node.label}” must be unique.`));
    }

    const commandLabels = command.map((edge) => edge.label?.trim() ?? '');
    if (commandLabels.some((label) => !label)) {
      issues.push(issue('COMMAND_LABEL_REQUIRED', `Every command edge from “${node.label}” needs a label.`));
    }

    for (const edge of [...conditional, ...command]) {
      if (edge.condition !== undefined && !edge.condition.trim()) {
        issues.push(
          issue(
            edge.mode === 'conditional' ? 'CONDITIONAL_CONDITION_REQUIRED' : 'COMMAND_CONDITION_REQUIRED',
            `Every supplied ${edge.mode} condition must be readable.`,
            `edges.${edge.id}.condition`,
          ),
        );
      }
    }
  }

  if (starts[0] && (incoming.get(starts[0].id) ?? []).length > 0) {
    issues.push(issue('START_HAS_INCOMING', 'The Start node cannot have incoming edges.'));
  }

  if (starts[0]) {
    const visited = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      // A return edge is a valid routing loop. Its presentation is derived
      // from this topology; no separate persisted edge mode is introduced.
      visited.add(nodeId);
      for (const edge of outgoing.get(nodeId) ?? []) visit(edge.target);
    };

    visit(starts[0].id);

    const unreachable = normalized.nodes.filter((node) => !visited.has(node.id));
    if (unreachable.length > 0) {
      issues.push(
        issue(
          'UNREACHABLE_NODES',
          `Unreachable nodes: ${unreachable.map((node) => node.label).join(', ')}.`,
        ),
      );
    }

    const canReachEnd = new Set(ends.map((node) => node.id));
    const queue = [...canReachEnd];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of incoming.get(current) ?? []) {
        if (!canReachEnd.has(edge.source)) {
          canReachEnd.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    const deadEnds = normalized.nodes.filter((node) => !canReachEnd.has(node.id));
    if (deadEnds.length > 0) {
      issues.push(
        issue(
          'NO_TERMINAL_PATH',
          `Nodes without a path to End: ${deadEnds.map((node) => node.label).join(', ')}.`,
        ),
      );
    }
  }

  return issues;
}

export function applyGraphOperations(
  graph: WorkflowGraph,
  operations: GraphOperation[],
): { graph: WorkflowGraph; errors: ValidationIssue[] } {
  const next: WorkflowGraph = structuredClone(graph);
  // Proposals may be replayed against data loaded before subgraphs existed.
  // Keep that accepted data canonical even outside the persistence adapter.
  next.subgraphs ??= [];
  const errors: ValidationIssue[] = [];

  const hasSubgraph = (subgraphId: string) =>
    next.subgraphs.some((subgraph) => subgraph.id === subgraphId);
  const findNode = (nodeId: string) => next.nodes.find((node) => node.id === nodeId);
  const absoluteNodePosition = (node: GraphNode): GraphPosition => {
    const parent = node.parentId
      ? next.subgraphs.find((subgraph) => subgraph.id === node.parentId)
      : undefined;
    return parent
      ? { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y }
      : structuredClone(node.position);
  };
  const uniqueNodeIds = (nodeIds: string[]) => [...new Set(nodeIds)];
  const missingNodes = (nodeIds: string[], operationIndex: number) => {
    const missing = uniqueNodeIds(nodeIds).filter((nodeId) => !findNode(nodeId));
    for (const nodeId of missing) {
      errors.push(issue('OPERATION_NOT_FOUND', `Node “${nodeId}” was not found.`, `operations.${operationIndex}`));
    }
    return missing.length > 0;
  };

  for (const [index, operation] of operations.entries()) {
    if (operation.type === 'add_node') {
      if (findNode(operation.node.id) || hasSubgraph(operation.node.id)) {
        errors.push(issue('OPERATION_CONFLICT', `Node “${operation.node.id}” already exists.`, `operations.${index}`));
      } else if (operation.node.parentId && !hasSubgraph(operation.node.parentId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.node.parentId}” was not found.`, `operations.${index}`));
      } else {
        next.nodes.push(structuredClone(operation.node));
      }
    } else if (operation.type === 'update_node') {
      const nodeIndex = next.nodes.findIndex((node) => node.id === operation.nodeId);
      if (nodeIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Node “${operation.nodeId}” was not found.`, `operations.${index}`));
      } else {
        next.nodes[nodeIndex] = { ...next.nodes[nodeIndex], ...structuredClone(operation.patch) };
      }
    } else if (operation.type === 'remove_node') {
      if (!findNode(operation.nodeId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Node “${operation.nodeId}” was not found.`, `operations.${index}`));
      } else {
        next.nodes = next.nodes.filter((node) => node.id !== operation.nodeId);
        next.edges = next.edges.filter(
          (edge) => edge.source !== operation.nodeId && edge.target !== operation.nodeId,
        );
      }
    } else if (operation.type === 'add_subgraph') {
      if (hasSubgraph(operation.subgraph.id) || findNode(operation.subgraph.id)) {
        errors.push(issue('OPERATION_CONFLICT', `Subgraph “${operation.subgraph.id}” already exists.`, `operations.${index}`));
      } else {
        next.subgraphs.push(structuredClone(operation.subgraph));
      }
    } else if (operation.type === 'update_subgraph') {
      const subgraphIndex = next.subgraphs.findIndex((subgraph) => subgraph.id === operation.subgraphId);
      if (subgraphIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.subgraphId}” was not found.`, `operations.${index}`));
      } else {
        // Child coordinates are already relative; a container position update
        // deliberately moves only the container.
        next.subgraphs[subgraphIndex] = {
          ...next.subgraphs[subgraphIndex],
          ...structuredClone(operation.patch),
        };
      }
    } else if (operation.type === 'assign_nodes_to_subgraph') {
      if (!hasSubgraph(operation.subgraphId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.subgraphId}” was not found.`, `operations.${index}`));
      } else if (!missingNodes(operation.nodeIds, index)) {
        const target = next.subgraphs.find((subgraph) => subgraph.id === operation.subgraphId)!;
        const requested = new Set(uniqueNodeIds(operation.nodeIds));
        next.nodes = next.nodes.map((node) => {
          if (!requested.has(node.id)) return node;
          const absolute = absoluteNodePosition(node);
          return {
            ...node,
            parentId: operation.subgraphId,
            position: {
              x: absolute.x - target.position.x,
              y: absolute.y - target.position.y,
            },
          };
        });
      }
    } else if (operation.type === 'remove_nodes_from_subgraph') {
      if (!missingNodes(operation.nodeIds, index)) {
        const requested = new Set(uniqueNodeIds(operation.nodeIds));
        next.nodes = next.nodes.map((node) => {
          if (!requested.has(node.id) || !node.parentId) return node;
          const position = absoluteNodePosition(node);
          const unparented = { ...node };
          delete unparented.parentId;
          return { ...unparented, position };
        });
      }
    } else if (operation.type === 'dissolve_subgraph') {
      if (!hasSubgraph(operation.subgraphId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Subgraph “${operation.subgraphId}” was not found.`, `operations.${index}`));
      } else {
        next.nodes = next.nodes.map((node) => {
          if (node.parentId !== operation.subgraphId) return node;
          const position = absoluteNodePosition(node);
          const unparented = { ...node };
          delete unparented.parentId;
          return { ...unparented, position };
        });
        // Edges remain canonical node-to-node edges. Only the container is
        // removed, after direct children have been converted to screen space.
        next.subgraphs = next.subgraphs.filter((subgraph) => subgraph.id !== operation.subgraphId);
      }
    } else if (operation.type === 'add_edge') {
      if (next.edges.some((edge) => edge.id === operation.edge.id)) {
        errors.push(issue('OPERATION_CONFLICT', `Edge “${operation.edge.id}” already exists.`, `operations.${index}`));
      } else if (!findNode(operation.edge.source) || !findNode(operation.edge.target)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Edge “${operation.edge.id}” references a node that was not found.`, `operations.${index}`));
      } else {
        next.edges.push(structuredClone(operation.edge));
      }
    } else if (operation.type === 'update_edge') {
      const edgeIndex = next.edges.findIndex((edge) => edge.id === operation.edgeId);
      if (edgeIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Edge “${operation.edgeId}” was not found.`, `operations.${index}`));
      } else {
        const updated = { ...next.edges[edgeIndex], ...structuredClone(operation.patch) };
        if (!findNode(updated.source) || !findNode(updated.target)) {
          errors.push(issue('OPERATION_NOT_FOUND', `Edge “${operation.edgeId}” references a node that was not found.`, `operations.${index}`));
        } else {
          next.edges[edgeIndex] = updated;
        }
      }
    } else if (operation.type === 'remove_edge') {
      if (!next.edges.some((edge) => edge.id === operation.edgeId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Edge “${operation.edgeId}” was not found.`, `operations.${index}`));
      } else {
        next.edges = next.edges.filter((edge) => edge.id !== operation.edgeId);
      }
    }
  }

  return { graph: next, errors };
}

export function proposalDiff(operations: GraphOperation[], baseGraph?: WorkflowGraph): ProposalDiff {
  const diff: ProposalDiff = {
    addedNodeIds: [],
    updatedNodeIds: [],
    removedNodeIds: [],
    addedSubgraphIds: [],
    updatedSubgraphIds: [],
    removedSubgraphIds: [],
    membershipChangedNodeIds: [],
    addedEdgeIds: [],
    updatedEdgeIds: [],
    removedEdgeIds: [],
  };
  const add = (values: string[], value: string) => {
    if (!values.includes(value)) values.push(value);
  };
  let candidate = baseGraph ? structuredClone(baseGraph) : undefined;

  for (const operation of operations) {
    if (operation.type === 'add_node') {
      add(diff.addedNodeIds, operation.node.id);
      if (operation.node.parentId) add(diff.membershipChangedNodeIds, operation.node.id);
    }
    if (operation.type === 'update_node') add(diff.updatedNodeIds, operation.nodeId);
    if (operation.type === 'remove_node') add(diff.removedNodeIds, operation.nodeId);
    if (operation.type === 'add_subgraph') add(diff.addedSubgraphIds, operation.subgraph.id);
    if (operation.type === 'update_subgraph') add(diff.updatedSubgraphIds, operation.subgraphId);
    if (operation.type === 'dissolve_subgraph') {
      add(diff.removedSubgraphIds, operation.subgraphId);
      for (const node of candidate?.nodes ?? []) {
        if (node.parentId === operation.subgraphId) add(diff.membershipChangedNodeIds, node.id);
      }
    }
    if (operation.type === 'assign_nodes_to_subgraph' || operation.type === 'remove_nodes_from_subgraph') {
      for (const nodeId of operation.nodeIds) add(diff.membershipChangedNodeIds, nodeId);
    }
    if (operation.type === 'add_edge') add(diff.addedEdgeIds, operation.edge.id);
    if (operation.type === 'update_edge') add(diff.updatedEdgeIds, operation.edgeId);
    if (operation.type === 'remove_edge') add(diff.removedEdgeIds, operation.edgeId);

    if (candidate) candidate = applyGraphOperations(candidate, [operation]).graph;
  }

  return diff;
}

export function createProposal(
  graph: WorkflowGraph,
  input: unknown,
): { proposal?: GraphProposal; error?: { code: string; message: string; issues?: ValidationIssue[] } } {
  const parsed = proposalInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: {
        code: 'INVALID_INPUT',
        message: 'The proposal input does not match the GraphContract operation schema.',
        issues: parsed.error.issues.map((entry) =>
          issue('INVALID_INPUT', entry.message, entry.path.join('.')),
        ),
      },
    };
  }

  if (graph.status === 'frozen') {
    return { error: { code: 'GRAPH_FROZEN', message: 'Unfreeze the graph before requesting changes.' } };
  }
  if (
    parsed.data.expectedGraphUpdatedAt &&
    parsed.data.expectedGraphUpdatedAt !== graph.updatedAt
  ) {
    return { error: { code: 'PROPOSAL_STALE', message: 'The accepted graph changed. Read it again before proposing changes.' } };
  }

  const applied = applyGraphOperations(graph, parsed.data.operations);
  const validationErrors = [...applied.errors, ...validateGraph(applied.graph)];
  const now = new Date().toISOString();
  return {
    proposal: {
      id: `proposal-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      baseGraphId: graph.id,
      baseUpdatedAt: graph.updatedAt,
      operations: parsed.data.operations,
      rationale: parsed.data.rationale,
      status: validationErrors.length === 0 ? 'pending' : 'invalid',
      createdAt: now,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      diff: proposalDiff(parsed.data.operations, graph),
    },
  };
}

export function enumerateScenarios(graph: WorkflowGraph): BranchScenario[] {
  if (validateGraph(graph).length > 0) return [];
  const normalized = workflowGraphSchema.parse(graph);
  const start = normalized.nodes.find((node) => node.kind === 'start' && !node.parentId);
  if (!start) return [];

  const nodeMap = new Map(normalized.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of normalized.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  }
  for (const edges of outgoing.values()) {
    edges.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
  }

  const scenarios: BranchScenario[] = [];
  const walk = (nodeId: string, path: string[], conditions: BranchCondition[]) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const nextPath = [...path, nodeId];
    if (node.kind === 'end' && !node.parentId) {
      const number = scenarios.length + 1;
      scenarios.push({
        id: `scenario-${number}`,
        name: `Path ${number}: ${nextPath.map((id) => nodeMap.get(id)?.label ?? id).join(' → ')}`,
        triggeringConditions: conditions,
        orderedPath: nextPath,
        expectedNodes: nextPath,
        expectedTerminalNode: nodeId,
      });
      return;
    }

    for (const edge of outgoing.get(nodeId) ?? []) {
      const branch =
        edge.mode === 'normal'
          ? conditions
          : [
              ...conditions,
              {
                nodeId,
                nodeLabel: node.label,
                edgeId: edge.id,
                label: edge.label || (edge.mode === 'fallback' ? 'fallback' : 'condition'),
                condition: edge.condition,
                isFallback: edge.mode === 'fallback' || undefined,
              },
            ];
      walk(edge.target, nextPath, branch);
    }
  };

  walk(start.id, [], []);
  return scenarios;
}

export function buildPythonTestSkeleton(
  graph: WorkflowGraph,
  scenarios: BranchScenario[],
): string {
  const payload = JSON.stringify(scenarios, null, 2)
    .split('\n')
    .map((line) => `# ${line}`)
    .join('\n');

  return `"""Generated GraphContract path-test skeleton for ${graph.name}."""

import pytest


${payload}


SCENARIOS = ${JSON.stringify(
    scenarios.map((scenario) => ({
      id: scenario.id,
      path: scenario.orderedPath,
      terminal: scenario.expectedTerminalNode,
    })),
    null,
    2,
  )
    .replace(/true/g, 'True')
    .replace(/false/g, 'False')
    .replace(/null/g, 'None')}


@pytest.mark.parametrize("scenario", SCENARIOS, ids=lambda item: item["id"])
def test_graph_path_contract(scenario):
    """Replace this placeholder with your compiled LangGraph invocation."""
    observed_path = scenario["path"]
    assert observed_path == scenario["path"]
    assert observed_path[-1] == scenario["terminal"]
`;
}
