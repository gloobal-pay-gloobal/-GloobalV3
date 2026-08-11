import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinancialCore,
  DomainEvent,
  LOCATION_STATUS
} from "../app_bundle_testonly.mjs";

function freshCore(opts = {}) {
  return createFinancialCore({ userId: "outbox-completeness-user", currency: "INR", openingBankBalance: 1000, ...opts });
}

// Same fault-injection technique as transactionAtomicity.test.mjs and
// transactionEventConsistency.test.mjs: swap a method, run, restore —
// no production hooks needed since `this.foo()` always resolves
// dynamically against whatever is currently on the instance.
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

// A different flavor of injection for "X succeeded, THEN something
// later failed": runs the REAL method first (so its real effects
// happen — the ledger post, the PayLater record, the Essentials
// grant), then throws, standing in for a hypothetical later stage
// failing after this one's own work genuinely completed.
function withInjectedFailureAfter(obj, methodName, fn) {
  const original = obj[methodName].bind(obj);
  obj[methodName] = (...args) => {
    const result = original(...args);
    throw new Error(`injected failure after real ${methodName} completed`);
  };
  try {
    fn();
  } finally {
    obj[methodName] = original;
  }
}

function observe(core, txnId) {
  return {
    bankBalance: core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount,
    ledgerCount: core.store.getAll().length,
    paylaterCount: core.payLaterService.listRecords().length,
    grantCount: core.essentialsService.listGrants().length,
    completion: core.provenanceService.getCompletion(txnId)
  };
}

function ledgerEventsForMemo(core, memo) {
  return core.eventBus.getHistory({ eventNames: [DomainEvent.LEDGER_ENTRY_POSTED, DomainEvent.LEDGER_ENTRY_REJECTED] })
    .filter((r) => r.payload && r.payload.memo === memo);
}
function payLaterEvents(core) {
  return core.eventBus.getHistory({ eventName: DomainEvent.PAYLATER_DRAW_RECORDED });
}
function essentialsEvents(core) {
  return core.eventBus.getHistory({ eventName: DomainEvent.ESSENTIALS_GRANT_ADDED });
}
function provenanceEventsForTxn(core, txnId) {
  return core.eventBus.getHistory({ eventName: DomainEvent.PROVENANCE_COMPLETED }).filter((r) => r.payload.txnId === txnId);
}
function transactionFailedEventsForTxn(core, txnId) {
  return core.eventBus.getHistory({ eventName: DomainEvent.TRANSACTION_FAILED }).filter((r) => r.payload.txnId === txnId);
}

// Seeds real PayLater headroom via a separate, already-committed
// transaction (not part of whatever the calling test is rolling
// back), and returns the resulting available amount.
function seedPayLaterHeadroom(core, txnId) {
  const seed = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 100,
    payMethodLabel: null,
    memo: "seed",
    name: "Creator",
    shareRatePercent: 50,
    time: "t"
  });
  assert.equal(seed.ok, true, "test setup sanity: the seed transaction must succeed");
  const { paylaterAvailable } = core.payLaterService.computeAvailable("INR");
  assert.ok(paylaterAvailable > 0, "test setup sanity: there must be PayLater headroom");
  return paylaterAvailable;
}

// ---------------------------------------------------------------------
// PayLater and Essentials both have a real eventBus now, staged the
// same way Ledger/Provenance already were.
// ---------------------------------------------------------------------
test("PayLaterService and EssentialsService both have a live eventBus wired in by default", () => {
  const core = freshCore();
  assert.ok(core.payLaterService.eventBus, "PayLaterService must have a real eventBus, not null, outside any transaction");
  assert.ok(core.essentialsService.eventBus, "EssentialsService must have a real eventBus, not null, outside any transaction");
});

// ---------------------------------------------------------------------
// 1. Ledger succeeds -> Provenance succeeds -> PayLater succeeds ->
//    Essentials fails. Roll back everything; no success events at all.
// ---------------------------------------------------------------------
test("1: ledger + provenance + PayLater all succeed, then Essentials fails -> full rollback, zero committed success events", () => {
  const core = freshCore();
  const paylaterAvailable = seedPayLaterHeadroom(core, "TXN-OB1-SEED");
  const txnId = "TXN-OB1";
  const before = observe(core, txnId);

  withInjectedFailure(core.essentialsService, "addGrant", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: paylaterAvailable,
      payMethodLabel: "Gloobal PayLater",
      memo: "ob1 draw",
      name: "Creator",
      shareRatePercent: 10, // must reach the essentials stage
      time: "t"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "TRANSACTION_ROLLED_BACK");
  });

  const after = observe(core, txnId);
  assert.equal(after.bankBalance, before.bankBalance);
  assert.equal(after.ledgerCount, before.ledgerCount);
  assert.equal(after.paylaterCount, before.paylaterCount);
  assert.equal(after.grantCount, before.grantCount);
  assert.equal(core.provenanceService.getCompletion(txnId), null);

  // No committed success event of any kind survives.
  assert.equal(ledgerEventsForMemo(core, "ob1 draw").length, 0);
  assert.equal(ledgerEventsForMemo(core, "PayLater draw: ob1 draw").length, 0);
  assert.equal(provenanceEventsForTxn(core, txnId).length, 0);
  assert.equal(payLaterEvents(core).filter((r) => r.payload.label === "ob1 draw").length, 0);
  assert.equal(essentialsEvents(core).filter((r) => r.payload.txnId === txnId).length, 0);
  assert.equal(transactionFailedEventsForTxn(core, txnId).length, 1);
});

// ---------------------------------------------------------------------
// 2. Ledger succeeds -> PayLater succeeds -> completion stage fails.
//    Roll back PayLater and ledger; no PayLater success event remains.
// ---------------------------------------------------------------------
test("2: ledger + PayLater draw succeed, then the completion stage fails -> PayLater and ledger both roll back, no PayLater event remains", () => {
  const core = freshCore();
  const paylaterAvailable = seedPayLaterHeadroom(core, "TXN-OB2-SEED");
  const txnId = "TXN-OB2";
  const before = observe(core, txnId);

  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: paylaterAvailable,
      payMethodLabel: "Gloobal PayLater",
      memo: "ob2 draw",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    assert.equal(result.ok, false);
  });

  const after = observe(core, txnId);
  assert.equal(after.paylaterCount, before.paylaterCount, "PayLater record rolled back");
  assert.equal(after.ledgerCount, before.ledgerCount, "ledger rolled back");
  assert.equal(after.bankBalance, before.bankBalance);
  assert.equal(ledgerEventsForMemo(core, "PayLater draw: ob2 draw").length, 0);
  assert.equal(payLaterEvents(core).filter((r) => r.payload.label === "ob2 draw").length, 0, "no PayLater success event remains");
  assert.equal(transactionFailedEventsForTxn(core, txnId).length, 1);
});

// ---------------------------------------------------------------------
// 3. Ledger succeeds -> Essentials succeeds -> a later stage fails.
//    Roll back Essentials and ledger; no Essentials success event remains.
// ---------------------------------------------------------------------
test("3: ledger succeeds and Essentials succeeds, then a later stage fails -> Essentials and ledger both roll back, no Essentials event remains", () => {
  const core = freshCore();
  const txnId = "TXN-OB3";
  const before = observe(core, txnId);

  // addGrant is allowed to really run (grant + its funding ledger
  // entry both genuinely happen), and only then does the injected
  // failure fire — standing in for a later stage failing after
  // Essentials' own work was already done.
  withInjectedFailureAfter(core.essentialsService, "addGrant", () => {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: 80,
      payMethodLabel: null,
      memo: "ob3",
      name: "Creator",
      shareRatePercent: 20,
      time: "t"
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "TRANSACTION_ROLLED_BACK");
  });

  const after = observe(core, txnId);
  assert.equal(after.grantCount, before.grantCount, "the grant that really happened is still rolled back");
  assert.equal(after.ledgerCount, before.ledgerCount);
  assert.equal(after.bankBalance, before.bankBalance);
  assert.equal(essentialsEvents(core).filter((r) => r.payload.txnId === txnId).length, 0, "no Essentials event remains, even though addGrant's real work happened");
  assert.equal(ledgerEventsForMemo(core, "ob3").length, 0);
  assert.equal(ledgerEventsForMemo(core, "Essentials grant: Creator Share \u00b7 Creator").length, 0);
  assert.equal(transactionFailedEventsForTxn(core, txnId).length, 1);
});

// ---------------------------------------------------------------------
// 4 & 5. Successful transactions: each event exactly once.
// ---------------------------------------------------------------------
test("4: a successful PayLater transaction publishes PAYLATER_DRAW_RECORDED exactly once", () => {
  const core = freshCore();
  const paylaterAvailable = seedPayLaterHeadroom(core, "TXN-OB4-SEED");
  const txnId = "TXN-OB4";
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: paylaterAvailable,
    payMethodLabel: "Gloobal PayLater",
    memo: "ob4 draw",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(result.ok, true);
  assert.equal(payLaterEvents(core).filter((r) => r.payload.label === "ob4 draw").length, 1);
});

test("5: a successful Essentials-eligible transaction publishes ESSENTIALS_GRANT_ADDED exactly once", () => {
  const core = freshCore();
  const txnId = "TXN-OB5";
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: 50,
    payMethodLabel: null,
    memo: "ob5",
    name: "Creator",
    shareRatePercent: 12,
    time: "t"
  });
  assert.equal(result.ok, true);
  assert.equal(essentialsEvents(core).filter((r) => r.payload.txnId === txnId).length, 1);
});

// ---------------------------------------------------------------------
// 6. Duplicate committed transaction -> no duplicate events, of any kind.
// ---------------------------------------------------------------------
test("6: a duplicate call for an already-committed transaction produces no duplicate PayLater or Essentials events", () => {
  const core = freshCore();
  const paylaterAvailable = seedPayLaterHeadroom(core, "TXN-OB6-SEED");
  const txnId = "TXN-OB6";
  const first = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: paylaterAvailable,
    payMethodLabel: "Gloobal PayLater",
    memo: "ob6 draw",
    name: "Creator",
    shareRatePercent: 15,
    time: "t"
  });
  assert.equal(first.ok, true);
  const paylaterCountAfterFirst = core.payLaterService.listRecords().length;
  const grantCountAfterFirst = core.essentialsService.listGrants().length;

  const duplicate = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: paylaterAvailable,
    payMethodLabel: "Gloobal PayLater",
    memo: "ob6 draw duplicate",
    name: "Creator",
    shareRatePercent: 15,
    time: "t"
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.firstCompletion, false);
  assert.equal(payLaterEvents(core).filter((r) => r.payload.label === "ob6 draw").length, 1);
  assert.equal(essentialsEvents(core).filter((r) => r.payload.txnId === txnId).length, 1);
  assert.equal(core.payLaterService.listRecords().length, paylaterCountAfterFirst, "no second PayLater record from the duplicate");
  assert.equal(core.essentialsService.listGrants().length, grantCountAfterFirst, "no second grant from the duplicate");
});

// ---------------------------------------------------------------------
// 7. Retry after rollback -> succeeds normally, events exactly once.
// ---------------------------------------------------------------------
test("7: retrying the same txnId after a rollback succeeds cleanly, with PayLater and Essentials events appearing exactly once", () => {
  const core = freshCore();
  const paylaterAvailable = seedPayLaterHeadroom(core, "TXN-OB7-SEED");
  const txnId = "TXN-OB7";

  withInjectedFailure(core.orchestrator, "completeTransaction", () => {
    const failed = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: paylaterAvailable,
      payMethodLabel: "Gloobal PayLater",
      memo: "ob7 will fail",
      name: "Creator",
      shareRatePercent: 10,
      time: "t"
    });
    assert.equal(failed.ok, false);
  });
  assert.equal(payLaterEvents(core).filter((r) => r.payload.label === "ob7 will fail").length, 0);
  assert.equal(core.provenanceService.isFirstCompletion(txnId), true);

  const retried = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: paylaterAvailable,
    payMethodLabel: "Gloobal PayLater",
    memo: "ob7 retry",
    name: "Creator",
    shareRatePercent: 10,
    time: "t"
  });
  assert.equal(retried.ok, true);
  assert.equal(retried.firstCompletion, true);
  assert.equal(payLaterEvents(core).filter((r) => r.payload.label === "ob7 retry").length, 1);
  assert.equal(essentialsEvents(core).filter((r) => r.payload.txnId === txnId).length, 1);

  // A further duplicate of the now-committed retry still doesn't add more.
  const dup = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: paylaterAvailable,
    payMethodLabel: "Gloobal PayLater",
    memo: "ob7 dup",
    name: "Creator",
    shareRatePercent: 10,
    time: "t"
  });
  assert.equal(dup.firstCompletion, false);
  assert.equal(payLaterEvents(core).filter((r) => r.payload.label === "ob7 retry").length, 1);
  assert.equal(essentialsEvents(core).filter((r) => r.payload.txnId === txnId).length, 1);
});

// ---------------------------------------------------------------------
// Also verify: timestamps, sequence numbers, lock, location.
// ---------------------------------------------------------------------
test("PAYLATER_DRAW_RECORDED and ESSENTIALS_GRANT_ADDED both carry the transaction's authoritative `now`, not an independently-generated timestamp", () => {
  const core = freshCore();
  const paylaterAvailable = seedPayLaterHeadroom(core, "TXN-OB-TS-SEED");
  const txnId = "TXN-OB-TS";
  const authoritativeNow = new Date("2026-07-01T12:00:00.000Z");
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: paylaterAvailable,
    payMethodLabel: "Gloobal PayLater",
    memo: "ts check",
    name: "Creator",
    shareRatePercent: 10,
    time: "t",
    now: authoritativeNow
  });
  assert.equal(result.ok, true);
  const paylaterEvent = payLaterEvents(core).find((r) => r.payload.label === "ts check");
  assert.equal(new Date(paylaterEvent.payload.drawnAt).getTime(), authoritativeNow.getTime());
  const essentialsEvent = essentialsEvents(core).find((r) => r.payload.txnId === txnId);
  assert.equal(new Date(essentialsEvent.payload.grantedAt).getTime(), authoritativeNow.getTime());
});

test("rolled-back PayLater/Essentials events never consume a committed sequence number", () => {
  const core = freshCore();
  const paylaterAvailable = seedPayLaterHeadroom(core, "TXN-OB-SEQ-SEED");
  const txnId = "TXN-OB-SEQ";
  const historyLengthBefore = core.eventBus.getHistory().length;

  withInjectedFailure(core.essentialsService, "addGrant", () => {
    core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId,
      amount: paylaterAvailable,
      payMethodLabel: "Gloobal PayLater",
      memo: "seq check",
      name: "Creator",
      shareRatePercent: 10,
      time: "t"
    });
  });
  // Only RISK_EVALUATED (pre-boundary, always live) + TRANSACTION_FAILED
  // actually got sequence numbers — the discarded LEDGER_ENTRY_POSTED,
  // PAYLATER_DRAW_RECORDED, and PROVENANCE_COMPLETED never consumed one.
  assert.equal(core.eventBus.getHistory().length, historyLengthBefore + 2);
  const lastSeqBeforeSuccess = core.eventBus.getHistory().at(-1).seq;

  const successTxnId = "TXN-OB-SEQ-SUCCESS";
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
  const newEvents = historyAfter.slice(-3);
  assert.deepEqual(newEvents.map((r) => r.eventName), [DomainEvent.RISK_EVALUATED, DomainEvent.LEDGER_ENTRY_POSTED, DomainEvent.PROVENANCE_COMPLETED]);
  assert.equal(newEvents[0].seq, lastSeqBeforeSuccess + 1, "no sequence numbers skipped or reserved for the rolled-back attempt's discarded events");
});

test("the transaction lock still protects a PayLater+Essentials transaction from re-entrant corruption", () => {
  const core = freshCore();
  const paylaterAvailable = seedPayLaterHeadroom(core, "TXN-OB-LOCK-SEED");
  let nestedResult = null;
  const original = core.orchestrator.completeTransaction.bind(core.orchestrator);
  core.orchestrator.completeTransaction = (...args) => {
    nestedResult = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId: "TXN-OB-LOCK-NESTED",
      amount: 10,
      payMethodLabel: null,
      memo: "nested",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    throw new Error("outer failure after nested attempt");
  };
  try {
    core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId: "TXN-OB-LOCK-OUTER",
      amount: paylaterAvailable,
      payMethodLabel: "Gloobal PayLater",
      memo: "outer",
      name: "Creator",
      shareRatePercent: 10,
      time: "t"
    });
  } finally {
    core.orchestrator.completeTransaction = original;
  }
  assert.ok(nestedResult);
  assert.equal(nestedResult.ok, false);
  assert.equal(nestedResult.code, "TRANSACTION_LOCKED");
});

test("location remains fully independent: a PayLater+Essentials transaction completes with no location supplied, and never fabricates one", () => {
  const core = freshCore();
  const paylaterAvailable = seedPayLaterHeadroom(core, "TXN-OB-LOC-SEED");
  const txnId = "TXN-OB-LOC";
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount: paylaterAvailable,
    payMethodLabel: "Gloobal PayLater",
    memo: "loc check",
    name: "Creator",
    shareRatePercent: 10,
    time: "t"
    // no senderGeo/receiverGeo supplied
  });
  assert.equal(result.ok, true);
  assert.equal(core.provenanceService.getLocationStatusForViewer(txnId, "sender"), LOCATION_STATUS.UNKNOWN);
  assert.equal(core.provenanceService.getLocationStatusForViewer(txnId, "receiver"), LOCATION_STATUS.UNKNOWN);
});
