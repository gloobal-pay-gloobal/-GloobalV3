// src/services/api/httpClient.js
//
// HTTP client for the real Gloobal backend (Express + MongoDB Atlas,
// deployed to Render). Ported from the original Gloobal frontend's
// services/httpClient.js — same backend, same contract, restyled for this
// project's module system.
//
// IMPORTANT — this project has no imports between modules; everything
// shares one global scope (see README). So this file declares plain
// functions and one namespace object, `GloobalApi`, rather than exporting.
//
// The browser NEVER talks to MongoDB directly. The Atlas connection string
// lives in Backend/.env on the server and must stay there — every read and
// write goes through the REST API below. There is no database driver, no
// connection string, and no credential of any kind in this bundle.
//
// The backend has no auth middleware, no JWT and no session cookies: every
// call passes symbolId directly in its own body/query. That is why there is
// no token store and no `credentials: "include"` here. Don't add either
// without a matching backend change.

var GLOOBAL_API_DEFAULT_TIMEOUT_MS = 15e3;

// Render's free tier spins the backend down when idle and takes 20-50s to
// wake up — measured at ~23s on a cold hit. Any call that might be the
// first of a session uses this instead of the default, or the wake-up
// itself reads as "the app is broken".
var GLOOBAL_API_COLD_START_TIMEOUT_MS = 45e3;

var GLOOBAL_API_FALLBACK_BASE = "https://gloobal-pay.onrender.com";

// A build env can hand us VITE_API_URL set to something relative or empty
// (e.g. a leftover "/api" from a proxy config), which silently turns every
// call into a same-origin request that 404s. Only an absolute http(s) URL
// is trusted; anything else falls back to the real Render backend.
//
// Written as a literal `import.meta.env.X` read because Vite substitutes
// that statically at build time. The try/catch is for non-Vite contexts
// (the SSR probes in gloobal-essentials-preview/tools), where import.meta
// may not exist at all.
var GLOOBAL_API_ENV_BASE = "";
try {
  GLOOBAL_API_ENV_BASE =
    (import.meta && import.meta.env && (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL)) || "";
} catch (e) {
  GLOOBAL_API_ENV_BASE = "";
}

var GLOOBAL_API_BASE = (/^https?:\/\//i.test(GLOOBAL_API_ENV_BASE) ? GLOOBAL_API_ENV_BASE : GLOOBAL_API_FALLBACK_BASE)
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

function gloobalApiUrl(path) {
  return `${GLOOBAL_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

class GloobalApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "GloobalApiError";
    this.status = status;
    this.body = body;
  }
}

// status 0 means the request never got an answer at all — a timeout, an
// offline moment, or a cold start still booting. Callers treat that very
// differently from a real rejection: it must not burn an attempts budget
// and must not be reported as "wrong PIN".
function gloobalApiIsUnreachable(err) {
  return err instanceof GloobalApiError && err.status === 0;
}

async function gloobalApiRequest(method, path, body, options) {
  const opts = options || {};
  const timeoutMs = opts.timeoutMs || GLOOBAL_API_DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (opts.signal) opts.signal.addEventListener("abort", () => controller.abort());

  try {
    const res = await fetch(gloobalApiUrl(path), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const contentType = res.headers.get("content-type") || "";
    const parsed = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

    if (!res.ok) {
      const message = (parsed && parsed.message) || `Request to ${path} failed with ${res.status}`;
      throw new GloobalApiError(message, res.status, parsed);
    }
    return parsed;
  } catch (err) {
    if (err instanceof GloobalApiError) throw err;
    if (err && err.name === "AbortError") {
      throw new GloobalApiError(`Request to ${path} timed out after ${timeoutMs}ms`, 0, null);
    }
    throw new GloobalApiError(`Network error calling ${path}: ${err.message}`, 0, null);
  } finally {
    clearTimeout(timeoutId);
  }
}

var gloobalApiClient = {
  get: (path, options) => gloobalApiRequest("GET", path, undefined, options),
  post: (path, body, options) => gloobalApiRequest("POST", path, body, options),
  put: (path, body, options) => gloobalApiRequest("PUT", path, body, options),
  patch: (path, body, options) => gloobalApiRequest("PATCH", path, body, options),
  delete: (path, options) => gloobalApiRequest("DELETE", path, undefined, options)
};

// Fire-and-forget wake-up for Render's cold start. Any request is enough to
// make the proxy spin the sleeping backend up — even one that 404s, since
// there is no dedicated health route. Called once at app mount so the
// backend has a head start while the person is still picking a country and
// typing their number. Never awaited, never surfaces an error: a failed
// warm-up just means no head start.
function gloobalApiWarmUp() {
  try {
    fetch(gloobalApiUrl("/"), { method: "GET" }).catch(() => {});
  } catch (e) {
    /* no-op */
  }
}
