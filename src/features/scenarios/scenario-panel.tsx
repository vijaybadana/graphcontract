import { downloadGraphContract, downloadGraphScenarios, downloadPythonTests } from '@/src/adapters/exports/downloads';
import { BranchScenario, WorkflowGraph } from '@/src/domain';

export function ScenarioPanel({ graph, scenarios }: { graph: WorkflowGraph; scenarios: BranchScenario[] }) {
  if (graph.status !== 'frozen') {
    return (
      <div className="rounded-2xl border border-dashed border-black/15 bg-white p-5 text-center">
        <p className="text-sm font-semibold">Freeze a valid contract</p>
        <p className="mt-2 text-xs leading-5 text-black/50">Every reachable Start-to-End path will be generated here.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="rounded-2xl bg-[#18211d] p-4 text-white">
        <p className="eyebrow !text-white/50">Frozen contract</p>
        <p className="mt-2 text-2xl font-semibold">{scenarios.length} paths</p>
        <p className="mt-1 text-[11px] leading-5 text-white/60">Exhaustive reachable execution scenarios.</p>
      </div>
      <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto pr-1">
        {scenarios.map((scenario) => (
          <article key={scenario.id} className="rounded-xl border border-black/10 bg-white p-3">
            <p className="text-xs font-semibold leading-5">{scenario.name}</p>
            {scenario.triggeringConditions.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{scenario.triggeringConditions.map((condition) => <span key={condition.edgeId} className="rounded bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-800">{condition.label}</span>)}</div>}
          </article>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <button onClick={() => downloadGraphContract(graph)} className="download-button">Download graph-contract.json</button>
        <button onClick={() => downloadGraphScenarios(graph, scenarios)} className="download-button">Download graph-test-scenarios.json</button>
        <button onClick={() => downloadPythonTests(graph, scenarios)} className="download-button">Download test_graph_paths.py</button>
      </div>
    </section>
  );
}
