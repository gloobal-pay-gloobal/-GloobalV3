// src/services/api/gloobalApi.js
//
// The real Gloobal backend surface, as one namespace object. Ported from
// the original Gloobal frontend's services/api/authApi.js — same endpoints,
// same request/response shapes, verified against Backend/server.js.
//
// Everything the app persists lives in MongoDB Atlas behind these routes.
// The browser holds no database credential and opens no database
// connection; `Backend/.env` (MONGO_URI) stays server-side on Render.
//
// Every response is read for its actual shape (`{ user }`, `{ message }`,
// `{ transactions }`) rather than assumed, because this backend returns
// slightly different envelopes per route.
//
// Compatibility with this project's UI, checked against Backend/server.js:
//   Secure ID  12 symbols from  − + × = ○ □ ● ■   (identical alphabet/order)
//   OTP        6 digits (PROTOTYPE_OTP)
//   PIN        4-6 digits, so this project's 6 is valid
//   Mobile     10-digit numbers stored as +91XXXXXXXXXX server-side

var GLOOBAL_API_WAKING_MESSAGE =
  "Couldn't reach the server — it may still be waking up. Please try again in a few seconds.";

var GloobalApi = {
  baseUrl: GLOOBAL_API_BASE,
  isUnreachable: gloobalApiIsUnreachable,
  warmUp: gloobalApiWarmUp,

  // --- OTP -----------------------------------------------------------

  // POST /api/otp/send — purpose is one of registration | login |
  // pin_reset | mobile_change.
  async sendOtp(mobileNumber, purpose) {
    try {
      await gloobalApiClient.post(
        "/api/otp/send",
        { mobileNumber, purpose: purpose || "registration" },
        { timeoutMs: GLOOBAL_API_COLD_START_TIMEOUT_MS }
      );
    } catch (err) {
      if (gloobalApiIsUnreachable(err)) throw new Error(GLOOBAL_API_WAKING_MESSAGE);
      throw err;
    }
  },

  // POST /api/otp/verify
  async verifyOtp(mobileNumber, otp, purpose) {
    const key = `verify-otp:${mobileNumber}`;
    gloobalRateCheck(key);
    try {
      await gloobalApiClient.post(
        "/api/otp/verify",
        { mobileNumber, otp, purpose: purpose || "registration" },
        { timeoutMs: GLOOBAL_API_COLD_START_TIMEOUT_MS }
      );
      gloobalRateClear(key);
    } catch (err) {
      // A request that never got an answer means the backend never judged
      // the OTP — don't spend the person's attempts budget on a cold start
      // that wasn't their mistake.
      if (gloobalApiIsUnreachable(err)) {
        gloobalRateClear(key);
        throw new Error(GLOOBAL_API_WAKING_MESSAGE);
      }
      throw err;
    }
  },

  // --- Registration and login -----------------------------------------

  // POST /api/register-symbol — called once, after the referral step
  // (including when it was skipped), with everything collected across the
  // phone / secureId / referral stages. OTP-gated server-side: the backend
  // rejects this with 403 unless a verified registration OTP exists for
  // the number.
  async register(payload) {
    const result = await gloobalApiClient.post("/api/register-symbol", payload, {
      timeoutMs: GLOOBAL_API_COLD_START_TIMEOUT_MS
    });
    return {
      user: result.user || {
        symbolId: payload.symbolId,
        fullName: payload.fullName,
        mobileNumber: payload.mobileNumber
      },
      alreadyRegistered: result.alreadyRegistered,
      // Whether a referral code, if one was sent, actually landed. The
      // backend never fails a registration over a bad code, so this is the
      // only way the caller can tell.
      referralApplied: result.referralApplied,
      referralWarning: result.referralWarning || null
    };
  },

  // POST /api/pin/set
  async setPin(symbolId, pin) {
    await gloobalApiClient.post("/api/pin/set", { symbolId, secureId: symbolId, pin });
  },

  // POST /api/pin/verify — confirms a PIN without logging in.
  async verifyPin(symbolId, pin) {
    const result = await gloobalApiClient.post("/api/pin/verify", { symbolId, pin });
    if (!result || !result.verified) throw new Error((result && result.message) || "That PIN wasn't recognized.");
    return true;
  },

  // POST /api/login — Secure ID + PIN.
  async login(symbolId, pin) {
    gloobalRateCheck("login");
    try {
      const result = await gloobalApiClient.post(
        "/api/login",
        { symbolId, secureId: symbolId, pin },
        { timeoutMs: GLOOBAL_API_COLD_START_TIMEOUT_MS }
      );
      gloobalRateClear("login");
      return { user: result.user || { symbolId } };
    } catch (err) {
      // Unreachable is a cold backend, not a wrong Secure ID or PIN. It
      // must not burn the local throttle, or one slow cold start locks
      // someone out of their next, perfectly correct, attempt.
      if (gloobalApiIsUnreachable(err)) {
        gloobalRateClear("login");
        throw new Error(GLOOBAL_API_WAKING_MESSAGE);
      }
      throw err;
    }
  },

  // --- Lookup ----------------------------------------------------------

  // GET /api/users/resolve?identifier=... — by symbolId or mobile number.
  async resolveUser(identifier) {
    try {
      const result = await gloobalApiClient.get(`/api/users/resolve?identifier=${encodeURIComponent(identifier)}`, {
        timeoutMs: GLOOBAL_API_COLD_START_TIMEOUT_MS
      });
      if (!result.user) throw new Error("No user found.");
      return result.user;
    } catch (err) {
      if (gloobalApiIsUnreachable(err)) throw new Error(GLOOBAL_API_WAKING_MESSAGE);
      throw err;
    }
  },

  // Is this Gloobal ID still free to claim?
  //
  // Built on resolve rather than a new route: an ID that resolves to
  // somebody is by definition taken. Returns available: true | false |
  // null, where null means "couldn't tell" — a cold start or 5xx is not an
  // answer, and returning true there would show a confident "Available ✓"
  // over an ID that might well be taken. Registration stays permissive and
  // lets POST /api/register-symbol be the real uniqueness authority; any
  // screen that *displays* availability must not claim one on null.
  async checkSymbolAvailability(symbolId) {
    try {
      const result = await gloobalApiClient.get(`/api/users/resolve?identifier=${encodeURIComponent(symbolId)}`, {
        timeoutMs: GLOOBAL_API_COLD_START_TIMEOUT_MS
      });
      return { available: !result.user, user: result.user || null };
    } catch (err) {
      // A 404 is a real answer: the backend looked and found nobody.
      if (err instanceof GloobalApiError && err.status === 404) return { available: true, user: null };
      return { available: null, user: null };
    }
  },

  // The mirror image of the above, and deliberately separate: that one
  // treats an unclear answer as "free to claim" so a flaky lookup can never
  // block a registration. Here the safe fallback is the opposite way round
  // — an unclear answer must not reject a referral code that is probably
  // genuine — so only an explicit 404 counts as "no such ID".
  // Returns true | false | null.
  async referralCodeExists(symbolId) {
    try {
      const result = await gloobalApiClient.get(`/api/users/resolve?identifier=${encodeURIComponent(symbolId)}`, {
        timeoutMs: GLOOBAL_API_COLD_START_TIMEOUT_MS
      });
      return Boolean(result.user);
    } catch (err) {
      if (err instanceof GloobalApiError && err.status === 404) return false;
      return null;
    }
  },

  // --- Profile and referrals -------------------------------------------

  // GET /api/profile/:symbolId
  async getProfile(symbolId) {
    const result = await gloobalApiClient.get(`/api/profile/${encodeURIComponent(symbolId)}`);
    return result.user || { symbolId };
  },

  // PATCH /api/profile/change-symbol-id — the current ID is the identity
  // proof, matching how every other route in this backend works.
  async changeSymbolId(currentSymbolId, newSymbolId) {
    const result = await gloobalApiClient.patch("/api/profile/change-symbol-id", { currentSymbolId, newSymbolId });
    return { newSymbolId: result.newSymbolId || newSymbolId, user: result.user || null };
  },

  // GET /api/referrals/:symbolId — Gloobal IDs and join dates only; the
  // backend deliberately returns no contact details.
  async getReferrals(symbolId) {
    const result = await gloobalApiClient.get(`/api/referrals/${encodeURIComponent(symbolId)}`);
    return Array.isArray(result.referrals) ? result.referrals : [];
  },

  // --- Transactions -----------------------------------------------------

  // POST /api/transactions/send — PIN-verified server-side. The whole
  // receipt comes back, not just the record: the sender's new balance, the
  // cashback withheld and any seed planted sit alongside `transaction`.
  async sendTransaction(payload) {
    const key = `send:${payload.senderSymbolId}`;
    gloobalRateCheck(key);
    const result = await gloobalApiClient.post("/api/transactions/send", payload);
    gloobalRateClear(key);
    return Object.assign({}, result, { transaction: result.transaction || {} });
  },

  // GET /api/transactions/history/:symbolId — a per-viewer projection:
  // `direction` and `counterparty` are computed relative to the symbolId
  // requested.
  async getHistory(symbolId) {
    const result = await gloobalApiClient.get(`/api/transactions/history/${encodeURIComponent(symbolId)}`);
    return Array.isArray(result.transactions) ? result.transactions : [];
  },

  // GET /api/transactions/:symbolId — the same projection plus lifetime
  // totals, in one call, so the balance card's PAID and RECEIVED figures
  // can never be built from three different reads of the ledger.
  async getTransactionSummary(symbolId, type) {
    const result = await gloobalApiClient.get(
      `/api/transactions/${encodeURIComponent(symbolId)}?type=${encodeURIComponent(type || "all")}`
    );
    return {
      transactions: Array.isArray(result.transactions) ? result.transactions : [],
      totalSent: Number(result.totalSent) || 0,
      totalReceived: Number(result.totalReceived) || 0
    };
  },

  // --- Session (local, not server-issued) -------------------------------

  saveSession: gloobalSessionSave,
  loadSession: gloobalSessionLoad,
  clearSession: gloobalSessionClear
};
