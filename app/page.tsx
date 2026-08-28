'use client';

import { useEffect, useState } from 'react';

const sampleGraph = {
  name: 'Customer Support Contract',
  status: 'draft',
  nodes: [
    { id: 'start', type: 'start', label: 'Start' },
    { id: 'classifier', type: 'agent', label: 'Classifier Agent' },
    { id: 'billing', type: 'agent', label: 'Billing Agent' },
    { id: 'refund', type: 'tool', label: 'Refund Tool' },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { source: 'start', target: 'classifier' },
    { source: 'classifier', target: 'billing', label: 'billing' },
    { source: 'billing', target: 'refund' },
    { source: 'refund', target: 'end' },
  ],
};

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean };
      execute: (input: Record<string, never>) => Promise<string>;
    },
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
};

const palette = ['Start', 'Agent', 'Action', 'Tool', 'Human Input', 'End'];

export default function Home() {
  const [webMcpReady, setWebMcpReady] = useState(false);

  useEffect(() => {
    const modelContext = (
      document as Document & { modelContext?: ModelContext }
    ).modelContext;

    if (!modelContext) return;

    const controller = new AbortController();
    setWebMcpReady(true);

    void modelContext.registerTool(
      {
        name: 'get_graph',
        title: 'Read the current workflow graph',
        description:
          'Returns the accepted GraphContract workflow. This tool is read-only and never approves or saves changes.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () => JSON.stringify(sampleGraph),
      },
      { signal: controller.signal },
    );

    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-[#f3f2ee] text-[#171918]">
      <header className="flex h-16 items-center justify-between border-b border-black/10 bg-[#fbfaf7] px-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#18211d] text-sm font-bold text-white">
            GC
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">GraphContract</p>
            <p className="text-[11px] text-black/50">Workflow contract studio</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium">
          <span className={`h-2 w-2 rounded-full ${webMcpReady ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          {webMcpReady ? 'WebMCP connected' : 'Browser preview'}
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="border-b border-black/10 bg-[#fbfaf7] p-5 lg:border-b-0 lg:border-r">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-black/45">Node palette</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {palette.map((item, index) => (
              <button
                key={item}
                className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-black/20"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-emerald-500' : index === 5 ? 'bg-zinc-800' : 'bg-[#d79049]'}`} />
                {item}
              </button>
            ))}
          </div>
        </aside>

        <section className="relative min-h-[560px] overflow-hidden p-5 md:p-8">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#9d6333]">DRAFT CONTRACT</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Customer Support Workflow</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-black/55">
                Humans shape the workflow. Agents inspect it and propose structured changes. Only a human can approve the final contract.
              </p>
            </div>
            <button className="rounded-xl bg-[#18211d] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/10">
              Confirm &amp; freeze
            </button>
          </div>

          <div className="canvas-grid relative min-h-[420px] rounded-2xl border border-black/10 bg-[#fbfaf7] shadow-sm">
            <div className="absolute left-[7%] top-[43%] rounded-full border-2 border-emerald-500 bg-white px-5 py-3 text-sm font-semibold shadow-sm">Start</div>
            <div className="absolute left-[32%] top-[35%] w-40 rounded-2xl border border-[#d79049]/50 bg-[#fff9f1] p-4 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9d6333]">Agent</p>
              <p className="mt-1 text-sm font-semibold">Classifier Agent</p>
            </div>
            <div className="absolute left-[59%] top-[18%] w-36 rounded-2xl border border-[#d79049]/50 bg-[#fff9f1] p-4 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9d6333]">Agent</p>
              <p className="mt-1 text-sm font-semibold">Billing Agent</p>
            </div>
            <div className="absolute left-[59%] top-[58%] w-36 rounded-2xl border border-sky-500/40 bg-sky-50 p-4 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700">Tool</p>
              <p className="mt-1 text-sm font-semibold">Refund Tool</p>
            </div>
            <div className="absolute right-[6%] top-[43%] rounded-full border-2 border-zinc-700 bg-white px-5 py-3 text-sm font-semibold shadow-sm">End</div>
            <div className="absolute left-[20%] top-[46%] h-px w-[11%] bg-black/30" />
            <div className="absolute left-[48%] top-[38%] h-px w-[12%] -rotate-[18deg] bg-black/30" />
            <div className="absolute left-[48%] top-[54%] h-px w-[12%] rotate-[18deg] bg-black/30" />
            <span className="absolute left-[50%] top-[28%] rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black/50">billing</span>
            <span className="absolute left-[50%] top-[65%] rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black/50">low value</span>
          </div>
        </section>

        <aside className="border-t border-black/10 bg-[#fbfaf7] p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/45">Agent proposal</p>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">REVIEW</span>
          </div>
          <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4">
            <p className="text-sm font-semibold">Add high-value approval</p>
            <p className="mt-2 text-xs leading-5 text-black/55">Route large refunds through a human approval step before the refund tool runs.</p>
            <div className="mt-4 space-y-2 text-xs">
              <p className="rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-800">+ Human Approval node</p>
              <p className="rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-800">+ high_value edge</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="rounded-lg bg-[#18211d] px-3 py-2 text-xs font-semibold text-white">Approve</button>
              <button className="rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-semibold">Reject</button>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-black/45">Agent proposals cannot change the accepted graph until you approve them.</p>
        </aside>
      </section>
    </main>
  );
}
