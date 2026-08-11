// src/domain/ledger/entities/LedgerRecord.js
function computeLinkDigest(previousRecordId, journalEntry) {
  const basis = `${previousRecordId || "GENESIS"}|${journalEntry.id}|${journalEntry.lines.length}`;
  let hash = 0;
  for (let i = 0; i < basis.length; i++) {
    hash = hash * 31 + basis.charCodeAt(i) | 0;
  }
  return `d${(hash >>> 0).toString(16)}`;
}
var LedgerRecord = class {
  // postedAt is optional so every EXISTING call site (opening balance,
  // settlements, diagnostics, tests posting directly) keeps its old
  // "stamp it at append time" behavior unchanged. Only
  // executeTransaction's own posting calls supply an explicit postedAt
  // (its own authoritative `now`), so every record/event a single
  // transaction produces shares exactly one timestamp instead of each
  // silently calling `new Date()` a few microseconds apart.
  constructor({ sequence, journalEntry, previousRecordId, postedAt }) {
    this.id = genLedgerRecordId();
    this.sequence = sequence;
    this.journalEntry = journalEntry;
    this.previousRecordId = previousRecordId ?? null;
    this.linkDigest = computeLinkDigest(previousRecordId, journalEntry);
    this.postedAt = postedAt || /* @__PURE__ */ new Date();
    Object.freeze(this);
  }
};

