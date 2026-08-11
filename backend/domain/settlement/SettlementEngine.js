// src/domain/settlement/SettlementEngine.js
var SettlementEngine = class {
  #batches = [];
  constructor(ledgerEngine) {
    this.ledgerEngine = ledgerEngine;
  }
  settleEssentialsToBank({ userAccounts, amount, currency = "INR" }) {
    return this.#settle({
      kind: "essentials-to-bank",
      sourceAccountId: userAccounts.essentials.id,
      destinationAccountId: userAccounts.bank.id,
      amount,
      currency,
      memo: "Settle Essentials Wallet to Gloobal Bank"
    });
  }
  settleReferralToBank({ userAccounts, amount, currency = "INR" }) {
    return this.#settle({
      kind: "referral-to-bank",
      sourceAccountId: userAccounts.referralEarnings.id,
      destinationAccountId: userAccounts.bank.id,
      amount,
      currency,
      memo: "Settle Referral Earnings to Gloobal Bank"
    });
  }
  // Pays down outstanding PayLater due directly from the Essentials
  // wallet — same pure transfer between two of the user's own
  // accounts as settleEssentialsToBank, just crediting essentials
  // (reducing it) and debiting paylaterPayable (reducing the
  // liability) instead of crediting bank. Used to auto-settle new
  // Creator Share earnings against existing PayLater debt before any
  // of it becomes freely available headroom — see
  // TransactionOrchestrator#completeTransaction's call site for why.
  settleEssentialsToPayLater({ userAccounts, amount, currency = "INR", now }) {
    return this.#settle({
      kind: "essentials-to-paylater",
      sourceAccountId: userAccounts.essentials.id,
      destinationAccountId: userAccounts.paylaterPayable.id,
      amount,
      currency,
      memo: "Auto-settle PayLater due from new Essentials earnings",
      now
    });
  }
  // `now`, when supplied (currently only by the PayLater
  // auto-settlement call inside completeTransaction), threads through
  // to the ledger posting so it shares that transaction's one
  // authoritative timestamp — optional, so the manual "Settle" button
  // flows (which aren't part of any executeTransaction call) keep
  // their existing stamp-at-post-time behavior.
  #settle({ kind, sourceAccountId, destinationAccountId, amount, currency, memo, now }) {
    const money = Money.of(amount, currency);
    if (!money.isPositive()) return { ok: false, code: "INVALID_AMOUNT", reason: "Settlement amount must be positive." };
    // Guards against duplicate/over settlement (e.g. a double-tap
    // settling the same balance twice): never post a settlement the
    // source account can't actually back, which is what would let a
    // second, stale-amount settlement drive the source negative.
    const sourceBalance = this.ledgerEngine.getAccountBalance(sourceAccountId, currency);
    if (sourceBalance.amount < money.amount) {
      return { ok: false, code: "INSUFFICIENT_SOURCE_BALANCE", reason: `Only ${sourceBalance.amount.toFixed(2)} ${currency} available to settle.` };
    }
    let batch = new SettlementBatch({ kind, sourceAccountId, destinationAccountId, money, state: SettlementState.PENDING });
    const record = this.ledgerEngine.postJournalEntry({
      memo,
      lines: [DebitEntry(destinationAccountId, money), CreditEntry(sourceAccountId, money)],
      meta: { settlementKind: kind },
      now
    });
    batch = batch.advance(SettlementState.SETTLED, { ledgerRecordId: record.id });
    this.#batches.push(batch);
    return { ok: true, batch };
  }
  listBatches() {
    return this.#batches.slice();
  }
};

