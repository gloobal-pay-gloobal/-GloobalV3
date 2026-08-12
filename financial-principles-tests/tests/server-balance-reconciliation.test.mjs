import test from "node:test";
import assert from "node:assert/strict";
import { createFinancialCore } from "../app_bundle_testonly.mjs";

// The dashboard balance is the account's real server balance, brought into
// the local ledger by reconcileBankBalance. It matters that this is a
// posting and not an assignment: the balance is derived from entries, the
// risk check inside executeTransaction reads that same derived figure, and
// a ledger that does not balance is worse than a wrong number.

const bankBalance = (core) => core.ledgerEngine.getAccountBalance(core.userAccounts.bank.id, core.currency).amount;

// Every entry in the store must have equal debits and credits, or the
// reconciliation has punched a hole in the books.
function assertBooksBalance(core) {
  for (const record of core.store.getAll()) {
    const lines = record.entry?.lines ?? record.lines ?? [];
    let debits = 0;
    let credits = 0;
    for (const line of lines) {
      const amount = Number(line.amount?.amount ?? line.amount ?? 0);
      if (line.direction === "debit" || line.type === "debit") debits += amount;
      else credits += amount;
    }
    assert.equal(
      Number(debits.toFixed(2)),
      Number(credits.toFixed(2)),
      `entry "${record.entry?.memo ?? record.memo}" does not balance`
    );
  }
}

test("reconciling upward moves the bank balance to the server's figure", () => {
  const core = createFinancialCore({ openingBankBalance: 5000, logLevel: "silent" });
  const delta = core.reconcileBankBalance(9000);
  assert.equal(delta, 4000);
  assert.equal(bankBalance(core), 9000);
  assertBooksBalance(core);
});

test("reconciling downward moves the bank balance to the server's figure", () => {
  const core = createFinancialCore({ openingBankBalance: 5000, logLevel: "silent" });
  const delta = core.reconcileBankBalance(1234.56);
  assert.equal(delta, -3765.44);
  assert.equal(bankBalance(core), 1234.56);
  assertBooksBalance(core);
});

test("reconciling to zero is allowed — an empty account is a real state", () => {
  const core = createFinancialCore({ openingBankBalance: 5000, logLevel: "silent" });
  core.reconcileBankBalance(0);
  assert.equal(bankBalance(core), 0);
  assertBooksBalance(core);
});

test("reconciling when already in sync posts nothing", () => {
  const core = createFinancialCore({ openingBankBalance: 5000, logLevel: "silent" });
  const before = core.store.getAll().length;
  assert.equal(core.reconcileBankBalance(5000), 0);
  assert.equal(core.store.getAll().length, before);
  assert.equal(bankBalance(core), 5000);
});

test("repeated reconciliation is idempotent — it converges, it does not accumulate", () => {
  const core = createFinancialCore({ openingBankBalance: 5000, logLevel: "silent" });
  core.reconcileBankBalance(2500);
  const afterFirst = core.store.getAll().length;
  core.reconcileBankBalance(2500);
  core.reconcileBankBalance(2500);
  assert.equal(bankBalance(core), 2500);
  assert.equal(core.store.getAll().length, afterFirst, "a no-op reconcile must not post an entry");
});

test("a nonsense server balance is ignored rather than corrupting the ledger", () => {
  const core = createFinancialCore({ openingBankBalance: 5000, logLevel: "silent" });
  for (const bad of [undefined, null, NaN, Infinity, -1, "abc", {}]) {
    assert.equal(core.reconcileBankBalance(bad), 0, `${String(bad)} should be rejected`);
  }
  assert.equal(bankBalance(core), 5000);
  assertBooksBalance(core);
});

test("the reconciled balance is what a later payment is checked against", () => {
  const core = createFinancialCore({ openingBankBalance: 5000, logLevel: "silent" });
  // The server says this account holds 10, not the local opening float.
  core.reconcileBankBalance(10);
  const result = core.orchestrator.executeTransaction({
    userAccounts: core.userAccounts,
    txnId: "TXN-RECON-1",
    amount: 100,
    memo: "Should be refused",
    name: "Someone",
    shareRatePercent: 0,
    time: "12:00",
    now: new Date(),
    clientRequestId: "req-recon-1"
  });
  assert.equal(result.ok, false, "spending 100 against a real balance of 10 must be refused");
  assert.equal(bankBalance(core), 10);
  assertBooksBalance(core);
});
