// src/services/api/rateLimiter.js
//
// Client-side attempt throttling for credential-verification calls (login,
// PIN, OTP). Ported from the original Gloobal frontend's lib/rateLimiter.js.
//
// This is NOT the rate limit. It runs in the caller's own browser, so
// anyone can clear it, edit it out of the bundle, or hit the endpoint
// directly with curl. The real limit has to live server-side, in front of
// the verify/login routes.
//
// What it honestly does:
//   - stops a person's own mis-taps from hammering the network
//   - gives immediate local feedback ("wait 4s") instead of a round trip
//   - adds friction to naive scripted guessing from this same tab

var GLOOBAL_RATE_STATE = new Map();
var GLOOBAL_RATE_MAX_ATTEMPTS_BEFORE_BACKOFF = 3;
var GLOOBAL_RATE_BASE_DELAY_MS = 1e3;
var GLOOBAL_RATE_MAX_DELAY_MS = 3e4;

class GloobalRateLimitedError extends Error {
  constructor(retryAfterMs) {
    super(`Too many attempts — try again in ${Math.ceil(retryAfterMs / 1e3)}s`);
    this.name = "GloobalRateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

// Call before attempting a verification. Throws GloobalRateLimitedError if
// the caller is currently backed off; otherwise records the attempt.
function gloobalRateCheck(key) {
  const now = Date.now();
  const entry = GLOOBAL_RATE_STATE.get(key) || { count: 0, lockedUntil: 0 };

  if (entry.lockedUntil > now) {
    throw new GloobalRateLimitedError(entry.lockedUntil - now);
  }

  entry.count += 1;
  if (entry.count > GLOOBAL_RATE_MAX_ATTEMPTS_BEFORE_BACKOFF) {
    const over = entry.count - GLOOBAL_RATE_MAX_ATTEMPTS_BEFORE_BACKOFF;
    const delay = Math.min(GLOOBAL_RATE_BASE_DELAY_MS * Math.pow(2, over - 1), GLOOBAL_RATE_MAX_DELAY_MS);
    entry.lockedUntil = now + delay;
  }
  GLOOBAL_RATE_STATE.set(key, entry);
}

// Call after a success — or after an unreachable-backend failure, which is
// not the person's mistake and must not count against them.
function gloobalRateClear(key) {
  GLOOBAL_RATE_STATE.delete(key);
}
