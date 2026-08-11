import test from "node:test";
import assert from "node:assert/strict";
import { createFinancialCore, DomainEvent } from "../app_bundle_testonly.mjs";

function freshCore(opts = {}) {
  return createFinancialCore({ userId: "essentials-pool-user", currency: "INR", openingBankBalance: 10, ...opts });
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

// ---------------------------------------------------------------------
// Basic mechanics: subsidize up to the daily limit, real ledger money.
// ---------------------------------------------------------------------
test("a subsidy tops up the user's real bank balance from the platform reserve — a real, ledger-conserving transfer", () => {
  const core = freshCore({ openingBankBalance: 100 });
  const reserveBefore = core.ledgerEngine.getAccountBalance(core.registry.reserve.id, "INR").amount;
  const bankBefore = core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount;

  const result = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 30, dailyLimit: 50 });
  assert.equal(result.subsidyAmount, 30);
  assert.ok(result.ledgerRecordId);

  const bankAfter = core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount;
  const reserveAfter = core.ledgerEngine.getAccountBalance(core.registry.reserve.id, "INR").amount;
  assert.equal(bankAfter, bankBefore + 30);
  // Reserve is a LIABILITY (credit-normal) — crediting it to fund a
  // real payout increases its balance, same convention Opening
  // Balance and every other reserve-funded credit in this app uses.
  assert.equal(reserveAfter, reserveBefore + 30);
});

test("a request larger than the daily limit is capped — only the limit is ever applied", () => {
  const core = freshCore();
  const result = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 1000, dailyLimit: 50 });
  assert.equal(result.subsidyAmount, 50);
  assert.equal(core.essentialsPoolService.remainingToday(50), 0);
});

test("the pool depletes across multiple requests within the same day, capped at the limit total", () => {
  const core = freshCore();
  const r1 = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 30, dailyLimit: 50 });
  assert.equal(r1.subsidyAmount, 30);
  assert.equal(core.essentialsPoolService.remainingToday(50), 20);

  const r2 = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 40, dailyLimit: 50 });
  assert.equal(r2.subsidyAmount, 20, "capped at what was actually left, not the full request");
  assert.equal(core.essentialsPoolService.remainingToday(50), 0);

  const r3 = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 10, dailyLimit: 50 });
  assert.equal(r3.subsidyAmount, 0, "exhausted for today");
  assert.equal(r3.ledgerRecordId, null, "no ledger entry at all for a zero-amount subsidy");
});

test("the pool resets on a new calendar day — no manual reset action, just measured against the current date", () => {
  const core = freshCore();
  core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 50, dailyLimit: 50 });
  assert.equal(core.essentialsPoolService.remainingToday(50), 0);

  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  assert.equal(core.essentialsPoolService.remainingToday(50, tomorrow), 50, "full limit again, nothing carried over from yesterday's unused/used amount");

  const tomorrowResult = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 20, dailyLimit: 50, now: tomorrow });
  assert.equal(tomorrowResult.subsidyAmount, 20, "a real new subsidy succeeds on the new day");
});

test("zero or negative requested amount, or zero daily limit, apply nothing", () => {
  const core = freshCore();
  assert.equal(core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 0, dailyLimit: 50 }).subsidyAmount, 0);
  assert.equal(core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: -5, dailyLimit: 50 }).subsidyAmount, 0);
  assert.equal(core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 10, dailyLimit: 0 }).subsidyAmount, 0);
});

// ---------------------------------------------------------------------
// End-to-end: the subsidy genuinely enables a payment that would
// otherwise fail on insufficient balance.
// ---------------------------------------------------------------------
test("applying the subsidy before a payment makes an otherwise-unaffordable Scan & Pay succeed", () => {
  const core = freshCore({ openingBankBalance: 5 });
  const failedWithoutSubsidy = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-NO-SUBSIDY",
    amount: 20,
    payMethodLabel: null,
    memo: "would fail",
    name: "Merchant",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(failedWithoutSubsidy.ok, false, "sanity check: 20 > 5 bank balance really does fail on its own");

  const core2 = freshCore({ openingBankBalance: 5 });
  const subsidy = core2.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core2.userAccounts, requestedAmount: 20, dailyLimit: 50 });
  assert.equal(subsidy.subsidyAmount, 20);
  const paid = core2.orchestrator.executeTransaction({
    userAccounts: core2.userAccounts,
    txnId: "TXN-WITH-SUBSIDY",
    amount: 20,
    payMethodLabel: null,
    memo: "Scan & Pay",
    name: "Merchant",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(paid.ok, true, "the same payment now succeeds, funded by the subsidized bank balance");
  assert.equal(core2.ledgerEngine.getAccountBalance(core2.userAccounts.bank.id, "INR").amount, 5, "5 opening + 20 subsidy - 20 payment = 5");
});

// ---------------------------------------------------------------------
// Separation from Creator Share / PayLater — this is a genuinely
// different mechanism and must never interact with either.
// ---------------------------------------------------------------------
test("applying the pool subsidy never creates an Essentials (Creator Share) grant or touches PayLater due", () => {
  const core = freshCore();
  const grantsBefore = core.essentialsService.listGrants().length;
  const dueBefore = core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue;

  core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 30, dailyLimit: 50 });

  assert.equal(core.essentialsService.listGrants().length, grantsBefore, "no Creator Share grant from a pool subsidy");
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, dueBefore, "PayLater due is completely untouched");
});

test("a Creator Share grant and its PayLater auto-settlement still work exactly as before — unaffected by the pool existing", () => {
  const core = freshCore({ openingBankBalance: 1000 });
  const seed = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-SEED",
    amount: 200,
    payMethodLabel: null,
    memo: "seed",
    name: "Creator",
    shareRatePercent: 100,
    time: "t"
  });
  assert.equal(seed.ok, true);
  core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-DRAW",
    amount: 100,
    payMethodLabel: "Gloobal PayLater",
    memo: "draw 100",
    name: "R",
    shareRatePercent: 0,
    time: "t"
  });
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 100);

  const earn = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-EARN",
    amount: 100,
    payMethodLabel: null,
    memo: "earn",
    name: "Creator2",
    shareRatePercent: 100,
    time: "t"
  });
  assert.equal(earn.ok, true);
  assert.equal(earn.paylaterAutoSettlement.amount, 100, "PayLater auto-settlement still works exactly as built last pass");
  assert.equal(core.payLaterService.computeAvailable("INR", core.userAccounts).paylaterDue, 0);
});

// ---------------------------------------------------------------------
// Events: staged and published exactly once, never live mid-call.
// ---------------------------------------------------------------------
test("a successful subsidy publishes ESSENTIALS_POOL_APPLIED exactly once, with the correct amounts", () => {
  const core = freshCore();
  const historyBefore = core.eventBus.getHistory({ eventName: DomainEvent.ESSENTIALS_POOL_APPLIED }).length;
  core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 30, dailyLimit: 50 });
  const events = core.eventBus.getHistory({ eventName: DomainEvent.ESSENTIALS_POOL_APPLIED });
  assert.equal(events.length, historyBefore + 1);
  const payload = events.at(-1).payload;
  assert.equal(payload.amount, 30);
  assert.equal(payload.dailyLimit, 50);
  assert.equal(payload.usedToday, 30);
  assert.equal(payload.remainingToday, 20);
});

test("a zero-amount subsidy attempt (pool already exhausted) publishes no event at all", () => {
  const core = freshCore();
  core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 50, dailyLimit: 50 });
  const before = core.eventBus.getHistory({ eventName: DomainEvent.ESSENTIALS_POOL_APPLIED }).length;
  core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 10, dailyLimit: 50 });
  const after = core.eventBus.getHistory({ eventName: DomainEvent.ESSENTIALS_POOL_APPLIED }).length;
  assert.equal(after, before, "no event for a subsidy that applied nothing");
});

test("event timestamp matches the authoritative `now` passed to the subsidy call", () => {
  const core = freshCore();
  const authoritativeNow = new Date("2026-04-01T08:00:00.000Z");
  core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 10, dailyLimit: 50, now: authoritativeNow });
  const event = core.eventBus.getHistory({ eventName: DomainEvent.ESSENTIALS_POOL_APPLIED }).at(-1);
  assert.equal(new Date(event.payload.appliedAt).getTime(), authoritativeNow.getTime());
  const ledgerRecord = core.store.getAll().find((r) => r.journalEntry.memo === "My Essentials daily pool");
  assert.equal(ledgerRecord.postedAt.getTime(), authoritativeNow.getTime());
});

// ---------------------------------------------------------------------
// Atomicity: rollback discards the subsidy and its event together.
// ---------------------------------------------------------------------
test("if the ledger post fails mid-subsidy, the pool's own usage counter rolls back too — not just the ledger", () => {
  const core = freshCore();
  const before = {
    bank: core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount,
    ledgerCount: core.store.getAll().length,
    remaining: core.essentialsPoolService.remainingToday(50)
  };
  withInjectedFailure(core.ledgerEngine, "postJournalEntry", () => {
    const result = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 30, dailyLimit: 50 });
    assert.equal(result.subsidyAmount, 0);
    assert.equal(result.code, "TRANSACTION_ROLLED_BACK");
  });
  assert.equal(core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount, before.bank);
  assert.equal(core.store.getAll().length, before.ledgerCount);
  assert.equal(core.essentialsPoolService.remainingToday(50), before.remaining, "usage counter itself rolled back, not just the ledger");
});

test("a failed subsidy publishes no ESSENTIALS_POOL_APPLIED event, only TRANSACTION_FAILED", () => {
  const core = freshCore();
  withInjectedFailure(core.ledgerEngine, "postJournalEntry", () => {
    core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 30, dailyLimit: 50 });
  });
  assert.equal(core.eventBus.getHistory({ eventName: DomainEvent.ESSENTIALS_POOL_APPLIED }).length, 0);
  assert.equal(core.eventBus.getHistory({ eventName: DomainEvent.TRANSACTION_FAILED }).length, 1);
});

// ---------------------------------------------------------------------
// Re-entrancy: the subsidy shares the same lock as executeTransaction.
// ---------------------------------------------------------------------
test("the subsidy call cannot run re-entrantly while a real transaction is mid-flight, and vice versa", () => {
  const core = freshCore({ openingBankBalance: 1000 });
  let nestedSubsidyResult = null;
  const original = core.orchestrator.completeTransaction.bind(core.orchestrator);
  core.orchestrator.completeTransaction = (...args) => {
    nestedSubsidyResult = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 10, dailyLimit: 50 });
    return original(...args);
  };
  try {
    const result = core.orchestrator.executeTransaction({
      userAccounts: core.userAccounts,
      txnId: "TXN-LOCK-CHECK",
      amount: 20,
      payMethodLabel: null,
      memo: "m",
      name: "R",
      shareRatePercent: 0,
      time: "t"
    });
    assert.equal(result.ok, true, "the outer transaction still completes normally");
  } finally {
    core.orchestrator.completeTransaction = original;
  }
  assert.ok(nestedSubsidyResult);
  assert.equal(nestedSubsidyResult.subsidyAmount, 0);
  assert.equal(nestedSubsidyResult.code, "TRANSACTION_LOCKED");
  // And the lock releases properly afterward — a real subsidy call now succeeds.
  const after = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 10, dailyLimit: 50 });
  assert.equal(after.subsidyAmount, 10);
});

// ---------------------------------------------------------------------
// Conservation: the subsidy is a real transfer, never fabricated money
// that appears from nowhere or disappears.
// ---------------------------------------------------------------------
test("the subsidy's effect on bank and reserve are exact mirror images — pure conservation, nothing created or destroyed", () => {
  const core = freshCore({ openingBankBalance: 1000 });
  const bankBefore = core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount;
  const reserveBefore = core.ledgerEngine.getAccountBalance(core.registry.reserve.id, "INR").amount;
  const result = core.orchestrator.applyEssentialsPoolSubsidy({ userAccounts: core.userAccounts, requestedAmount: 42, dailyLimit: 50 });
  const bankAfter = core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, "INR").amount;
  const reserveAfter = core.ledgerEngine.getAccountBalance(core.registry.reserve.id, "INR").amount;
  assert.equal(bankAfter - bankBefore, result.subsidyAmount);
  assert.equal(reserveAfter - reserveBefore, result.subsidyAmount);
});
