// src/domain/ledger/LedgerEngine.js
var LedgerEngine = class {
  // `eventBus` is optional and defaults to undefined so every existing
  // call site (`new LedgerEngine(store, registry)`) keeps working
  // unchanged — this is additive instrumentation, not a signature
  // break. FinancialCore.js is the only caller that passes one.
  constructor(store, registry, eventBus) {
    this.store = store;
    this.registry = registry;
    this.eventBus = eventBus || null;
  }
  // `now`, when supplied, is the transaction's own authoritative
  // timestamp (see executeTransaction) — threaded into both the
  // ledger record's postedAt and the emitted event's timestamp field,
  // so nothing posted within one transaction independently calls
  // `new Date()` and drifts from the rest of that transaction's facts.
  // Every other caller (opening balance, settlements, diagnostics)
  // omits it and gets the old "stamp at post time" behavior.
  postJournalEntry({ memo, lines, meta, now }) {
    try {
      for (const line of lines) {
        if (!this.registry.has(line.accountId)) {
          throw new LedgerError(LEDGER_ERROR.UNKNOWN_ACCOUNT, `Cannot post to unknown account "${line.accountId}"`);
        }
      }
      const entry = new JournalEntry({ memo, lines, meta });
      const record = this.store.append(entry, { postedAt: now });
      this.eventBus?.emit(DomainEvent.LEDGER_ENTRY_POSTED, {
        recordId: record.id,
        journalEntryId: entry.id,
        sequence: record.sequence,
        memo: entry.memo,
        meta: entry.meta,
        lines: entry.lines.map((l) => ({ accountId: l.accountId, direction: l.direction, amount: l.money.amount, currency: l.money.currency })),
        postedAt: record.postedAt
      });
      return record;
    } catch (err) {
      this.eventBus?.emit(DomainEvent.LEDGER_ENTRY_REJECTED, {
        code: err.code || "UNKNOWN",
        message: err.message,
        attempted: { memo, lines: (lines || []).map((l) => ({ accountId: l?.accountId, direction: l?.direction })) },
        occurredAt: now || /* @__PURE__ */ new Date()
      });
      throw err;
    }
  }
  getAccountBalance(accountId, currency = "INR") {
    const account = this.registry.get(accountId);
    const records = this.store.getForAccount(accountId);
    let balance = Money.zero(currency);
    for (const record of records) {
      for (const line of record.journalEntry.linesForAccount(accountId)) {
        const signed = line.direction === account.normalBalance ? line.money : Money.zero(currency).subtract(line.money);
        balance = balance.add(signed);
      }
    }
    return balance;
  }
  getAccountHistory(accountId) {
    return this.store.getForAccount(accountId).map((record) => ({
      recordId: record.id,
      sequence: record.sequence,
      postedAt: record.postedAt,
      memo: record.journalEntry.memo,
      meta: record.journalEntry.meta,
      lines: record.journalEntry.linesForAccount(accountId),
      journalEntryId: record.journalEntry.id
    }));
  }
  subscribe(listener) {
    return this.store.subscribe(listener);
  }
};

