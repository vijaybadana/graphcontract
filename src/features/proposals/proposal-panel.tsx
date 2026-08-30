import { deriveProposalComparison } from '@/src/application/proposal-comparison';
import { ProposalOverview } from '@/src/features/proposals/proposal-overview';
import { useGraphStore } from '@/src/state/workspace-store';

export function ProposalPanel() {
  const graph = useGraphStore((state) => state.graph);
  const proposal = useGraphStore((state) => state.proposal);
  const approveProposal = useGraphStore((state) => state.approveProposal);
  const rejectProposal = useGraphStore((state) => state.rejectProposal);
  const comparison = proposal ? deriveProposalComparison(graph, proposal) : null;
  const status = comparison?.effectiveStatus;
  const issues = comparison
    ? comparison.validationErrors.length > 0
      ? comparison.validationErrors
      : comparison.declaredValidationErrors
    : [];

  return (
    <section className="rounded-2xl border border-black/8 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">Agent proposal</p>
        {status && <span className={`status-badge ${status === 'pending' ? 'bg-amber-100 text-amber-800' : status === 'invalid' || status === 'stale' ? 'bg-rose-100 text-rose-800' : 'bg-zinc-100 text-zinc-700'}`}>{status}</span>}
      </div>
      {!proposal || !comparison ? (
        <div className="mt-3 rounded-xl border border-dashed border-black/15 bg-[#f7f6f2] p-3">
          <p className="text-xs font-semibold">No proposal waiting</p>
          <p className="mt-2 text-[11px] leading-5 text-black/50">An external agent can read the graph and submit structured operations through WebMCP.</p>
        </div>
      ) : (
        <div className="mt-3">
          <p id="proposal-agent-rationale" className="text-sm font-semibold leading-5">{proposal.rationale}</p>
          <p className="mt-2 text-[11px] text-black/45">{proposal.operations.length} operations · accepted graph locked and unchanged</p>
          {comparison.stale && (
            <p role="status" className="mt-3 rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] leading-4 text-rose-800">
              The accepted graph changed after this proposal was created. Review or reject it; approval is unavailable.
            </p>
          )}
          {!comparison.stale && comparison.invalid && (
            <p role="status" className="mt-3 rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] leading-4 text-rose-800">
              The proposed candidate is invalid and cannot be approved.
            </p>
          )}
          <ProposalOverview comparison={comparison} proposal={proposal} />
          {issues.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-[11px] leading-4 text-rose-700">
              {issues.slice(0, 4).map((entry, index) => <li key={`${entry.code}-${entry.path ?? index}`} className="rounded-lg bg-rose-50 px-2.5 py-2">{entry.message}</li>)}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2" aria-describedby="proposal-agent-rationale">
            <button disabled={!comparison.approvable} onClick={() => approveProposal()} className="primary-button">Approve</button>
            <button onClick={rejectProposal} className="secondary-button">Reject</button>
          </div>
          <p className="mt-3 text-[10px] leading-4 text-black/45">Approval, rejection, and freeze remain human-only UI actions and are never exposed to WebMCP.</p>
        </div>
      )}
    </section>
  );
}
