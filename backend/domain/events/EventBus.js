// src/domain/events/EventBus.js
var DEFAULT_HISTORY_LIMIT = 500;
var EventBus = class {
  #listeners = /* @__PURE__ */ new Map();
  // eventName -> Set<fn>
  #wildcardListeners = /* @__PURE__ */ new Set();
  // fn(eventName, payload)
  #history = [];
  #historyLimit;
  #seq = 0;
  constructor({ historyLimit = DEFAULT_HISTORY_LIMIT } = {}) {
    this.#historyLimit = historyLimit;
  }
  emit(eventName, payload = {}) {
    this.#seq += 1;
    const record = { seq: this.#seq, eventName, payload, at: /* @__PURE__ */ new Date() };
    this.#history.push(record);
    if (this.#history.length > this.#historyLimit) {
      this.#history.splice(0, this.#history.length - this.#historyLimit);
    }
    const listeners = this.#listeners.get(eventName);
    if (listeners) {
      for (const fn of listeners) fn(payload, record);
    }
    for (const fn of this.#wildcardListeners) fn(eventName, payload, record);
    return record;
  }
  on(eventName, fn) {
    if (!this.#listeners.has(eventName)) this.#listeners.set(eventName, /* @__PURE__ */ new Set());
    this.#listeners.get(eventName).add(fn);
    return () => this.#listeners.get(eventName)?.delete(fn);
  }
  onAny(fn) {
    this.#wildcardListeners.add(fn);
    return () => this.#wildcardListeners.delete(fn);
  }
  // Returns a shallow copy, optionally filtered by event name(s) and/or
  // capped to the most recent N — used by the diagnostics screen's
  // event log panel and by Logger's "recent errors" query.
  getHistory({ eventName, eventNames, limit } = {}) {
    let rows = this.#history;
    if (eventName) rows = rows.filter((r) => r.eventName === eventName);
    if (eventNames) {
      const set = new Set(eventNames);
      rows = rows.filter((r) => set.has(r.eventName));
    }
    if (limit) rows = rows.slice(-limit);
    return rows.slice();
  }
  clearHistory() {
    this.#history = [];
  }
  listenerCount(eventName) {
    return (this.#listeners.get(eventName)?.size || 0) + this.#wildcardListeners.size;
  }
};

