// src/domain/essentials/EssentialsService.js
var EssentialsService = class {
  #grants = [];
  constructor(ledgerEngine, monthlyGrowthRate, eventBus) {
    this.ledgerEngine = ledgerEngine;
    this.monthlyGrowthRate = monthlyGrowthRate;
    // Same additive pattern as LedgerEngine/ProvenanceService: optional,
    // defaults to no-op emission for any caller that doesn't pass one.
    // Swapped to a transaction's staging outbox during
    // executeTransaction's mutating window (see
    // TransactionOrchestrator#stageEvents) so ESSENTIALS_GRANT_ADDED
    // is never published live mid-transaction, exactly like
    // LEDGER_ENTRY_POSTED and PROVENANCE_COMPLETED already aren't.
    this.eventBus = eventBus || null;
  }
  // Funded by the platform reserve — same "money already collected,
  // now redistributed" pattern as every other outbound movement, never
  // a same-user asset+income pair conjuring new value. The reserve
  // credit mirrors an Opening Balance entry (Debit essentials, Credit
  // reserve): the platform is returning part of what already flowed
  // through it moments earlier in the same payment, not creating new
  // money. See financial-principles tests for the conservation proof.
  // txnId, when supplied, makes this call idempotent per transaction:
  // a grant already recorded for that txnId is never duplicated, so a
  // retried or repeated completion of the same transaction can call
  // addGrant again safely and get the original grant back instead of
  // minting a second one. `now`, when supplied by executeTransaction,
  // threads through to both the grant's display date and its funding
  // ledger entry, for the same one-timestamp-per-transaction reason as
  // everywhere else in this chain.
  addGrant({ userAccounts, key, business, chip, amountPaid, cashbackRate, creatorName, time, currency = "INR", txnId = null, now, paylaterSettledAmount = 0 }) {
    if (!cashbackRate) return null;
    if (txnId) {
      const existing = this.#grants.find((g) => g.txnId === txnId);
      if (existing) return existing;
    }
    const date = (now || /* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const grant = new EssentialsGrant({ key: `${key}-${Date.now()}`, business, chip, amountPaid, cashbackRate, date, time, creatorName, monthsAccrued: 0, txnId, paylaterSettledAmount });
    this.#grants.push(grant);
    const money = Money.of(grant.accruedValue(this.monthlyGrowthRate), currency);
    if (money.isPositive()) {
      this.ledgerEngine.postJournalEntry({
        memo: `Essentials grant: ${business}`,
        lines: [DebitEntry(userAccounts.essentials.id, money), CreditEntry(this.ledgerEngine.registry.reserve.id, money)],
        meta: { essentialsGrantKey: grant.key },
        now
      });
    }
    this.eventBus?.emit(DomainEvent.ESSENTIALS_GRANT_ADDED, {
      key: grant.key,
      txnId,
      business,
      amountPaid,
      cashbackRate,
      accruedValue: money.amount,
      currency,
      grantedAt: now || /* @__PURE__ */ new Date()
    });
    return grant;
  }
  // Clears the grant list after a settlement. The ledger entry that
  // actually zeroes the Essentials *balance* is posted by
  // SettlementEngine — this only clears the projection-facing grant
  // list so the Assets table stops showing already-settled rows,
  // mirroring the original `setAssetSeeds([])`.
  clearGrants() {
    this.#grants = [];
  }
  listGrants() {
    return this.#grants.slice();
  }
  totalAccruedValue() {
    return this.#grants.reduce((sum, g) => sum + g.accruedValue(this.monthlyGrowthRate), 0);
  }
  // Snapshot/restore for the same rollback boundary described on
  // LedgerStore/ChainStore — grants are never mutated in place, only
  // pushed, so a shallow array copy is a complete point-in-time
  // snapshot. This does NOT touch the ledger entry addGrant() posts;
  // that's covered separately by the ledger store's own snapshot, and
  // the orchestrator restores both together.
  snapshot() {
    return { grants: this.#grants.slice() };
  }
  restore(snapshot) {
    this.#grants = snapshot.grants.slice();
  }
};

