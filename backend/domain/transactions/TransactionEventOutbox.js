// src/domain/transactions/TransactionEventOutbox.js
// A pure buffer, not a bus: emit() only appends, nothing is ever
// dispatched to a listener. This is the "outbox" half of the
// transactional-outbox pattern — events land here during a
// transaction's mutating window and are only ever handed to the real
// EventBus (see TransactionOrchestrator#flushStaged) after that
// transaction is known to have committed. A discarded outbox (the
// failure path) simply falls out of scope and is garbage collected —
// nothing it holds ever reaches a real listener.
//
// PROTOTYPE SCOPE, HONESTLY STATED: this outbox and the state it
// guards (the ledger/provenance/PayLater/Essentials stores) are both
// plain in-memory JS objects, so "commit state, then publish events"
// here is really just "finish mutating these objects, then call
// bus.emit() synchronously" — there is no real database transaction
// underneath, so nothing here is claiming cross-store atomicity with
// a durable commit, because there isn't one yet. What IS real: the
// staging/flush-or-discard sequencing itself, which is exactly the
// shape a durable outbox needs. A production version replaces this
// class with rows in an outbox table written in the SAME database
// transaction as the state change (so they really do commit or roll
// back together), and replaces #flushStaged's synchronous loop with a
// separate publisher process that reads unpublished rows and retries
// on failure — the call sites in TransactionOrchestrator would not
// need to change shape to support that.
var TransactionEventOutbox = class {
  #entries = [];
  emit(eventName, payload) {
    this.#entries.push({ eventName, payload });
  }
  entries() {
    return this.#entries.slice();
  }
};

