// src/domain/paylater/PayLaterService.js
var PayLaterService = class {
  #records = [];
  constructor(ledgerEngine, essentialsService, liquidityService, eventBus) {
    this.ledgerEngine = ledgerEngine;
    this.essentialsService = essentialsService;
    this.liquidityService = liquidityService;
    // Same additive pattern as LedgerEngine/ProvenanceService/
    // EssentialsService — optional, swapped to the transaction's
    // staging outbox during executeTransaction's mutating window.
    this.eventBus = eventBus || null;
  }
  // `userAccounts`, when supplied, switches `due` to the REAL
  // paylaterPayable ledger balance (a liability account — its balance
  // already IS "how much is currently owed", correctly reduced by any
  // settlement, auto or manual) instead of summing pending draw
  // records, which never reflected settlements at all (a real bug:
  // settleEssentialsToPayLater moved real ledger money but the old
  // due-from-records calculation didn't see it). Optional and backed
  // by a records-based fallback so any caller that hasn't been
  // updated to pass userAccounts yet still gets an answer, just not
  // one that reflects settlements.
  computeAvailable(currency = "INR", userAccounts = null) {
    const totalAssets = this.essentialsService.totalAccruedValue();
    const due = userAccounts
      ? this.ledgerEngine.getAccountBalance(userAccounts.paylaterPayable.id, currency).amount
      : this.#records.filter((r) => r.direction === "out" && r.status === "pending").reduce((s, r) => s + r.amount, 0);
    return {
      totalAssets,
      paylaterLimit: totalAssets,
      paylaterDue: due,
      paylaterAvailable: Math.max(0, totalAssets - due)
    };
  }
  // `now`, when supplied by executeTransaction (via applyDeduction),
  // is used for both the record's display date and the ledger
  // posting's timestamp — same rationale as everywhere else in this
  // chain: one transaction, one timestamp, no independent `new Date()`.
  recordDraw({ userAccounts, amount, label = "Send Money", currency = "INR", now }) {
    const money = Money.of(amount, currency);
    if (!money.isPositive()) return null;
    if (!this.liquidityService.hasSufficientLiquidity(money)) {
      throw new RangeError("PayLaterService: insufficient platform liquidity");
    }
    const record = new PayLaterRecord({
      name: label,
      date: (now || /* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: money.amount,
      status: "pending",
      direction: "out"
    });
    this.#records.push(record);
    this.ledgerEngine.postJournalEntry({
      memo: `PayLater draw: ${label}`,
      lines: [DebitEntry(this.ledgerEngine.registry.reserve.id, money), CreditEntry(userAccounts.paylaterPayable.id, money)],
      meta: { payLaterRecord: true },
      now
    });
    this.eventBus?.emit(DomainEvent.PAYLATER_DRAW_RECORDED, {
      label,
      amount: money.amount,
      currency,
      drawnAt: now || /* @__PURE__ */ new Date()
    });
    return record;
  }
  listRecords() {
    return this.#records.slice();
  }
  // Snapshot/restore for the same rollback boundary described on
  // LedgerStore/ChainStore/EssentialsService. Does NOT touch the
  // ledger entry recordDraw() posts — that's the ledger store's own
  // snapshot, restored alongside this one by the orchestrator.
  snapshot() {
    return { records: this.#records.slice() };
  }
  restore(snapshot) {
    this.#records = snapshot.records.slice();
  }
};

