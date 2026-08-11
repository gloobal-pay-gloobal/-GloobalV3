// src/domain/resilience/IdempotencyGuard.js
var DEFAULT_TTL_MS = 6e4;
var IdempotencyGuard = class {
  #seen = /* @__PURE__ */ new Map();
  // clientRequestId -> { result, expiresAt }
  #ttlMs;
  #eventBus;
  constructor({ ttlMs = DEFAULT_TTL_MS, eventBus } = {}) {
    this.#ttlMs = ttlMs;
    this.#eventBus = eventBus || null;
  }
  // Runs `fn()` at most once per clientRequestId within the TTL window.
  // A duplicate call within the window returns the *original* result
  // without re-invoking fn — so a retried Send Money never posts a
  // second JournalEntry. If clientRequestId is omitted, runs fn()
  // unconditionally (opt-in, not required).
  execute(clientRequestId, fn) {
    this.#evictExpired();
    if (!clientRequestId) return fn();
    const cached = this.#seen.get(clientRequestId);
    if (cached) {
      this.#eventBus?.emit(DomainEvent.REQUEST_DEDUPED, { clientRequestId });
      return cached.result;
    }
    const result = fn();
    this.#seen.set(clientRequestId, { result, expiresAt: Date.now() + this.#ttlMs });
    return result;
  }
  has(clientRequestId) {
    this.#evictExpired();
    return this.#seen.has(clientRequestId);
  }
  clear() {
    this.#seen.clear();
  }
  #evictExpired() {
    const now = Date.now();
    for (const [key, { expiresAt }] of this.#seen) {
      if (expiresAt <= now) this.#seen.delete(key);
    }
  }
};

