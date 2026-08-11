// src/domain/events/DomainEvents.js
var DomainEvent = Object.freeze({
  // Ledger writes — one per JournalEntry that successfully posts.
  // payload: { recordId, journalEntryId, sequence, memo, meta, lines }
  LEDGER_ENTRY_POSTED: "ledger.entry.posted",
  // Ledger writes that were attempted but rejected before posting
  // (unbalanced entry, unknown account, invalid line). Distinct from a
  // RiskEngine rejection — this is a structural/programmer error, a
  // risk rejection is a legitimate business decision.
  // payload: { code, message, attempted: { memo, lines } }
  LEDGER_ENTRY_REJECTED: "ledger.entry.rejected",
  // Every RiskEngine.evaluateSend call, win or lose — this is the
  // single choke point for "was money movement allowed" analytics.
  // payload: { ok, code?, reason?, amount, payMethodLabel, decision }
  RISK_EVALUATED: "risk.evaluated",
  // Settlement batches (Essentials→Bank, Referral→Bank).
  // payload: { kind: "essentials"|"referral", amount, ledgerRecordId }
  SETTLEMENT_POSTED: "settlement.posted",
  // PayLater draws against available credit.
  // payload: { amount, label, ledgerRecordId }
  PAYLATER_DRAW_RECORDED: "paylater.draw.recorded",
  // Essentials grants (cashback seeds) — NOT the same thing as the My
  // Essentials daily pool below; this is Creator Share.
  // payload: { key, business, amountPaid, cashbackRate }
  ESSENTIALS_GRANT_ADDED: "essentials.grant.added",
  // The My Essentials daily liquidity pool topped up a user's bank
  // balance directly from the platform reserve — a real subsidy, not
  // Creator Share, not PayLater. See EssentialsPoolService.
  // payload: { amount, dailyLimit, usedToday, remainingToday, appliedAt }
  ESSENTIALS_POOL_APPLIED: "essentials.pool.applied",
  // Resilience layer — see domain/resilience/.
  // payload varies per event, documented at each emit site.
  REQUEST_RETRIED: "resilience.request.retried",
  REQUEST_DEDUPED: "resilience.request.deduped",
  REQUEST_QUEUED_OFFLINE: "resilience.request.queued_offline",
  OFFLINE_QUEUE_FLUSHED: "resilience.offline_queue.flushed",
  FAULT_INJECTED: "resilience.fault.injected",
  // Simulator lifecycle — see domain/simulation/.
  // payload: { scenario, stepIndex, total } / { scenario, report }
  SIMULATION_STEP: "simulation.step",
  SIMULATION_COMPLETE: "simulation.complete",
  // Transaction provenance — see domain/provenance/. Completion is
  // recorded once per txnId, distinct from (and after) the ledger
  // posting that backs it.
  // payload: { txnId, completedAt, complaintWindowExpiresAt }
  PROVENANCE_COMPLETED: "provenance.completed",
  // A location observation (sender's or receiver's own device
  // reporting its own lat/lon/accuracy/timestamp/status) arrived
  // independently of transaction completion — before, after, or
  // instead of one ever completing for this txnId.
  // payload: { txnId, role, status, submittedAt }
  LOCATION_OBSERVATION_SUBMITTED: "provenance.location_observation_submitted",
  // Transaction outbox lifecycle — see TransactionOrchestrator's
  // #stageEvents/#flushStaged/#discardStaged. Every event a
  // transaction's mutating stages would normally emit (LEDGER_ENTRY_
  // POSTED, LEDGER_ENTRY_REJECTED, PROVENANCE_COMPLETED) is staged in
  // a private per-call outbox instead of published live; only on a
  // successful commit are they replayed onto the real bus, in order,
  // via TRANSACTION_COMMITTED-adjacent flushing (no separate "commit"
  // event is emitted — the staged events themselves ARE the commit
  // signal once flushed). TRANSACTION_FAILED is the one event a failed
  // attempt ever produces on the real bus, and only after rollback is
  // complete — never a success-shaped event for work that got undone.
  // payload: { txnId, code, reason, failedAt }
  TRANSACTION_FAILED: "transaction.failed",
  // A transaction was rejected outright because another transaction
  // was already inside its mutating/snapshot window on the same
  // orchestrator — see the re-entrancy lock in executeTransaction.
  // Not a failure of the transaction itself (nothing was attempted),
  // so kept distinct from TRANSACTION_FAILED.
  // payload: { txnId }
  TRANSACTION_LOCKED: "transaction.locked",
  // Dispute case lifecycle — see domain/disputes/. One case can move
  // through opened -> accepted -> resolved, or opened -> declined/
  // expired -> escalated. Never automatic fraud/reversal.
  // payload: { caseId, txnId, raisedBy, receiverResponseDeadline }
  DISPUTE_OPENED: "dispute.opened",
  // payload: { caseId, acceptedAt }
  DISPUTE_ACCEPTED: "dispute.accepted",
  // payload: { caseId, declinedAt }
  DISPUTE_DECLINED: "dispute.declined",
  // payload: { caseId, expiredAt }
  DISPUTE_EXPIRED: "dispute.expired",
  // payload: { caseId, escalatedAt, triggeredBy: "declined"|"expired" }
  DISPUTE_ESCALATED: "dispute.escalated",
  // payload: { caseId, resolvedAt, resolution }
  DISPUTE_RESOLVED: "dispute.resolved",
  // Composition-root lifecycle.
  // payload: { userId, currency, openingBankBalance }
  CORE_INITIALIZED: "core.initialized"
});
var ERROR_EVENTS = /* @__PURE__ */ new Set([DomainEvent.LEDGER_ENTRY_REJECTED, DomainEvent.FAULT_INJECTED]);

