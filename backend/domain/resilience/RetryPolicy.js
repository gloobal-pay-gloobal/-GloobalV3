// src/domain/resilience/RetryPolicy.js
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 100, maxDelayMs = 2e3, isRetryable = () => true, eventBus, label = "operation" } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const willRetry = attempt < maxAttempts && isRetryable(err);
      if (!willRetry) break;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      eventBus?.emit(DomainEvent.REQUEST_RETRIED, { label, attempt, nextAttempt: attempt + 1, backoffMs: backoff, error: err.message });
      await delay(backoff);
    }
  }
  throw lastError;
}
async function withFixedRetry(fn, { maxAttempts = 3, delayMs = 50, isRetryable = () => true, eventBus, label = "operation" } = {}) {
  return withRetry(fn, { maxAttempts, baseDelayMs: delayMs, maxDelayMs: delayMs, isRetryable, eventBus, label });
}

