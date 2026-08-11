import test from "node:test";
import assert from "node:assert/strict";
import { createFinancialCore } from "../app_bundle_testonly.mjs";

function freshCore(opts = {}) {
  return createFinancialCore({ userId: "paylater-priority-user", currency: "INR", openingBankBalance: 1000, ...opts });
}

// Seeds Essentials value (a Creator Share grant) via a real,
// already-committed transaction, so there's PayLater headroom to draw
// against.
function seed(core, txnId, amount, sharePercent) {
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId,
    amount,
    payMethodLabel: null,
    memo: "seed",
    name: "Creator",
    shareRatePercent: sharePercent,
    time: "t"
  });
  assert.equal(result.ok, true, "seed transaction must succeed");
  return result;
}

test("the exact worked example: owe 100, pay back 50 manually (50 due left), then a new 100 Creator Share grant settles the remaining 50 first, leaving 50 free", () => {
  const core = freshCore();
  seed(core, "TXN-SEED", 200, 100); // 200 of Essentials value, all as PayLater headroom
  const draw = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DRAW-100",
    amount: 100,
    payMethodLabel: "Gloobal PayLater",
    memo: "draw 100",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(draw.ok, true);
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 100);

  // "I pay 50" — a manual partial settlement of the due.
  const manual = core.settlementEngine.settleEssentialsToPayLater({ userAccounts: core.userAccounts, amount: 50, currency: "INR" });
  assert.equal(manual.ok, true);
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 50, "50 left, exactly as in the worked example");

  // "Next payment I make and get 100 as creator share" — the new
  // grant must settle the remaining 50 due FIRST.
  const earn = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-EARN-100",
    amount: 100,
    payMethodLabel: null,
    memo: "earn 100",
    name: "Creator2",
    shareRatePercent: 100,
    time: "t"
  });
  assert.equal(earn.ok, true);
  assert.ok(earn.paylaterAutoSettlement, "the auto-settlement must have happened");
  assert.equal(earn.paylaterAutoSettlement.amount, 50, "exactly the remaining due, not the whole new grant");
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 0, "due is now fully cleared");
});

test("a new grant larger than the outstanding due settles only the due, not more", () => {
  const core = freshCore();
  seed(core, "TXN-SEED", 200, 100);
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DRAW-30",
    amount: 30,
    payMethodLabel: "Gloobal PayLater",
    memo: "draw 30",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 30);

  const earn = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-EARN-100B",
    amount: 100,
    payMethodLabel: null,
    memo: "earn 100",
    name: "Creator2",
    shareRatePercent: 100,
    time: "t"
  });
  assert.equal(earn.ok, true);
  assert.equal(earn.paylaterAutoSettlement.amount, 30, "capped at the due, never over-settling");
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 0);
});

test("a new grant smaller than the outstanding due settles only what it can, and due remains partially outstanding", () => {
  const core = freshCore();
  seed(core, "TXN-SEED", 200, 100);
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DRAW-150",
    amount: 150,
    payMethodLabel: "Gloobal PayLater",
    memo: "draw 150",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 150);

  const earn = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-EARN-40",
    amount: 40,
    payMethodLabel: null,
    memo: "earn 40",
    name: "Creator2",
    shareRatePercent: 100,
    time: "t"
  });
  assert.equal(earn.ok, true);
  assert.equal(earn.paylaterAutoSettlement.amount, 40, "the whole small grant goes to the due");
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 110, "150 - 40 = 110 still outstanding");
});

test("no outstanding due at all -> no auto-settlement happens, the grant is fully free", () => {
  const core = freshCore();
  const earn = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-EARN-NO-DUE",
    amount: 60,
    payMethodLabel: null,
    memo: "earn, no due",
    name: "Creator",
    shareRatePercent: 100,
    time: "t"
  });
  assert.equal(earn.ok, true);
  assert.equal(earn.paylaterAutoSettlement, null);
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 0);
});

test("a transaction with no Creator Share (shareRatePercent 0) never triggers an auto-settlement even with outstanding due", () => {
  const core = freshCore();
  seed(core, "TXN-SEED", 200, 100);
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DRAW-20",
    amount: 20,
    payMethodLabel: "Gloobal PayLater",
    memo: "draw 20",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 20);

  const plain = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-PLAIN",
    amount: 15,
    payMethodLabel: null,
    memo: "plain send, no share",
    name: "R2",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(plain.ok, true);
  assert.equal(plain.grant, null);
  assert.equal(plain.paylaterAutoSettlement, null);
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 20, "untouched");
});

// ---------------------------------------------------------------------
// Conservation: the auto-settlement is a pure transfer between the
// user's own accounts, never creates or destroys money.
// ---------------------------------------------------------------------
test("the auto-settlement's effect on each account is exactly what a pure transfer should produce — essentials nets grant-minus-settled, paylaterPayable drops by exactly the settled amount", () => {
  const core = freshCore();
  seed(core, "TXN-SEED", 200, 100);
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DRAW-60",
    amount: 60,
    payMethodLabel: "Gloobal PayLater",
    memo: "draw 60",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });

  const essentialsBefore = core.ledgerEngine.getAccountBalance(core.userAccounts.essentials.id, "INR").amount;
  const dueBefore = core.ledgerEngine.getAccountBalance(core.userAccounts.paylaterPayable.id, "INR").amount;

  const earn = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-EARN-CONSERVE",
    amount: 100,
    payMethodLabel: null,
    memo: "earn, check conservation",
    name: "Creator2",
    shareRatePercent: 100,
    time: "t"
  });
  assert.equal(earn.ok, true);
  assert.ok(earn.paylaterAutoSettlement);
  const grantValue = earn.grant.accruedValue(0); // monthsAccrued 0, so growth factor is 1
  const settledAmount = earn.paylaterAutoSettlement.amount;

  const essentialsAfter = core.ledgerEngine.getAccountBalance(core.userAccounts.essentials.id, "INR").amount;
  const dueAfter = core.ledgerEngine.getAccountBalance(core.userAccounts.paylaterPayable.id, "INR").amount;

  // Essentials receives the full grant, then immediately gives up
  // exactly the settled amount — net change is the difference, not
  // the raw grant value (money didn't vanish, it moved on to pay the
  // liability down).
  assert.ok(Math.abs((essentialsAfter - essentialsBefore) - (grantValue - settledAmount)) < 1e-9);
  // The liability drops by exactly what was transferred in — nothing
  // more, nothing less.
  assert.ok(Math.abs((dueBefore - dueAfter) - settledAmount) < 1e-9);
});

// ---------------------------------------------------------------------
// Atomicity: auto-settlement is part of the same transaction and
// rolls back with everything else if a later stage fails.
// ---------------------------------------------------------------------
test("if a later stage fails after the auto-settlement already happened, the settlement itself rolls back too", () => {
  const core = freshCore();
  seed(core, "TXN-SEED", 200, 100);
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DRAW-70",
    amount: 70,
    payMethodLabel: "Gloobal PayLater",
    memo: "draw 70",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  const dueBeforeAttempt = core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue;
  assert.equal(dueBeforeAttempt, 70);

  // completeTransaction is where the grant + auto-settlement both
  // happen; wrap it so its REAL work runs (grant posts, auto-settle
  // posts) and only then throw — simulating a later stage failing
  // after the settlement's own work genuinely completed.
  const original = core.orchestrator.completeTransaction.bind(core.orchestrator);
  core.orchestrator.completeTransaction = (...args) => {
    original(...args);
    throw new Error("later stage fails after auto-settlement really ran");
  };
  let result;
  try {
    result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId: "TXN-EARN-ROLLBACK",
      amount: 100,
      payMethodLabel: null,
      memo: "earn, will roll back",
      name: "Creator2",
      shareRatePercent: 100,
      time: "t"
    });
  } finally {
    core.orchestrator.completeTransaction = original;
  }
  assert.equal(result.ok, false);
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, dueBeforeAttempt, "the due is back to exactly what it was — the auto-settlement rolled back along with the grant");
  assert.equal(core.essentialsService.listGrants().filter((g) => g.txnId === "TXN-EARN-ROLLBACK").length, 0);
});
