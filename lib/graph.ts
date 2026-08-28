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
export type EdgeMode = 'normal' | 'conditional' | 'fallback';

export type HitlConfig = {
  enabled: boolean;
  timing?: 'before' | 'after' | 'conditional';
  inputType?: 'approval' | 'text' | 'selection';
  condition?: string;
};

export type GraphNode = {
  id: string;
  kind: NodeKind;
  label: string;
  description?: string;
  position: { x: number; y: number };
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
      patch: Partial<Omit<GraphNode, 'id'>>;
    }
  | { type: 'remove_node'; nodeId: string }
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
  config: z.record(z.string(), z.unknown()).optional(),
  hitl: hitlSchema.optional(),
});

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  mode: z.enum(['normal', 'conditional', 'fallback']),
  label: z.string().optional(),
  condition: z.string().optional(),
});

export const workflowGraphSchema = z.object({
  schemaVersion: z.literal('1'),
  id: z.string().min(1),
  name: z.string().min(1),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  status: z.enum(['draft', 'frozen']),
  updatedAt: z.string().min(1),
});

export const graphOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_node'), node: graphNodeSchema }),
  z.object({
    type: z.literal('update_node'),
    nodeId: z.string().min(1),
    patch: graphNodeSchema.omit({ id: true }).partial(),
  }),
  z.object({ type: z.literal('remove_node'), nodeId: z.string().min(1) }),
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

  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push(issue('DUPLICATE_NODE_ID', `Node ID “${node.id}” is duplicated.`, `nodes.${node.id}`));
    }
    nodeIds.add(node.id);
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

  for (const edge of graph.edges) {
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
    }
  }

  const starts = graph.nodes.filter((node) => node.kind === 'start');
  const ends = graph.nodes.filter((node) => node.kind === 'end');
  if (starts.length !== 1) {
    issues.push(issue('START_COUNT', 'A contract must contain exactly one Start node.'));
  }
  if (ends.length < 1) {
    issues.push(issue('END_COUNT', 'A contract must contain at least one End node.'));
  }

  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }

  for (const node of graph.nodes) {
    const nodeOutgoing = outgoing.get(node.id) ?? [];
    if (node.kind === 'end') {
      if (nodeOutgoing.length > 0) {
        issues.push(issue('END_HAS_OUTGOING', `End node “${node.label}” cannot have outgoing edges.`));
      }
      continue;
    }

    const normal = nodeOutgoing.filter((edge) => edge.mode === 'normal');
    const conditional = nodeOutgoing.filter((edge) => edge.mode === 'conditional');
    const fallback = nodeOutgoing.filter((edge) => edge.mode === 'fallback');

    if (normal.length > 0 && (conditional.length > 0 || fallback.length > 0)) {
      issues.push(
        issue('MIXED_ROUTING', `“${node.label}” cannot mix normal and conditional routing.`, `nodes.${node.id}`),
      );
    } else if (normal.length !== 1 && conditional.length === 0) {
      issues.push(
        issue('OUTGOING_REQUIRED', `“${node.label}” needs one normal edge or two to five conditional edges.`, `nodes.${node.id}`),
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
  }

  if (starts[0] && (incoming.get(starts[0].id) ?? []).length > 0) {
    issues.push(issue('START_HAS_INCOMING', 'The Start node cannot have incoming edges.'));
  }

  if (starts[0]) {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    let cycleFound = false;

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        cycleFound = true;
        return;
      }
      if (visited.has(nodeId)) return;
      visiting.add(nodeId);
      for (const edge of outgoing.get(nodeId) ?? []) visit(edge.target);
      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    visit(starts[0].id);
    if (cycleFound) issues.push(issue('CYCLE_DETECTED', 'MVP contracts must be acyclic.'));

    const unreachable = graph.nodes.filter((node) => !visited.has(node.id));
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
    const deadEnds = graph.nodes.filter((node) => !canReachEnd.has(node.id));
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
  const errors: ValidationIssue[] = [];

  for (const [index, operation] of operations.entries()) {
    if (operation.type === 'add_node') {
      if (next.nodes.some((node) => node.id === operation.node.id)) {
        errors.push(issue('OPERATION_CONFLICT', `Node “${operation.node.id}” already exists.`, `operations.${index}`));
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
      if (!next.nodes.some((node) => node.id === operation.nodeId)) {
        errors.push(issue('OPERATION_NOT_FOUND', `Node “${operation.nodeId}” was not found.`, `operations.${index}`));
      } else {
        next.nodes = next.nodes.filter((node) => node.id !== operation.nodeId);
        next.edges = next.edges.filter(
          (edge) => edge.source !== operation.nodeId && edge.target !== operation.nodeId,
        );
      }
    } else if (operation.type === 'add_edge') {
      if (next.edges.some((edge) => edge.id === operation.edge.id)) {
        errors.push(issue('OPERATION_CONFLICT', `Edge “${operation.edge.id}” already exists.`, `operations.${index}`));
      } else {
        next.edges.push(structuredClone(operation.edge));
      }
    } else if (operation.type === 'update_edge') {
      const edgeIndex = next.edges.findIndex((edge) => edge.id === operation.edgeId);
      if (edgeIndex < 0) {
        errors.push(issue('OPERATION_NOT_FOUND', `Edge “${operation.edgeId}” was not found.`, `operations.${index}`));
      } else {
        next.edges[edgeIndex] = { ...next.edges[edgeIndex], ...structuredClone(operation.patch) };
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

export function proposalDiff(operations: GraphOperation[]): ProposalDiff {
  return operations.reduce<ProposalDiff>(
    (diff, operation) => {
      if (operation.type === 'add_node') diff.addedNodeIds.push(operation.node.id);
      if (operation.type === 'update_node') diff.updatedNodeIds.push(operation.nodeId);
      if (operation.type === 'remove_node') diff.removedNodeIds.push(operation.nodeId);
      if (operation.type === 'add_edge') diff.addedEdgeIds.push(operation.edge.id);
      if (operation.type === 'update_edge') diff.updatedEdgeIds.push(operation.edgeId);
      if (operation.type === 'remove_edge') diff.removedEdgeIds.push(operation.edgeId);
      return diff;
    },
    {
      addedNodeIds: [],
      updatedNodeIds: [],
      removedNodeIds: [],
      addedEdgeIds: [],
      updatedEdgeIds: [],
      removedEdgeIds: [],
    },
  );
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
      diff: proposalDiff(parsed.data.operations),
    },
  };
}

export function enumerateScenarios(graph: WorkflowGraph): BranchScenario[] {
  if (validateGraph(graph).length > 0) return [];
  const start = graph.nodes.find((node) => node.kind === 'start');
  if (!start) return [];

  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
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
    if (node.kind === 'end') {
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
