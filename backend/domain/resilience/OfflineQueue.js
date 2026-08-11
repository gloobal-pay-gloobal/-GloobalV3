// src/domain/resilience/OfflineQueue.js
var OfflineQueue = class {
  #items = [];
  #online = true;
  #eventBus;
  #nextId = 1;
  constructor({ eventBus, online = true } = {}) {
    this.#eventBus = eventBus || null;
    this.#online = online;
  }
  isOnline() {
    return this.#online;
  }
  // Runs `run()` immediately if online; otherwise queues it for the
  // next flush and returns a pending marker instead of the result.
  enqueueOrRun(label, run) {
    if (this.#online) return { queued: false, result: run() };
    const id = this.#nextId++;
    const item = { id, label, run, enqueuedAt: /* @__PURE__ */ new Date() };
    this.#items.push(item);
    this.#eventBus?.emit(DomainEvent.REQUEST_QUEUED_OFFLINE, { id, label, queueLength: this.#items.length });
    return { queued: true, id };
  }
  pending() {
    return this.#items.map(({ id, label, enqueuedAt }) => ({ id, label, enqueuedAt }));
  }
  size() {
    return this.#items.length;
  }
  // Transition to online and run every queued item in FIFO order.
  // Returns per-item results, including any that threw, so a caller
  // can surface partial-failure ("3 of 4 pending actions applied")
  // rather than assuming a flush is all-or-nothing.
  setOnline(online) {
    const wasOffline = !this.#online;
    this.#online = online;
    if (online && wasOffline) return this.flush();
    return [];
  }
  flush() {
    const toRun = this.#items.splice(0, this.#items.length);
    const results = toRun.map((item) => {
      try {
        return { id: item.id, label: item.label, ok: true, result: item.run() };
      } catch (err) {
        return { id: item.id, label: item.label, ok: false, error: err.message };
      }
    });
    this.#eventBus?.emit(DomainEvent.OFFLINE_QUEUE_FLUSHED, { count: results.length, failures: results.filter((r) => !r.ok).length });
    return results;
  }
  clear() {
    this.#items = [];
  }
};

