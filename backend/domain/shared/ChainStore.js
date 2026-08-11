// src/domain/shared/ChainStore.js
// Generalizes the hash-chain, tamper-evidence pattern LedgerRecord/
// LedgerStore already use (sequence + previousRecordId + linkDigest)
// so new append-only, replayable logs (provenance, disputes) don't
// reinvent it. Ledger itself is left untouched — this is additive,
// used only by the new modules below.
function computeChainDigest(previousRecordId, basisParts) {
  const basis = `${previousRecordId || "GENESIS"}|${basisParts.join("|")}`;
  let hash = 0;
  for (let i = 0; i < basis.length; i++) {
    hash = hash * 31 + basis.charCodeAt(i) | 0;
  }
  return `c${(hash >>> 0).toString(16)}`;
}
var ChainStore = class {
  #records = [];
  #listeners = /* @__PURE__ */ new Set();
  #idPrefix;
  #basisFn;
  constructor({ idPrefix = "CR", basisFn } = {}) {
    this.#idPrefix = idPrefix;
    this.#basisFn = basisFn || ((entry) => [JSON.stringify(entry)]);
  }
  // recordedAt is optional for the same reason LedgerRecord.postedAt
  // is: every other ChainStore-backed log (disputes, and provenance
  // completions outside a transaction) keeps stamping itself at append
  // time; only ProvenanceService.recordCompletion, called from inside
  // executeTransaction, supplies its own authoritative completedAt so
  // it doesn't drift from the rest of that transaction's timestamp.
  append(entry, { recordedAt } = {}) {
    const previous = this.#records[this.#records.length - 1];
    const sequence = this.#records.length + 1;
    const previousRecordId = previous ? previous.id : null;
    const id = `${this.#idPrefix}-${Date.now().toString(36)}-${nextSequence().toString(36)}`;
    const linkDigest = computeChainDigest(previousRecordId, this.#basisFn(entry));
    const record = Object.freeze({
      id,
      sequence,
      previousRecordId,
      linkDigest,
      recordedAt: recordedAt || /* @__PURE__ */ new Date(),
      ...entry
    });
    this.#records.push(record);
    this.#notify();
    return record;
  }
  getAll() {
    return this.#records.slice();
  }
  // Tamper-evidence check — identical shape/intent to
  // LedgerStore.verifyChain(), reused by DiagnosticsService/replay.
  verifyChain() {
    for (let i = 0; i < this.#records.length; i++) {
      const expectedPrevious = i === 0 ? null : this.#records[i - 1].id;
      if (this.#records[i].previousRecordId !== expectedPrevious) return false;
    }
    return true;
  }
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  // Same snapshot/restore contract as LedgerStore — see that class for
  // the rationale. Shared here so provenance (and any future
  // ChainStore-backed log) can participate in the same rollback
  // boundary without duplicating the pattern.
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

