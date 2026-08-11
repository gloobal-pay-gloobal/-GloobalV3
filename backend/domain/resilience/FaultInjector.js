// src/domain/resilience/FaultInjector.js
var FaultInjector = class {
  #rules = [];
  // { id, remaining, kind, options }
  #eventBus;
  #nextId = 1;
  constructor({ eventBus } = {}) {
    this.#eventBus = eventBus || null;
  }
  // kind: "throw" | "delay" | "silentDrop"
  scheduleFault({ kind = "throw", count = 1, message = "Simulated failure", delayMs = 200 } = {}) {
    const id = this.#nextId++;
    this.#rules.push({ id, kind, remaining: count, message, delayMs });
    return id;
  }
  cancelFault(id) {
    this.#rules = this.#rules.filter((r) => r.id !== id);
  }
  clearAll() {
    this.#rules = [];
  }
  activeFaults() {
    return this.#rules.map(({ id, kind, remaining }) => ({ id, kind, remaining }));
  }
  // Wraps a zero-arg function so the next scheduled fault (if any)
  // applies to this call. Async-safe: always returns a Promise.
  async guard(label, fn) {
    const rule = this.#rules.find((r) => r.remaining > 0);
    if (!rule) return fn();
    rule.remaining -= 1;
    if (rule.remaining === 0) this.#rules = this.#rules.filter((r) => r !== rule);
    this.#eventBus?.emit(DomainEvent.FAULT_INJECTED, { label, kind: rule.kind, ruleId: rule.id });
    if (rule.kind === "throw") {
      throw new Error(rule.message);
    }
    if (rule.kind === "delay") {
      await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
      return fn();
    }
    if (rule.kind === "silentDrop") {
      return { droppedBySimulator: true };
    }
    return fn();
  }
};

