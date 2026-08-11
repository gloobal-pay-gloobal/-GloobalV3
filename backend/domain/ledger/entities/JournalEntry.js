// src/domain/ledger/entities/JournalEntry.js
var JournalEntry = class _JournalEntry {
  constructor({ memo, lines, meta = {} }) {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new LedgerError(LEDGER_ERROR.EMPTY_ENTRY, "A journal entry needs at least two lines (one debit, one credit)");
    }
    _JournalEntry.#assertBalanced(lines);
    this.id = genJournalEntryId();
    this.memo = memo || "";
    this.lines = Object.freeze([...lines]);
    this.meta = Object.freeze({ ...meta });
    this.createdAt = /* @__PURE__ */ new Date();
    Object.freeze(this);
  }
  static #assertBalanced(lines) {
    const totalsByCurrency = /* @__PURE__ */ new Map();
    for (const line of lines) {
      const key = line.money.currency;
      const bucket = totalsByCurrency.get(key) || { debit: 0, credit: 0 };
      if (line.direction === "debit") bucket.debit += line.money.amount;
      else bucket.credit += line.money.amount;
      totalsByCurrency.set(key, bucket);
    }
    for (const [currency, { debit, credit }] of totalsByCurrency) {
      if (Math.round(debit * 100) !== Math.round(credit * 100)) {
        throw new LedgerError(
          LEDGER_ERROR.UNBALANCED_ENTRY,
          `Journal entry does not balance for ${currency}: debits=${debit.toFixed(2)} credits=${credit.toFixed(2)}`
        );
      }
    }
  }
  linesForAccount(accountId) {
    return this.lines.filter((l) => l.accountId === accountId);
  }
};

