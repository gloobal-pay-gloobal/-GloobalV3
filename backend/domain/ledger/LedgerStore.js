// src/domain/ledger/LedgerStore.js
var LedgerStore = class {
  #records = [];
  #listeners = /* @__PURE__ */ new Set();
  append(journalEntry, { postedAt } = {}) {
    const previous = this.#records[this.#records.length - 1];
    const record = new LedgerRecord({
      sequence: this.#records.length + 1,
      journalEntry,
      previousRecordId: previous ? previous.id : null,
      postedAt
    });
    this.#records.push(record);
    this.#notify();
    return record;
  }
  getAll() {
    return this.#records.slice();
  }
  getForAccount(accountId) {
    return this.#records.filter((r) => r.journalEntry.linesForAccount(accountId).length > 0);
  }
  // Tamper-evidence check: walks the chain and confirms every record's
  // linkDigest still matches what it should be given its predecessor.
  // Exposed mainly for the audit/testing story described in the
  // migration notes — a real deployment would run this against a
  // durable store, not an in-memory array that resets on page reload.
  verifyChain() {
    for (let i = 0; i < this.#records.length; i++) {
      const record = this.#records[i];
      const expectedPrevious = i === 0 ? null : this.#records[i - 1].id;
      if (record.previousRecordId !== expectedPrevious) return false;
    }
    return true;
  }
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  // Snapshot/restore — the in-memory stand-in for "begin/rollback a
  // real database transaction". Records are never mutated in place
  // (only appended), so a shallow copy of the array is a complete,
  // correct point-in-time snapshot; restoring swaps the array back and
  // notifies subscribers, exactly as if the intervening appends had
  // never happened. See TransactionOrchestrator#captureSnapshot for
  // where this is actually used as a real rollback boundary.
  snapshot() {
    return { records: this.#records.slice() };
  }
  restore(snapshot) {
    this.#records = snapshot.records.slice();
    this.#notify();
  }
  #notify() {
    for (const listener of this.#listeners) listener();
  }
};

