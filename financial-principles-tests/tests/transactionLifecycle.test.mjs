import test from "node:test";
import assert from "node:assert/strict";
import {
  createFinancialCore,
  LocationObservation,
  LOCATION_STATUS,
  unknownObservation,
  DebitEntry,
  CreditEntry,
  Money
} from "../app_bundle_testonly.mjs";

function freshCore(opts = {}) {
  return createFinancialCore({ userId: "lifecycle-user", currency: "INR", openingBankBalance: 1000, ...opts });
}

function available(latitude, longitude, observedAt = new Date()) {
  return new LocationObservation({ status: LOCATION_STATUS.AVAILABLE, latitude, longitude, accuracy: 15, observedAt });
}

// ---------------------------------------------------------------------
// One canonical lifecycle for all three product flows
// ---------------------------------------------------------------------
test("executeTransaction is the one method Send Money, Scan & Pay, and Pay a Business all call — same shape, same guarantees, regardless of memo/payMethodLabel", () => {
  const core = freshCore();
  const sendMoney = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-SM",
    amount: 100,
    payMethodLabel: "Gloobal Bank",
    memo: "Send Money to Alex",
    name: "Alex",
    shareRatePercent: 2,
    time: "t"
  });
  const scanAndPay = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-SCAN",
    amount: 50,
    payMethodLabel: null,
    memo: "Scan & Pay",
    name: "Merchant Gloobal ID",
    shareRatePercent: 0,
    time: "t"
  });
  const payBusiness = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-BIZ",
    amount: 25,
    payMethodLabel: null,
    memo: "Pay Coffee Co",
    name: "Coffee Co",
    shareRatePercent: 5,
    time: "t"
  });
  for (const result of [sendMoney, scanAndPay, payBusiness]) {
    assert.equal(result.ok, true);
    assert.ok(result.ledgerRecordId, "every flow posts a real ledger record through the same code path");
    assert.ok(result.complaintWindowExpiresAt, "every flow opens a complaint window through the same code path");
    assert.equal(result.firstCompletion, true);
  }
  // Creator Share / cashback-eligible flows got a grant; the
  // zero-rate one (Scan & Pay) did not — same eligibility rule
  // applied uniformly, not flow-specific logic scattered in the UI.
  assert.ok(sendMoney.grant);
  assert.equal(scanAndPay.grant, null);
  assert.ok(payBusiness.grant);
});

test("there is no lower-risk posting path: Scan & Pay-shaped and Pay-Business-shaped calls are risk-checked exactly like Send Money", () => {
  const core = freshCore(); // opening balance 1000
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-OVERDRAW",
    amount: 5000, // far more than the 1000 opening balance
    payMethodLabel: null, // the Scan & Pay / Pay-a-Business shape
    memo: "Scan & Pay",
    name: "Merchant",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(result.ok, false);
  assert.equal(core.provenanceService.getCompletion("TXN-OVERDRAW"), null);
  assert.equal(core.essentialsService.listGrants().length, 0);
});

// ---------------------------------------------------------------------
// Atomicity: failure at each stage leaves nothing behind
// ---------------------------------------------------------------------
test("a failed risk evaluation posts nothing, completes nothing, opens no window, and grants nothing", () => {
  const core = freshCore();
  const before = {
    ledgerRecords: core.store.getAll().length,
    grants: core.essentialsService.listGrants().length,
    provenance: core.provenanceStore.getAll().length
  };
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-FAIL-RISK",
    amount: 999999,
    payMethodLabel: "Gloobal Bank",
    memo: "too much",
    name: "R",
    shareRatePercent: 10,
    time: "t"
  });
  assert.equal(result.ok, false);
  assert.equal(core.store.getAll().length, before.ledgerRecords, "no ledger entry posted on a failed risk check");
  assert.equal(core.essentialsService.listGrants().length, before.grants, "no grant on a failed risk check");
  assert.equal(core.provenanceStore.getAll().length, before.provenance, "no provenance record on a failed risk check");
  assert.equal(core.provenanceService.getComplaintWindow("TXN-FAIL-RISK"), null, "no complaint window on a failed risk check");
});

test("an invalid amount fails before any side effect, same as an insufficient balance", () => {
  const core = freshCore();
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-INVALID-AMOUNT",
    amount: -5,
    payMethodLabel: null,
    memo: "bad amount",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(result.ok, false);
  assert.equal(core.provenanceService.getCompletion("TXN-INVALID-AMOUNT"), null);
});

test("a transaction that fails risk evaluation can be retried with the SAME txnId once conditions change, and succeeds normally", () => {
  const core = freshCore({ openingBankBalance: 10 });
  const failed = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-RETRY-AFTER-FAIL",
    amount: 100,
    payMethodLabel: null,
    memo: "over balance",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(failed.ok, false);
  assert.equal(core.provenanceService.getCompletion("TXN-RETRY-AFTER-FAIL"), null, "the failed attempt left nothing behind to retry against");
  // Top up via the same reserve-funded pattern every other credit in
  // this system uses, then retry the exact same txnId — a failed
  // attempt must never have poisoned the txnId against a legitimate
  // later success.
  core.ledgerEngine.postJournalEntry({
    memo: "top up",
    lines: [
      DebitEntry(core.userAccounts.bank.id, Money.of(1000, "INR")),
      CreditEntry(core.registry.reserve.id, Money.of(1000, "INR"))
    ]
  });
  const retried = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-RETRY-AFTER-FAIL",
    amount: 100,
    payMethodLabel: null,
    memo: "retry",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(retried.ok, true);
  assert.equal(retried.firstCompletion, true);
});

// ---------------------------------------------------------------------
// Duplicate requests — both idempotency layers
// ---------------------------------------------------------------------
test("a duplicated request with the same clientRequestId never posts or completes twice", () => {
  const core = freshCore();
  const requestId = "req-exec-1";
  const first = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DUP-REQ",
    amount: 100,
    payMethodLabel: null,
    memo: "dup",
    name: "R",
    shareRatePercent: 5,
    time: "t",
    clientRequestId: requestId
  });
  const second = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DUP-REQ",
    amount: 100,
    payMethodLabel: null,
    memo: "dup",
    name: "R",
    shareRatePercent: 5,
    time: "t",
    clientRequestId: requestId
  });
  assert.deepEqual(second, first, "identical clientRequestId returns the exact original result");
  assert.equal(core.essentialsService.listGrants().length, 1);
  assert.equal(core.store.getAll().filter((r) => r.journalEntry.memo === "dup").length, 1, "only one ledger entry posted");
});

test("a duplicated request for the SAME txnId but a DIFFERENT (or missing) clientRequestId still never double-posts — the txnId backstop, not just the request-id guard", () => {
  const core = freshCore();
  const first = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DUP-TXNID",
    amount: 100,
    payMethodLabel: null,
    memo: "first attempt",
    name: "R",
    shareRatePercent: 5,
    time: "t",
    clientRequestId: "req-A"
  });
  // A retry with a different clientRequestId (e.g. a fresh request-id
  // generated on a client-side retry) is exactly the scenario the
  // per-txnId backstop exists for.
  const second = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DUP-TXNID",
    amount: 100,
    payMethodLabel: null,
    memo: "retry with new request id",
    name: "R",
    shareRatePercent: 5,
    time: "t",
    clientRequestId: "req-B"
  });
  assert.equal(first.firstCompletion, true);
  assert.equal(second.firstCompletion, false);
  assert.equal(second.ledgerRecordId, first.ledgerRecordId, "the retry reports the ORIGINAL ledger record, not a new one");
  assert.equal(second.grant, null, "no second grant on the backstop-caught retry");
  assert.equal(core.essentialsService.listGrants().length, 1);
  assert.equal(core.store.getAll().filter((r) => r.journalEntry.memo === "first attempt").length, 1);
  assert.equal(core.store.getAll().filter((r) => r.journalEntry.memo === "retry with new request id").length, 0, "the retry's own memo never makes it to the ledger — no second post happened at all");
});

test("a duplicated request with no clientRequestId at all is still caught by the txnId backstop", () => {
  const core = freshCore();
  const first = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-NO-REQ-ID",
    amount: 40,
    payMethodLabel: null,
    memo: "no id 1",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  const second = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-NO-REQ-ID",
    amount: 40,
    payMethodLabel: null,
    memo: "no id 2",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(first.firstCompletion, true);
  assert.equal(second.firstCompletion, false);
  assert.equal(core.store.getAll().filter((r) => r.journalEntry.memo === "no id 2").length, 0);
});

test("executeTransaction requires a txnId", () => {
  const core = freshCore();
  assert.throws(() => core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    amount: 10,
    payMethodLabel: null,
    memo: "no txn id",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  }));
});

// ---------------------------------------------------------------------
// Location must never gate financial validity
// ---------------------------------------------------------------------
test("omitting senderGeo/receiverGeo entirely still completes the transaction fully — location is not a required input", () => {
  const core = freshCore();
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-NO-GEO",
    amount: 20,
    payMethodLabel: null,
    memo: "no geo supplied",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(result.ok, true);
  assert.equal(core.provenanceService.getLocationStatusForViewer("TXN-NO-GEO", "sender"), LOCATION_STATUS.UNKNOWN);
  assert.equal(core.provenanceService.getLocationStatusForViewer("TXN-NO-GEO", "receiver"), LOCATION_STATUS.UNKNOWN);
});

test("a DENIED sender location still completes the transaction exactly like an AVAILABLE one — status never affects ok/grant/window", () => {
  const core = freshCore();
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DENIED-STILL-OK",
    amount: 20,
    payMethodLabel: null,
    memo: "denied geo",
    name: "R",
    shareRatePercent: 5,
    senderGeo: new LocationObservation({ status: LOCATION_STATUS.DENIED }),
    receiverGeo: unknownObservation(),
    time: "t"
  });
  assert.equal(result.ok, true);
  assert.ok(result.grant);
  assert.ok(result.complaintWindowExpiresAt);
});

// ---------------------------------------------------------------------
// Sender/receiver location arriving independently — the real
// receiver-side (and sender-side) location-observation interface
// ---------------------------------------------------------------------
test("a receiver device can submit its own location BEFORE the transaction has completed", () => {
  const core = freshCore();
  const submission = core.provenanceService.submitLocationObservation({
    txnId: "TXN-RECEIVER-EARLY",
    role: "receiver",
    observation: available(40.7128, -74.006) // New York
  });
  assert.equal(submission.ok, true);
  assert.equal(submission.status, LOCATION_STATUS.AVAILABLE);
  // No completion exists yet for this txnId at all.
  assert.equal(core.provenanceService.getCompletion("TXN-RECEIVER-EARLY"), null);
  // Yet the submitted observation is already readable.
  const receiverView = core.provenanceService.getLocationForViewer("TXN-RECEIVER-EARLY", "receiver");
  assert.equal(receiverView.city, "New York");
});

test("completion later picks up nothing automatically from an early submission's snapshot, but the CURRENT view still reflects the submission — snapshot and live view are independent by design", () => {
  const core = freshCore();
  core.provenanceService.submitLocationObservation({
    txnId: "TXN-RECEIVER-EARLY-2",
    role: "receiver",
    observation: available(1.3521, 103.8198) // Singapore
  });
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-RECEIVER-EARLY-2",
    amount: 10,
    payMethodLabel: null,
    memo: "t",
    name: "R",
    shareRatePercent: 0,
    // The transaction itself never learned about the receiver's
    // location — this is the normal, expected shape: executeTransaction
    // doesn't need to know about independently-submitted observations.
    receiverGeo: unknownObservation(),
    time: "t"
  });
  // The completion's own baseline snapshot is UNKNOWN (what was passed
  // in), but the CURRENT/derived view still correctly shows Singapore,
  // because the submission is looked up independently of the snapshot.
  const completion = core.provenanceService.getCompletion("TXN-RECEIVER-EARLY-2");
  assert.equal(completion.payload.receiverGeo.status, LOCATION_STATUS.UNKNOWN);
  const currentView = core.provenanceService.getLocationForViewer("TXN-RECEIVER-EARLY-2", "receiver");
  assert.equal(currentView.city, "Singapore");
});

test("sender and receiver locations can arrive independently, in either order, without clobbering each other", () => {
  const core = freshCore();
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-INDEPENDENT-ARRIVAL",
    amount: 10,
    payMethodLabel: null,
    memo: "t",
    name: "R",
    shareRatePercent: 0,
    time: "t"
    // No geo supplied at completion time at all — both start UNKNOWN.
  });
  assert.equal(core.provenanceService.getLocationStatusForViewer("TXN-INDEPENDENT-ARRIVAL", "sender"), LOCATION_STATUS.UNKNOWN);
  assert.equal(core.provenanceService.getLocationStatusForViewer("TXN-INDEPENDENT-ARRIVAL", "receiver"), LOCATION_STATUS.UNKNOWN);

  // Receiver reports first...
  core.provenanceService.submitLocationObservation({ txnId: "TXN-INDEPENDENT-ARRIVAL", role: "receiver", observation: available(51.5074, -0.1278) }); // London
  assert.equal(core.provenanceService.getLocationForViewer("TXN-INDEPENDENT-ARRIVAL", "receiver").city, "London");
  assert.equal(core.provenanceService.getLocationStatusForViewer("TXN-INDEPENDENT-ARRIVAL", "sender"), LOCATION_STATUS.UNKNOWN, "sender is untouched by the receiver's submission");

  // ...sender reports much later.
  core.provenanceService.submitLocationObservation({ txnId: "TXN-INDEPENDENT-ARRIVAL", role: "sender", observation: available(35.6762, 139.6503) }); // Tokyo
  assert.equal(core.provenanceService.getLocationForViewer("TXN-INDEPENDENT-ARRIVAL", "sender").city, "Tokyo");
  assert.equal(core.provenanceService.getLocationForViewer("TXN-INDEPENDENT-ARRIVAL", "receiver").city, "London", "receiver's earlier submission is untouched by the sender's");
});

test("a role can submit more than once; the latest submission wins", () => {
  const core = freshCore();
  core.provenanceService.submitLocationObservation({ txnId: "TXN-REPEATED-SUBMIT", role: "receiver", observation: available(12.9716, 77.5946) }); // Bengaluru
  assert.equal(core.provenanceService.getLocationForViewer("TXN-REPEATED-SUBMIT", "receiver").city, "Bengaluru");
  core.provenanceService.submitLocationObservation({ txnId: "TXN-REPEATED-SUBMIT", role: "receiver", observation: available(28.6139, 77.209) }); // Delhi — improved fix
  assert.equal(core.provenanceService.getLocationForViewer("TXN-REPEATED-SUBMIT", "receiver").city, "Delhi");
});

test("submitLocationObservation rejects an invalid role rather than guessing which party it means", () => {
  const core = freshCore();
  const result = core.provenanceService.submitLocationObservation({ txnId: "TXN-BAD-ROLE", role: "auditor", observation: available(1, 1) });
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_ROLE");
});

test("submitLocationObservation requires a txnId", () => {
  const core = freshCore();
  const result = core.provenanceService.submitLocationObservation({ role: "receiver", observation: available(1, 1) });
  assert.equal(result.ok, false);
  assert.equal(result.code, "MISSING_TXN_ID");
});

test("submitLocationObservation never fabricates: a raw non-LocationObservation input becomes UNKNOWN, never invented coordinates", () => {
  const core = freshCore();
  core.provenanceService.submitLocationObservation({ txnId: "TXN-NO-FABRICATE", role: "receiver", observation: { latitude: 12.9716, longitude: 77.5946 } });
  assert.equal(core.provenanceService.getLocationForViewer("TXN-NO-FABRICATE", "receiver"), null);
  assert.equal(core.provenanceService.getLocationStatusForViewer("TXN-NO-FABRICATE", "receiver"), LOCATION_STATUS.UNKNOWN);
});

test("a duplicated location submission with the same clientRequestId is deduplicated, not appended twice", () => {
  const core = freshCore();
  const requestId = "req-loc-1";
  core.provenanceService.submitLocationObservation({ txnId: "TXN-DUP-LOC", role: "receiver", observation: available(1, 1), clientRequestId: requestId });
  core.provenanceService.submitLocationObservation({ txnId: "TXN-DUP-LOC", role: "receiver", observation: available(1, 1), clientRequestId: requestId });
  const submissions = core.provenanceStore.getAll().filter((r) => r.txnId === "TXN-DUP-LOC" && r.kind === "location:receiver");
  assert.equal(submissions.length, 1);
});

test("location submissions never affect the complaint window or its expiry", () => {
  const core = freshCore();
  const now = new Date("2026-01-01T00:00:00Z");
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-WINDOW-UNAFFECTED",
    amount: 10,
    payMethodLabel: null,
    memo: "t",
    name: "R",
    shareRatePercent: 0,
    time: "t",
    now
  });
  const windowBefore = core.provenanceService.getComplaintWindow("TXN-WINDOW-UNAFFECTED");
  core.provenanceService.submitLocationObservation({ txnId: "TXN-WINDOW-UNAFFECTED", role: "sender", observation: available(1, 1) });
  core.provenanceService.submitLocationObservation({ txnId: "TXN-WINDOW-UNAFFECTED", role: "receiver", observation: available(2, 2) });
  const windowAfter = core.provenanceService.getComplaintWindow("TXN-WINDOW-UNAFFECTED");
  assert.deepEqual(windowAfter, windowBefore);
});

test("the provenance chain (including location submissions) stays tamper-evident", () => {
  const core = freshCore();
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-CHAIN-WITH-LOC",
    amount: 10,
    payMethodLabel: null,
    memo: "t",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  core.provenanceService.submitLocationObservation({ txnId: "TXN-CHAIN-WITH-LOC", role: "sender", observation: available(1, 1) });
  core.provenanceService.submitLocationObservation({ txnId: "TXN-CHAIN-WITH-LOC", role: "receiver", observation: available(2, 2) });
  assert.equal(core.provenanceStore.verifyChain(), true);
});
