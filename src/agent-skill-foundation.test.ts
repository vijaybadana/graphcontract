import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { registerWebMcpTools } from '@/src/adapters/webmcp/register-tools';
import { sampleGraph } from '@/src/domain';

const repositoryRoot = resolve(import.meta.dirname, '..');
const skillDirectory = resolve(
  repositoryRoot,
  'public/.well-known/agent-skills/graphcontract',
);
const skillPath = resolve(skillDirectory, 'SKILL.md');
const indexPath = resolve(
  repositoryRoot,
  'public/.well-known/agent-skills/index.json',
);

function frontmatterValue(source: string, key: string) {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!frontmatter) return undefined;
  return frontmatter
    .split('\n')
    .find((line) => line.startsWith(`${key}:`))
    ?.slice(key.length + 1)
    .trim()
    .replace(/^"|"$/g, '');
}

function yamlString(source: string, key: string) {
  return source.match(new RegExp(`^\\s*${key}: "([^"]+)"$`, 'm'))?.[1];
}

function findGraphContractSkills(directory: string): string[] {
  const ignored = new Set(['.git', '.next', '.netlify', 'dist', 'node_modules', 'output', 'test-results']);
  const matches: string[] = [];

  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) {
      matches.push(...findGraphContractSkills(path));
      continue;
    }
    if (entry === 'SKILL.md' && frontmatterValue(readFileSync(path, 'utf8'), 'name') === 'graphcontract') {
      matches.push(path);
    }
  }

  return matches;
}

describe('GraphContract agent skill foundation', () => {
  it('publishes one valid, discoverable skill package with normal implicit invocation', () => {
    const skill = readFileSync(skillPath, 'utf8');
    const metadata = readFileSync(resolve(skillDirectory, 'agents/openai.yaml'), 'utf8');
    const description = frontmatterValue(skill, 'description');
    const shortDescription = yamlString(metadata, 'short_description');
    const defaultPrompt = yamlString(metadata, 'default_prompt');

    expect(frontmatterValue(skill, 'name')).toBe('graphcontract');
    expect(description).toContain('open GraphContract canvas');
    expect(description).toContain('human review and freeze authority');
    expect(yamlString(metadata, 'display_name')).toBe('GraphContract');
    expect(shortDescription?.length).toBeGreaterThanOrEqual(25);
    expect(shortDescription?.length).toBeLessThanOrEqual(64);
    expect(defaultPrompt).toMatch(/^Use \$graphcontract\b.*\.$/);
    expect(metadata).toMatch(/^\s*allow_implicit_invocation: true$/m);
    expect(existsSync(resolve(skillDirectory, 'references/lifecycle.md'))).toBe(true);
    expect(skill).toContain('[references/lifecycle.md](references/lifecycle.md)');
    expect(findGraphContractSkills(repositoryRoot)).toEqual([skillPath]);
  });

  it('keeps the public discovery index pinned to the canonical source and digest', () => {
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
      skills: Array<{ name: string; version: string; url: string; integrity: string }>;
    };
    const digest = `sha256-${createHash('sha256')
      .update(readFileSync(skillPath))
      .digest('base64')}`;

    expect(index.skills).toEqual([
      {
        name: 'graphcontract',
        version: '1.0.0',
        url: 'https://www.graphcontract.dev/.well-known/agent-skills/graphcontract/SKILL.md',
        integrity: digest,
      },
    ]);
  });

  it('scopes Netlify content types and public CORS to the machine-readable skill artifacts', () => {
    const configuration = readFileSync(resolve(repositoryRoot, 'netlify.toml'), 'utf8');
    const headerBlocks = configuration.split('[[headers]]').slice(1);
    const blockFor = (path: string) => headerBlocks.find((block) => block.includes(`for = "${path}"`));
    const skillHeaders = blockFor('/.well-known/agent-skills/graphcontract/SKILL.md');
    const indexHeaders = blockFor('/.well-known/agent-skills/index.json');
    const appHeaders = blockFor('/*');

    expect(skillHeaders).toContain('Content-Type = "text/markdown; charset=utf-8"');
    expect(skillHeaders).toContain('Access-Control-Allow-Origin = "*"');
    expect(indexHeaders).toContain('Content-Type = "application/json; charset=utf-8"');
    expect(indexHeaders).toContain('Access-Control-Allow-Origin = "*"');
    expect(appHeaders).not.toContain('Access-Control-Allow-Origin');
    expect(appHeaders).not.toContain('\n    Content-Type =');
  });

  it('leaves GraphContract registered as exactly three review-bound WebMCP tools', async () => {
    const registered: string[] = [];
    const modelContext = {
      registerTool: async (tool: { name: string }) => {
        registered.push(tool.name);
      },
    };

    await registerWebMcpTools(
      modelContext as Parameters<typeof registerWebMcpTools>[0],
      {
        getSnapshot: () => ({ graph: structuredClone(sampleGraph), proposal: null, scenarios: [] }),
        submitProposal: () => ({
          ok: false,
          error: { code: 'NOT_USED', message: 'The focused test does not execute proposals.' },
        }),
      },
      new AbortController().signal,
    );

    expect(registered.toSorted()).toEqual([
      'get_branch_scenarios',
      'get_graph',
      'propose_graph_changes',
    ]);
  });
});
