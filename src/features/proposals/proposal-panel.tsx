import { useGraphStore } from '@/src/state/workspace-store';

export function ProposalPanel() {
  const proposal = useGraphStore((state) => state.proposal);
  const approveProposal = useGraphStore((state) => state.approveProposal);
  const rejectProposal = useGraphStore((state) => state.rejectProposal);

  return (
    <section className="rounded-2xl border border-black/8 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">Agent proposal</p>
        {proposal && <span className={`status-badge ${proposal.status === 'pending' ? 'bg-amber-100 text-amber-800' : proposal.status === 'invalid' ? 'bg-rose-100 text-rose-800' : 'bg-zinc-100 text-zinc-700'}`}>{proposal.status}</span>}
      </div>
      {!proposal ? (
        <div className="mt-3 rounded-xl border border-dashed border-black/15 bg-[#f7f6f2] p-3">
          <p className="text-xs font-semibold">No proposal waiting</p>
          <p className="mt-2 text-[11px] leading-5 text-black/50">An external agent can read the graph and submit structured operations through WebMCP.</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-semibold leading-5">{proposal.rationale}</p>
          <p className="mt-2 text-[11px] text-black/45">{proposal.operations.length} operations · accepted graph locked and unchanged</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
            {proposal.diff.addedNodeIds.map((id) => <DiffPill key={`an-${id}`} label={`+ node ${id}`} tone="green" />)}
            {proposal.diff.updatedNodeIds.map((id) => <DiffPill key={`un-${id}`} label={`~ node ${id}`} tone="amber" />)}
            {proposal.diff.removedNodeIds.map((id) => <DiffPill key={`rn-${id}`} label={`− node ${id}`} tone="red" />)}
            {(proposal.diff.addedSubgraphIds ?? []).map((id) => <DiffPill key={`as-${id}`} label={`+ subgraph ${id}`} tone="green" />)}
            {(proposal.diff.updatedSubgraphIds ?? []).map((id) => <DiffPill key={`us-${id}`} label={`~ subgraph ${id}`} tone="amber" />)}
            {(proposal.diff.removedSubgraphIds ?? []).map((id) => <DiffPill key={`rs-${id}`} label={`− subgraph ${id}`} tone="red" />)}
            {(proposal.diff.membershipChangedNodeIds ?? []).map((id) => <DiffPill key={`mn-${id}`} label={`~ membership ${id}`} tone="amber" />)}
            {proposal.diff.addedEdgeIds.map((id) => <DiffPill key={`ae-${id}`} label={`+ edge ${id}`} tone="green" />)}
            {proposal.diff.updatedEdgeIds.map((id) => <DiffPill key={`ue-${id}`} label={`~ edge ${id}`} tone="amber" />)}
            {proposal.diff.removedEdgeIds.map((id) => <DiffPill key={`re-${id}`} label={`− edge ${id}`} tone="red" />)}
          </div>
          {proposal.validationErrors && (
            <ul className="mt-3 space-y-1.5 text-[11px] leading-4 text-rose-700">
              {proposal.validationErrors.slice(0, 4).map((entry, index) => <li key={`${entry.code}-${index}`} className="rounded-lg bg-rose-50 px-2.5 py-2">{entry.message}</li>)}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button disabled={proposal.status !== 'pending'} onClick={() => approveProposal()} className="primary-button">Approve</button>
            <button onClick={rejectProposal} className="secondary-button">Reject</button>
          </div>
          <p className="mt-3 text-[10px] leading-4 text-black/45">Approval and rejection are human-only UI actions and are never exposed to WebMCP.</p>
        </div>
      )}
    </section>
  );
}

function DiffPill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' }) {
  const toneClass = { green: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-800', red: 'bg-rose-50 text-rose-800' }[tone];
  return <span className={`rounded-md px-2 py-1 ${toneClass}`}>{label}</span>;
}
