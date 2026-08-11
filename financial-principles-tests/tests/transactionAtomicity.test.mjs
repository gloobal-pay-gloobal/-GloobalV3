import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinancialCore,
  LOCATION_STATUS
} from "../app_bundle_testonly.mjs";

function freshCore(opts = {}) {
  return createFinancialCore({ userId: "atomicity-user", currency: "INR", openingBankBalance: 1000, ...opts });
}

// Snapshots the handful of observable facts every rollback test needs
// to compare before/after: balance, ledger record count, PayLater
// record count, and (for a given txnId) whether completion/provenance/
// grant/complaint-window exist at all.
function observe(core, txnId) {
  return {
    bankBalance: core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount,
    ledgerCount: core.store.getAll().length,
    paylaterCount: core.payLaterService.listRecords().length,
    grantCount: core.essentialsService.listGrants().length,
    completion: core.provenanceService.getCompletion(txnId),
    provenanceRecordsForTxn: core.provenanceService.getForTxn(txnId).length,
    complaintWindow: core.provenanceService.getComplaintWindow(txnId)
  };
}

// Temporarily replaces `obj[methodName]` with a function that throws,
// runs `fn()`, and restores the original method afterward — even if
// `fn()` throws or an assertion inside it fails. This is the
// fault-injection mechanism for every test below: no production code
// needed to support it, since normal JS method dispatch (`this.foo()`)
// always resolves against whatever is currently on the instance.
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

function assertNoTraceOfTransaction(core, txnId, before, after) {
  assert.equal(after.bankBalance, before.bankBalance, "balance must be exactly unchanged after rollback");
  assert.equal(after.ledgerCount, before.ledgerCount, "no ledger record left behind after rollback");
  assert.equal(after.paylaterCount, before.paylaterCount, "no PayLater record left behind after rollback");
  assert.equal(after.grantCount, before.grantCount, "no asset-seed grant left behind after rollback");
  assert.equal(core.provenanceService.getCompletion(txnId), null, "no completion record after rollback");
  assert.equal(core.provenanceService.getForTxn(txnId).length, 0, "no provenance trace at all for this txnId after rollback");
  assert.equal(core.provenanceService.getComplaintWindow(txnId), null, "no complaint window after rollback");
  assert.equal(core.provenanceService.isFirstCompletion(txnId), true, "txnId is indistinguishable from one that never ran");
}

// ---------------------------------------------------------------------
// Stage 1: ledger succeeds, then a later stage fails
// ---------------------------------------------------------------------
test("ledger succeeds -> completion fails -> full rollback, nothing left behind", () => {
  const core = freshCore();
  const txnId = "TXN-LEDGER-THEN-COMPLETION-FAILS";
  const before = observe(core, txnId);
  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 100,
      payMethodLabel: null,
      memo: "will fail at completion",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "TRANSACTION_ROLLED_BACK");
  });
  const after = observe(core, txnId);
  assertNoTraceOfTransaction(core, txnId, before, after);
});

test("ledger succeeds -> provenance recording fails -> full rollback, nothing left behind", () => {
  const core = freshCore();
  const txnId = "TXN-LEDGER-THEN-PROVENANCE-FAILS";
  const before = observe(core, txnId);
  withInjectedFailure(core.provenanceService, "recordCompletion", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 50,
      payMethodLabel: null,
      memo: "will fail at provenance",
      name: "R",
      shareRatePercent: 10, // eligible for a grant, which must also never be created
      time: "t"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "TRANSACTION_ROLLED_BACK");
  });
  const after = observe(core, txnId);
  assertNoTraceOfTransaction(core, txnId, before, after);
});

test("ledger + provenance succeed -> asset-seed grant fails -> full rollback, including the already-recorded provenance and the already-posted ledger debit", () => {
  const core = freshCore();
  const txnId = "TXN-GRANT-FAILS";
  const before = observe(core, txnId);
  withInjectedFailure(core.essentialsService, "addGrant", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 80,
      payMethodLabel: null,
      memo: "will fail at grant",
      name: "Creator",
      shareRatePercent: 5, // must reach the grant stage
      time: "t"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "TRANSACTION_ROLLED_BACK");
  });
  const after = observe(core, txnId);
  assertNoTraceOfTransaction(core, txnId, before, after);
});

// ---------------------------------------------------------------------
// PayLater-specific: a draw is a ledger + PayLater-record mutation
// pair, and both must roll back together with everything else.
// ---------------------------------------------------------------------
test("PayLater draw succeeds -> completion fails -> the draw's ledger entry AND its PayLater record both roll back", () => {
  const core = freshCore(); // default opening balance covers the seed step
  // Seed enough Essentials value to fund a PayLater limit, via a
  // separate, already-committed transaction (not part of what we're
  // about to roll back).
  const seed = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-SEED-PAYLATER-LIMIT",
    amount: 100,
    payMethodLabel: null,
    memo: "seed",
    name: "Creator",
    shareRatePercent: 50, // amountPaid(100) * 0.5 = 50 of PayLater headroom
    time: "t"
  });
  assert.equal(seed.ok, true, "test setup sanity: the seed transaction itself must succeed");
  const { paylaterAvailable } = core.payLaterService.computeAvailable("INR");
  assert.ok(paylaterAvailable > 0, "test setup sanity: there must be PayLater headroom to draw against");

  const txnId = "TXN-PAYLATER-THEN-COMPLETION-FAILS";
  const before = observe(core, txnId);
  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: paylaterAvailable, // fully from PayLater
      payMethodLabel: "Gloobal PayLater",
      memo: "will fail after the draw",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "TRANSACTION_ROLLED_BACK");
  });
  const after = observe(core, txnId);
  assertNoTraceOfTransaction(core, txnId, before, after);
  // Specifically re-confirm the PayLater side, by name, since that's
  // the whole point of this test.
  assert.equal(core.payLaterService.listRecords().length, before.paylaterCount);
});

// ---------------------------------------------------------------------
// Complaint-window creation is part of the same provenance record as
// completion — failing to persist it must roll back exactly like any
// other stage.
// ---------------------------------------------------------------------
test("complaint-window creation fails (persistence layer failure) -> full rollback, nothing left behind", () => {
  const core = freshCore();
  const txnId = "TXN-WINDOW-CREATION-FAILS";
  const before = observe(core, txnId);
  withInjectedFailure(core.provenanceService.store, "append", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 30,
      payMethodLabel: null,
      memo: "will fail while persisting the completion+window record",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "TRANSACTION_ROLLED_BACK");
  });
  const after = observe(core, txnId);
  assertNoTraceOfTransaction(core, txnId, before, after);
  assert.equal(core.provenanceService.getComplaintWindow(txnId), null);
});

// ---------------------------------------------------------------------
// Idempotency: duplicate-after-commit, and retry-after-rollback
// ---------------------------------------------------------------------
test("a duplicate call for an already-committed transaction never duplicates money, provenance, or the asset seed", () => {
  const core = freshCore();
  const txnId = "TXN-DUPLICATE-AFTER-COMMIT";
  const first = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 60,
    payMethodLabel: null,
    memo: "original",
    name: "Creator",
    shareRatePercent: 10,
    time: "t"
  });
  assert.equal(first.ok, true);
  assert.equal(first.firstCompletion, true);
  const afterFirst = observe(core, txnId);

  const second = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 60,
    payMethodLabel: null,
    memo: "duplicate attempt",
    name: "Creator",
    shareRatePercent: 10,
    time: "t"
  });
  assert.equal(second.ok, true);
  assert.equal(second.firstCompletion, false);
  assert.equal(second.ledgerRecordId, first.ledgerRecordId);
  assert.equal(second.grant, null, "no second grant on the duplicate");

  const afterSecond = observe(core, txnId);
  assert.equal(afterSecond.bankBalance, afterFirst.bankBalance, "balance identical after the duplicate call");
  assert.equal(afterSecond.ledgerCount, afterFirst.ledgerCount, "no second ledger entry from the duplicate");
  assert.equal(afterSecond.grantCount, afterFirst.grantCount, "no second grant from the duplicate");
  assert.equal(afterSecond.provenanceRecordsForTxn, afterFirst.provenanceRecordsForTxn, "no second provenance record from the duplicate");
  assert.equal(afterSecond.complaintWindow.expiresAt.getTime(), afterFirst.complaintWindow.expiresAt.getTime(), "the SAME complaint window, not a reopened one");
});

test("retrying the same txnId after a rollback succeeds cleanly and creates each effect exactly once", () => {
  const core = freshCore();
  const txnId = "TXN-RETRY-AFTER-ROLLBACK";
  const before = observe(core, txnId);

  // First attempt: injected failure forces a full rollback.
  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    const failed = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 70,
      payMethodLabel: null,
      memo: "first attempt (will roll back)",
      name: "Creator",
      shareRatePercent: 20,
      time: "t"
    });
    assert.equal(failed.ok, false);
  });
  const afterRollback = observe(core, txnId);
  assertNoTraceOfTransaction(core, txnId, before, afterRollback);

  // Second attempt, same txnId, no injected failure this time — a
  // completely ordinary retry (as a real client would do with a fresh
  // clientRequestId per attempt).
  const retried = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 70,
    payMethodLabel: null,
    memo: "retry (should succeed)",
    name: "Creator",
    shareRatePercent: 20,
    time: "t"
  });
  assert.equal(retried.ok, true);
  assert.equal(retried.firstCompletion, true, "the rolled-back attempt left no trace, so this really is the first completion");
  assert.ok(retried.grant);

  const afterRetry = observe(core, txnId);
  // Effects exist exactly once — as if the failed attempt never
  // happened. shareRatePercent>0 means TWO ledger entries per success
  // (the deduction itself, plus the Essentials grant's own funding
  // entry) — both exactly once, not duplicated by the earlier
  // rolled-back attempt.
  assert.equal(afterRetry.ledgerCount, before.ledgerCount + 2, "exactly one deduction + one grant-funding entry from the successful retry, nothing extra from the rolled-back attempt");
  assert.equal(afterRetry.grantCount, before.grantCount + 1, "exactly one grant from the successful retry");
  assert.equal(afterRetry.provenanceRecordsForTxn, 1, "exactly one provenance record from the successful retry");
  assert.ok(afterRetry.completion);
  assert.ok(afterRetry.complaintWindow);

  // And a further duplicate of the now-committed retry still doesn't
  // duplicate anything (chains the two guarantees together).
  const duplicateOfRetry = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 70,
    payMethodLabel: null,
    memo: "duplicate of the retry",
    name: "Creator",
    shareRatePercent: 20,
    time: "t"
  });
  assert.equal(duplicateOfRetry.firstCompletion, false);
  const afterDuplicateOfRetry = observe(core, txnId);
  assert.equal(afterDuplicateOfRetry.ledgerCount, afterRetry.ledgerCount);
  assert.equal(afterDuplicateOfRetry.grantCount, afterRetry.grantCount);
});

test("a clientRequestId retried after a rollback (the SAME request id) replays the cached rollback result rather than re-attempting — the txnId-level retry test above uses a fresh request id instead, matching real client retry behavior", () => {
  const core = freshCore();
  const txnId = "TXN-SAME-REQUEST-ID-AFTER-ROLLBACK";
  const requestId = "req-same-id-1";
  let firstResult;
  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    firstResult = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 10,
      payMethodLabel: null,
      memo: "m",
      name: "R",
      shareRatePercent: 0,
      time: "t",
      clientRequestId: requestId
    });
    assert.equal(firstResult.ok, false);
  });
  // Same clientRequestId again, even though the underlying fault is
  // gone — the IdempotencyGuard returns the cached (failed) result
  // without re-running anything, which is correct idempotency-key
  // semantics (same request, same outcome) and is why real retries
  // use a fresh request id per attempt, as exercised above.
  const secondResult = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 10,
    payMethodLabel: null,
    memo: "m",
    name: "R",
    shareRatePercent: 0,
    time: "t",
    clientRequestId: requestId
  });
  assert.deepEqual(secondResult, firstResult);
  assert.equal(core.provenanceService.isFirstCompletion(txnId), true, "still untouched — the cached replay never re-ran anything");
});

// ---------------------------------------------------------------------
// Location stays fully decoupled from the transactional boundary
// ---------------------------------------------------------------------
test("a rolled-back transaction has no location state of any kind, and a subsequent successful retry starts location fresh (still independent of completion)", () => {
  const core = freshCore();
  const txnId = "TXN-ROLLBACK-THEN-LOCATION";
  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 15,
      payMethodLabel: null,
      memo: "m",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
  });
  assert.equal(core.provenanceService.getLocationStatusForViewer(txnId, "sender"), null, "no location state at all for a txnId that never actually completed");

  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 15,
    payMethodLabel: null,
    memo: "m",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  // Now that it's really completed, location starts as UNKNOWN (never
  // fabricated) and remains independently submittable.
  assert.equal(core.provenanceService.getLocationStatusForViewer(txnId, "sender"), LOCATION_STATUS.UNKNOWN);
});

test("a failed risk evaluation (before any mutation) needs no rollback and is a complete no-op — the baseline this whole file's rollback tests are contrasted against", () => {
  const core = freshCore({ openingBankBalance: 5 });
  const txnId = "TXN-RISK-FAILS-BASELINE";
  const before = observe(core, txnId);
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 999,
    payMethodLabel: null,
    memo: "too much",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(result.ok, false);
  assert.notEqual(result.code, "TRANSACTION_ROLLED_BACK", "a risk failure is a plain decision rejection, not a rollback — nothing ever mutated");
  const after = observe(core, txnId);
  assertNoTraceOfTransaction(core, txnId, before, after);
});
