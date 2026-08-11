// src/domain/essentials/EssentialsPoolService.js
// The daily My Essentials liquidity pool — deliberately a SEPARATE
// concept from EssentialsService/EssentialsGrant above, which is
// actually the Creator Share cashback mechanism (a historical naming
// collision: both happen to touch an account called "essentials",
// which is NOT the same thing as this). This pool is a real daily
// allowance the platform funds directly from its own collective
// reserve for Food/Water/Shelter/Creativity spending — not something
// the user pays into, not a payment method the user picks, and not
// connected to PayLater or Creator Share at all. It has a daily
// limit; whatever isn't used resets — refills — the next calendar
// day, it does not accumulate or carry over.
var EssentialsPoolService = class {
  #usedToday = 0;
  #trackedDate = null;
  constructor(ledgerEngine, eventBus) {
    this.ledgerEngine = ledgerEngine;
    this.eventBus = eventBus || null;
  }
  #dayKey(now) {
    return now.toISOString().slice(0, 10);
  }
  // There's no explicit "reset" action — the pool is simply measured
  // against TODAY every time it's asked about or applied to. The
  // first call on a new calendar day sees a full, unused limit again.
  #rollIfNewDay(now) {
    const key = this.#dayKey(now);
    if (this.#trackedDate !== key) {
      this.#trackedDate = key;
      this.#usedToday = 0;
    }
  }
  remainingToday(dailyLimit, now = /* @__PURE__ */ new Date()) {
    this.#rollIfNewDay(now);
    return Math.max(0, dailyLimit - this.#usedToday);
  }
  usedToday(now = /* @__PURE__ */ new Date()) {
    this.#rollIfNewDay(now);
    return this.#usedToday;
  }
  // Tops up the user's OWN bank balance directly from the platform
  // reserve — real, ledger-conserving money (DebitEntry(bank),
  // CreditEntry(reserve), the exact same shape Opening Balance uses),
  // capped at whatever's left of today's limit. Once applied it's
  // real spendable bank balance for the rest of the day, not tied to
  // any one specific purchase attempt — matching "the baseline amount
  // becomes spendable directly, no separate funding step".
  applySubsidy({ userAccounts, requestedAmount, dailyLimit, currency = "INR", now = /* @__PURE__ */ new Date() }) {
    this.#rollIfNewDay(now);
    if (!(requestedAmount > 0) || !(dailyLimit > 0)) return { subsidyAmount: 0, ledgerRecordId: null };
    const remaining = Math.max(0, dailyLimit - this.#usedToday);
    const subsidyAmount = Math.min(remaining, requestedAmount);
    if (subsidyAmount <= 0) return { subsidyAmount: 0, ledgerRecordId: null };
    const money = Money.of(subsidyAmount, currency);
    const record = this.ledgerEngine.postJournalEntry({
      memo: "My Essentials daily pool",
      lines: [DebitEntry(userAccounts.bank.id, money), CreditEntry(this.ledgerEngine.registry.reserve.id, money)],
      meta: { essentialsPoolTopUp: true },
      now
    });
    this.#usedToday += subsidyAmount;
    this.eventBus?.emit(DomainEvent.ESSENTIALS_POOL_APPLIED, {
      amount: subsidyAmount,
      dailyLimit,
      usedToday: this.#usedToday,
      remainingToday: Math.max(0, dailyLimit - this.#usedToday),
      appliedAt: now
    });
    return { subsidyAmount, ledgerRecordId: record.id };
  }
  // Snapshot/restore — same rollback boundary every other store this
  // transaction can touch already uses (see
  // TransactionOrchestrator#captureSnapshot/#restoreSnapshot).
  snapshot() {
    return { usedToday: this.#usedToday, trackedDate: this.#trackedDate };
  }
  restore(snapshot) {
    this.#usedToday = snapshot.usedToday;
    this.#trackedDate = snapshot.trackedDate;
  }
};

