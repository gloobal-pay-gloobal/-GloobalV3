import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinancialCore,
  DomainEvent
} from "../app_bundle_testonly.mjs";

function freshCore(opts = {}) {
  return createFinancialCore({ userId: "event-consistency-user", currency: "INR", openingBankBalance: 1000, ...opts });
}

function withInjectedFailure(obj, methodName, fn) {
  const original = obj[methodName].bind(obj);
  obj[methodName] = () => {
    throw new Error(`injected failure: ${methodName}`);
  };
  try {
    fn(original);
  } finally {
    obj[methodName] = original;
  }
}

// Events this app's transactional lifecycle can produce, for filtering
// getHistory() down to just the ones relevant to a given txnId. Only
// PROVENANCE_COMPLETED/TRANSACTION_FAILED/TRANSACTION_LOCKED actually
// carry a txnId in their payload — LEDGER_ENTRY_POSTED/REJECTED do
// not (a ledger posting has no concept of "transaction" on its own),
// so ledger-side assertions below match on `memo` instead.
const TXN_TAGGED_EVENTS = [DomainEvent.PROVENANCE_COMPLETED, DomainEvent.TRANSACTION_FAILED, DomainEvent.TRANSACTION_LOCKED];

function eventsForTxn(core, txnId) {
  return core.eventBus.getHistory({ eventNames: TXN_TAGGED_EVENTS })
    .filter((r) => r.payload && r.payload.txnId === txnId);
}

function ledgerEventsForMemo(core, memo) {
  return core.eventBus.getHistory({ eventNames: [DomainEvent.LEDGER_ENTRY_POSTED, DomainEvent.LEDGER_ENTRY_REJECTED] })
    .filter((r) => r.payload && r.payload.memo === memo);
}

// ---------------------------------------------------------------------
// Successful transaction: every event published exactly once
// ---------------------------------------------------------------------
test("a successful transaction publishes each of its events exactly once, and only after commit", () => {
  const core = freshCore();
  const txnId = "TXN-EVENTS-SUCCESS";
  const historyBefore = core.eventBus.getHistory().length;
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 100,
    payMethodLabel: null,
    memo: "success",
    name: "Creator",
    shareRatePercent: 10, // also exercises the grant's own ledger posting
    time: "t"
  });
  assert.equal(result.ok, true);

  const ledgerPosted = core.eventBus.getHistory({ eventName: DomainEvent.LEDGER_ENTRY_POSTED });
  const provenanceCompleted = core.eventBus.getHistory({ eventName: DomainEvent.PROVENANCE_COMPLETED });
  // Two ledger postings for this transaction: the deduction and the
  // grant's own funding entry — each exactly once.
  assert.equal(ledgerPosted.filter((r) => r.payload.memo === "success").length, 1);
  assert.equal(ledgerPosted.filter((r) => r.payload.memo && r.payload.memo.startsWith("Essentials grant:")).length, 1);
  assert.equal(provenanceCompleted.filter((r) => r.payload.txnId === txnId).length, 1);
  // Nothing else (no TRANSACTION_FAILED, no TRANSACTION_LOCKED) for a clean success.
  assert.equal(core.eventBus.getHistory({ eventName: DomainEvent.TRANSACTION_FAILED }).filter((r) => r.payload.txnId === txnId).length, 0);
  assert.ok(core.eventBus.getHistory().length > historyBefore);
});

// ---------------------------------------------------------------------
// Failure at each stage: no committed success events, ever
// ---------------------------------------------------------------------
test("ledger failure (PayLater draw throws due to insufficient platform liquidity) -> no committed success events, only TRANSACTION_FAILED", () => {
  const core = freshCore();
  // Seed real PayLater headroom first (a separate, already-committed
  // transaction) so the transaction under test genuinely routes
  // through recordDraw rather than RiskEngine silently falling back
  // to an all-bank posting when there's no headroom at all.
  const seed = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-EVENTS-LEDGER-FAILS-SEED",
    amount: 100,
    payMethodLabel: null,
    memo: "seed",
    name: "Creator",
    shareRatePercent: 50,
    time: "t"
  });
  assert.equal(seed.ok, true);
  const { paylaterAvailable } = core.payLaterService.computeAvailable("INR");
  assert.ok(paylaterAvailable > 0);

  const txnId = "TXN-EVENTS-LEDGER-FAILS";
  const historyBefore = core.eventBus.getHistory().length;
  withInjectedFailure(core.payLaterService, "recordDraw", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: paylaterAvailable,
      payMethodLabel: "Gloobal PayLater",
      memo: "will fail in the draw itself",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "TRANSACTION_ROLLED_BACK");
  });
  const events = eventsForTxn(core, txnId);
  assert.equal(events.filter((r) => r.eventName === DomainEvent.PROVENANCE_COMPLETED).length, 0);
  assert.equal(events.filter((r) => r.eventName === DomainEvent.TRANSACTION_FAILED).length, 1);
  assert.equal(ledgerEventsForMemo(core, "will fail in the draw itself").length, 0);
  // Exactly the two events a failed attempt is allowed to produce:
  // the pre-boundary RISK_EVALUATED (not part of the transactional
  // outbox — see executeTransaction) and the one TRANSACTION_FAILED.
  assert.equal(core.eventBus.getHistory().length, historyBefore + 2);
});

test("ledger succeeds -> provenance fails -> the already-staged LEDGER_ENTRY_POSTED is discarded too, never reaching committed history", () => {
  const core = freshCore();
  const txnId = "TXN-EVENTS-PROVENANCE-FAILS";
  withInjectedFailure(core.provenanceService, "recordCompletion", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 40,
      payMethodLabel: null,
      memo: "provenance will fail",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    assert.equal(result.ok, false);
  });
  const events = eventsForTxn(core, txnId);
  assert.equal(events.filter((r) => r.eventName === DomainEvent.PROVENANCE_COMPLETED).length, 0);
  assert.equal(events.filter((r) => r.eventName === DomainEvent.TRANSACTION_FAILED).length, 1);
  // The deduction's LEDGER_ENTRY_POSTED was staged (ledger posting
  // happened before the injected provenance failure) but must never
  // have reached committed history.
  assert.equal(ledgerEventsForMemo(core, "provenance will fail").length, 0);
});

test("ledger + provenance succeed -> asset-seed grant fails -> BOTH the deduction's and the grant's staged ledger events, plus the provenance event, are all discarded", () => {
  const core = freshCore();
  const txnId = "TXN-EVENTS-GRANT-FAILS";
  withInjectedFailure(core.essentialsService, "addGrant", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 60,
      payMethodLabel: null,
      memo: "grant will fail",
      name: "Creator",
      shareRatePercent: 15, // must reach the grant stage
      time: "t"
    });
    assert.equal(result.ok, false);
  });
  const events = eventsForTxn(core, txnId);
  assert.equal(events.filter((r) => r.eventName === DomainEvent.PROVENANCE_COMPLETED).length, 0, "no provenance event survives, even though completion itself succeeded before the grant failed");
  assert.equal(events.filter((r) => r.eventName === DomainEvent.TRANSACTION_FAILED).length, 1);
  assert.equal(ledgerEventsForMemo(core, "grant will fail").length, 0, "no ledger event survives, even though the deduction itself succeeded before the grant failed");
});

test("PayLater draw succeeds -> completion fails -> the draw's own LEDGER_ENTRY_POSTED is discarded along with everything else", () => {
  const core = freshCore();
  const seed = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-EVENTS-SEED-PAYLATER",
    amount: 100,
    payMethodLabel: null,
    memo: "seed",
    name: "Creator",
    shareRatePercent: 50,
    time: "t"
  });
  assert.equal(seed.ok, true);
  const { paylaterAvailable } = core.payLaterService.computeAvailable("INR");
  assert.ok(paylaterAvailable > 0);

  const txnId = "TXN-EVENTS-PAYLATER-DRAW-THEN-FAIL";
  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: paylaterAvailable,
      payMethodLabel: "Gloobal PayLater",
      memo: "paylater draw then fail",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    assert.equal(result.ok, false);
  });
  const events = eventsForTxn(core, txnId);
  assert.equal(ledgerEventsForMemo(core, "PayLater draw: paylater draw then fail").length, 0);
  assert.equal(events.filter((r) => r.eventName === DomainEvent.TRANSACTION_FAILED).length, 1);
});

// ---------------------------------------------------------------------
// Retry-after-rollback and duplicate-after-commit, from the events side
// ---------------------------------------------------------------------
test("retrying the same txnId after a rollback succeeds cleanly and its events are published exactly once", () => {
  const core = freshCore();
  const txnId = "TXN-EVENTS-RETRY-AFTER-ROLLBACK";
  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    const failed = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 30,
      payMethodLabel: null,
      memo: "will roll back",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    assert.equal(failed.ok, false);
  });
  const afterRollback = eventsForTxn(core, txnId);
  assert.equal(afterRollback.filter((r) => r.eventName === DomainEvent.TRANSACTION_FAILED).length, 1);
  assert.equal(ledgerEventsForMemo(core, "will roll back").length, 0);

  const retried = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 30,
    payMethodLabel: null,
    memo: "retry, should succeed",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(retried.ok, true);
  const afterRetry = eventsForTxn(core, txnId);
  assert.equal(ledgerEventsForMemo(core, "retry, should succeed").length, 1);
  assert.equal(afterRetry.filter((r) => r.eventName === DomainEvent.PROVENANCE_COMPLETED).length, 1);
});

test("a duplicate call for an already-committed transaction produces no duplicate events at all — the replay path emits nothing new", () => {
  const core = freshCore();
  const txnId = "TXN-EVENTS-DUPLICATE-AFTER-COMMIT";
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 20,
    payMethodLabel: null,
    memo: "original",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  const historyLengthAfterFirst = core.eventBus.getHistory().length;
  const duplicate = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 20,
    payMethodLabel: null,
    memo: "duplicate",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.firstCompletion, false);
  assert.equal(core.eventBus.getHistory().length, historyLengthAfterFirst, "the replay path is a pure read — it must not touch the event bus at all");
});

// ---------------------------------------------------------------------
// Re-entrancy / concurrency: transactions cannot corrupt each other
// ---------------------------------------------------------------------
test("a transaction cannot be started re-entrantly while another is inside its mutating window, and a rolled-back transaction never erases a separately-committed one", () => {
  const core = freshCore();

  // A baseline, already-committed transaction (C) that must survive
  // completely untouched by whatever happens to A below.
  const baselineTxnId = "TXN-EVENTS-BASELINE-C";
  const baseline = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: baselineTxnId,
    amount: 75,
    payMethodLabel: null,
    memo: "baseline C",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(baseline.ok, true);
  const balanceAfterBaseline = core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount;
  const ledgerCountAfterBaseline = core.store.getAll().length;

  // Transaction A: injected into completeTransaction so that WHILE A is
  // still inside its own mutating/snapshot window, it synchronously
  // attempts to start a second, unrelated mutating transaction (B) —
  // simulating a listener or nested caller trying to mutate state
  // re-entrantly. B's attempt must be rejected outright (the lock),
  // and A must then still fail and roll back normally afterward.
  let nestedAttemptResult = null;
  const nestedTxnId = "TXN-EVENTS-NESTED-B-REJECTED";
  const originalCompleteTransaction = core.orchestrator.completeTransaction.bind(core.orchestrator);
  core.orchestrator.completeTransaction = (...args) => {
    nestedAttemptResult = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId: nestedTxnId,
      amount: 10,
      payMethodLabel: null,
      memo: "nested attempt while A is locked",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    throw new Error("A's own injected failure, after the nested attempt");
  };
  let resultA;
  try {
    resultA = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId: "TXN-EVENTS-A-WITH-NESTED-ATTEMPT",
      amount: 25,
      payMethodLabel: null,
      memo: "A, will fail after the nested attempt",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
  } finally {
    core.orchestrator.completeTransaction = originalCompleteTransaction;
  }

  // The nested attempt (B) was rejected by the lock, not merely failed.
  assert.ok(nestedAttemptResult, "the nested attempt must actually have run (inside A's window)");
  assert.equal(nestedAttemptResult.ok, false);
  assert.equal(nestedAttemptResult.code, "TRANSACTION_LOCKED");
  assert.equal(core.provenanceService.isFirstCompletion(nestedTxnId), true, "the rejected nested attempt left no trace at all");

  // A itself still failed and rolled back normally.
  assert.equal(resultA.ok, false);
  assert.equal(resultA.code, "TRANSACTION_ROLLED_BACK");
  assert.equal(core.provenanceService.isFirstCompletion("TXN-EVENTS-A-WITH-NESTED-ATTEMPT"), true);

  // Baseline C is untouched — A's rollback restored to ITS OWN
  // pre-transaction snapshot, not to a stale state from before C.
  assert.equal(core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount, balanceAfterBaseline);
  assert.equal(core.store.getAll().length, ledgerCountAfterBaseline);
  assert.equal(core.provenanceService.getCompletion(baselineTxnId) !== null, true);
  assert.equal(core.provenanceService.isFirstCompletion(baselineTxnId), false);

  // The lock was released — B, retried for real (a fresh call, not
  // the earlier rejected attempt) after A finished, now succeeds and
  // commits exactly once.
  const retriedB = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: nestedTxnId,
    amount: 10,
    payMethodLabel: null,
    memo: "B retried for real, after A finished",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(retriedB.ok, true);
  assert.equal(retriedB.firstCompletion, true);
  assert.equal(core.provenanceService.getForTxn(nestedTxnId).length, 1, "B committed exactly once");

  // And baseline C is STILL untouched after B commits too.
  assert.equal(core.provenanceService.getCompletion(baselineTxnId) !== null, true);
});

// ---------------------------------------------------------------------
// Deterministic timestamps and sequence numbers
// ---------------------------------------------------------------------
test("every committed event's business timestamp matches the transaction's authoritative `now`, not an independently-generated one", () => {
  const core = freshCore();
  const txnId = "TXN-EVENTS-TIMESTAMP";
  const authoritativeNow = new Date("2026-03-15T09:30:00.000Z");
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 45,
    payMethodLabel: null,
    memo: "timestamp check",
    name: "Creator",
    shareRatePercent: 10,
    time: "t",
    now: authoritativeNow
  });
  assert.equal(result.ok, true);
  assert.equal(result.completedAt.getTime(), authoritativeNow.getTime());

  const ledgerPosted = core.eventBus.getHistory({ eventName: DomainEvent.LEDGER_ENTRY_POSTED }).filter((r) => r.payload.memo === "timestamp check" || (r.payload.memo && r.payload.memo.startsWith("Essentials grant:")));
  for (const record of ledgerPosted) {
    assert.equal(new Date(record.payload.postedAt).getTime(), authoritativeNow.getTime(), `LEDGER_ENTRY_POSTED for "${record.payload.memo}" must carry the transaction's own now, not a separately-generated timestamp`);
  }
  const provenanceCompleted = core.eventBus.getHistory({ eventName: DomainEvent.PROVENANCE_COMPLETED }).find((r) => r.payload.txnId === txnId);
  assert.equal(new Date(provenanceCompleted.payload.completedAt).getTime(), authoritativeNow.getTime());

  // The underlying records (not just the events) carry the same fact.
  const completion = core.provenanceService.getCompletion(txnId);
  assert.equal(completion.recordedAt.getTime(), authoritativeNow.getTime());
  const ledgerRecord = core.store.getAll().find((r) => r.journalEntry.memo === "timestamp check");
  assert.equal(ledgerRecord.postedAt.getTime(), authoritativeNow.getTime());
});

test("a TRANSACTION_FAILED event's failedAt matches the transaction's authoritative `now`", () => {
  const core = freshCore();
  const txnId = "TXN-EVENTS-FAILED-TIMESTAMP";
  const authoritativeNow = new Date("2026-05-01T00:00:00.000Z");
  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 10,
      payMethodLabel: null,
      memo: "m",
      name: "R",
      shareRatePercent: 0,
      time: "t",
      now: authoritativeNow
    });
  });
  const failedEvent = core.eventBus.getHistory({ eventName: DomainEvent.TRANSACTION_FAILED }).find((r) => r.payload.txnId === txnId);
  assert.ok(failedEvent);
  assert.equal(new Date(failedEvent.payload.failedAt).getTime(), authoritativeNow.getTime());
});

test("calls to executeTransaction that don't supply `now` still produce one single shared timestamp across every effect of that call (not several independently-generated ones)", () => {
  const core = freshCore();
  const txnId = "TXN-EVENTS-IMPLICIT-NOW-CONSISTENCY";
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 30,
    payMethodLabel: null,
    memo: "implicit now",
    name: "Creator",
    shareRatePercent: 20,
    time: "t"
    // no `now` supplied — executeTransaction generates its own ONE
    // authoritative Date() at the top of the call.
  });
  assert.equal(result.ok, true);
  const ledgerRecord = core.store.getAll().find((r) => r.journalEntry.memo === "implicit now");
  const grantRecord = core.store.getAll().find((r) => r.journalEntry.memo && r.journalEntry.memo.startsWith("Essentials grant:"));
  const completion = core.provenanceService.getCompletion(txnId);
  assert.equal(ledgerRecord.postedAt.getTime(), completion.payload.completedAt.getTime(), "the deduction and the completion record must share exactly one timestamp");
  assert.equal(grantRecord.postedAt.getTime(), completion.payload.completedAt.getTime(), "the grant's own funding entry must share the same timestamp too");
  assert.equal(completion.recordedAt.getTime(), completion.payload.completedAt.getTime());
});

test("rolled-back events never consume a committed sequence number — the event bus history only ever grows by what actually committed", () => {
  const core = freshCore();
  const historyLengthBefore = core.eventBus.getHistory().length;

  // A failed transaction that WOULD have produced two transactional
  // events (a ledger post + a provenance completion) if it had
  // succeeded — plus the one pre-boundary RISK_EVALUATED, which is
  // NOT part of the transactional outbox (see executeTransaction) and
  // fires live either way, success or failure.
  const txnId = "TXN-EVENTS-SEQ-ROLLBACK";
  withInjectedFailure(core.provenanceService, "recordCompletion", () => {
    core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 15,
      payMethodLabel: null,
      memo: "would-be two events, rolled back",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
  });
  // Only RISK_EVALUATED (pre-boundary, always live) + TRANSACTION_FAILED
  // actually got sequence numbers — the discarded LEDGER_ENTRY_POSTED
  // never consumed one at all.
  assert.equal(core.eventBus.getHistory().length, historyLengthBefore + 2);
  assert.equal(ledgerEventsForMemo(core, "would-be two events, rolled back").length, 0);

  const lastSeqBeforeSuccess = core.eventBus.getHistory().at(-1).seq;

  // A normal successful transaction right after — its events' seq
  // numbers must immediately follow the failed attempt's, with no gap
  // reserved for the discarded LEDGER_ENTRY_POSTED/PROVENANCE_COMPLETED.
  const successTxnId = "TXN-EVENTS-SEQ-SUCCESS-AFTER-ROLLBACK";
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: successTxnId,
    amount: 20,
    payMethodLabel: null,
    memo: "normal success right after",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  const historyAfter = core.eventBus.getHistory();
  // RISK_EVALUATED, LEDGER_ENTRY_POSTED, PROVENANCE_COMPLETED, in order.
  const newEvents = historyAfter.slice(-3);
  assert.deepEqual(newEvents.map((r) => r.eventName), [DomainEvent.RISK_EVALUATED, DomainEvent.LEDGER_ENTRY_POSTED, DomainEvent.PROVENANCE_COMPLETED]);
  assert.equal(newEvents[0].seq, lastSeqBeforeSuccess + 1, "no sequence numbers were skipped or reserved for the rolled-back attempt's discarded events");
  assert.deepEqual(newEvents.map((r) => r.seq), [lastSeqBeforeSuccess + 1, lastSeqBeforeSuccess + 2, lastSeqBeforeSuccess + 3], "sequence numbers are perfectly contiguous across the rollback");
});
