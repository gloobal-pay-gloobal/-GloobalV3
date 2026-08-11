// src/screens/DevTools/DisputeCasesSection.jsx
import { useState as useStateDisputes } from "react";
var DISPUTE_STATUS_LABEL = {
  open: "Open \u2014 awaiting receiver",
  in_conversation: "In conversation",
  declined: "Declined",
  expired: "Expired",
  escalated: "Escalated for resolution",
  resolved: "Resolved"
};
function DisputeCasesSection() {
  const { getAllCases, acceptConversation, declineConversation, sweepExpiredDisputes } = useProvenanceAndDisputes();
  const [busyCaseId, setBusyCaseId] = useStateDisputes(null);
  const cases = getAllCases();
  const withAction = (caseId, fn) => {
    setBusyCaseId(caseId);
    fn(caseId);
    setBusyCaseId(null);
  };
  return <SectionCard
    icon={AlertTriangle}
    title="Dispute cases"
    subtitle="Complaints are cases, never automatic reversals or fraud flags. Declined/expired cases escalate for resolution instead of resolving themselves."
    actions={<button
      onClick={() => sweepExpiredDisputes()}
      className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold"
      style={{ background: T.surfaceAlt, color: T.inkSoft }}
    >
          Run expiry sweep
        </button>}
  >{cases.length === 0 ? <p className="text-[12px]" style={{ color: T.inkFaint }}>
          No cases yet — "Report an issue" on a receipt opens one.
        </p> : <ul className="flex flex-col gap-2">{cases.map((c) => <li key={c.caseId} className="rounded-xl px-3 py-2.5" style={{ background: T.surfaceAlt }}><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-[12.5px] font-mono truncate" style={{ color: T.ink }}>{c.caseId}</p><p className="text-[11.5px]" style={{ color: T.inkSoft }}>
                  txn {c.txnId} · raised by {c.raisedBy}
                </p></div><StatusPill status={["resolved", "in_conversation"].includes(c.status) ? "pass" : c.status === "escalated" ? "warn" : c.status === "open" ? "warn" : "fail"} /></div><p className="text-[11.5px] mt-1" style={{ color: T.inkSoft }}>{DISPUTE_STATUS_LABEL[c.status] || c.status}{c.status === "open" && ` \xB7 receiver has until ${new Date(c.receiverResponseDeadline).toLocaleString()}`}</p>{c.status === "open" && <div className="flex gap-2 mt-2"><button
    disabled={busyCaseId === c.caseId}
    onClick={() => withAction(c.caseId, acceptConversation)}
    className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-white disabled:opacity-60"
    style={{ background: T.gradButton }}
  >
                    Accept (as receiver)
                  </button><button
    disabled={busyCaseId === c.caseId}
    onClick={() => withAction(c.caseId, declineConversation)}
    className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold disabled:opacity-60"
    style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.line}` }}
  >
                    Decline
                  </button></div>}</li>)}</ul>}</SectionCard>;
}

function DiagnosticsScreen({ onClose }) {
  const requestClose = useBackClose(true, onClose);
  const diagnostics = useDiagnostics();
  const timeline = useLedgerTimeline();
  return <div className="flex flex-col font-sans" style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg }}><div
    className="px-4 pb-3 flex items-center gap-2.5"
    style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", background: T.surface, borderBottom: `1px solid ${T.line}` }}
  ><button
    onClick={requestClose}
    aria-label="Close diagnostics"
    className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
    style={{ background: T.surfaceAlt }}
  ><ArrowLeft6 size={19} style={{ color: T.ink }} /></button><div><h1 className="text-[16px] font-bold" style={{ color: T.ink }}>
            Ledger Explorer &amp; Diagnostics
          </h1><p className="text-[11.5px]" style={{ color: T.inkSoft }}>
            Developer-only · internal platform health
          </p></div></div><div className="flex-1 overflow-y-auto px-3 pt-3 pb-8" style={{ scrollbarWidth: "none" }}><HealthSection health={diagnostics.health} /><AccountsSection accounts={diagnostics.accounts} ledgerStats={diagnostics.ledgerStats} /><TimeTravelSection timeline={timeline} /><ReplaySection /><DisputeCasesSection /><StressTestSection /><EventLogSection events={diagnostics.recentEvents} /></div></div>;
}

