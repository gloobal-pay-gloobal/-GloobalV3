// src/services/api/sessionStore.js
//
// Client-side session persistence. Ported from the original Gloobal
// frontend's services/session.js.
//
// Holds two different things, and the difference matters.
//
// `user` is the identity to re-enter as on the next load — a refresh, a PWA
// relaunch, or the OS restoring a backgrounded tab would otherwise drop the
// person back at the phone screen, which reads as "it logged me out by
// itself". That part is not a credential: anyone can read or edit it in
// devtools, and reaching the dashboard from a restored session still costs a
// PIN or a biometric check.
//
// `token` IS a credential. The backend used to issue none — every route took a
// symbolId out of the request and trusted it — so a Gloobal ID was both a
// public address and the only thing protecting the account. The API now mints
// a signed bearer token in exchange for a real credential (PIN at /api/login,
// a verified OTP at registration, or a WebAuthn assertion), and every route
// that touches an account requires it.
//
// Treat it as a password: it is what an attacker with devtools access to this
// origin would take. It is scoped to this origin by localStorage, cleared on
// sign-out, and expires server-side after seven days.

var GLOOBAL_SESSION_KEY = "gloobal.session.v1";

// A restored session stops being honoured after this long. Someone who has
// not opened the app in a month re-enters through the full phone → OTP flow
// rather than seeing a lock screen for an account they may no longer use.
var GLOOBAL_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1e3;

// localStorage throws in Safari private mode and when storage is disabled,
// so every access is guarded — a storage failure degrades to "no persisted
// session", never a crash.
function gloobalSessionReadRaw() {
  try {
    const raw = window.localStorage.getItem(GLOOBAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function gloobalSessionSave(user, phoneNumber, biometricEnrolled) {
  if (!user || !user.symbolId) return;
  const previous = gloobalSessionReadRaw();
  // Only inherit from a session belonging to the SAME account. The flag
  // says "this device has a passkey for this account", so carrying it
  // across a change of account is simply wrong: account A enrolling and
  // then account B signing in on the same phone left B claiming an
  // enrolment it does not have, which strands B on a mandatory biometric
  // screen (no skip is offered for an enrolled account) whenever the
  // server check that would correct it is unreachable.
  const sameAccount = Boolean(previous && previous.user && previous.user.symbolId === user.symbolId);
  // undefined keeps whatever was already stored, so a save on every render
  // can't wipe a flag the enrolment step just set.
  const enrolled = biometricEnrolled === void 0 ? Boolean(sameAccount && previous.biometricEnrolled) : Boolean(biometricEnrolled);
  try {
    window.localStorage.setItem(
      GLOOBAL_SESSION_KEY,
      JSON.stringify({
        user,
        phoneNumber: phoneNumber || "",
        // Carried across a save for the SAME account — this function is called
        // at several points that know the user but not the token, and dropping
        // it there would sign the person out mid-flow. A different account
        // signing in on this device gets no token until it earns its own,
        // which is the one case where inheriting would be a real leak.
        token: (sameAccount && previous.token) || null,
        savedAt: Date.now(),
        // Same account-scoping as the flag below: a new account signing in
        // on this device starts its own "logged in at", not the previous
        // occupant's.
        loggedInAt: (sameAccount && previous.loggedInAt) || new Date().toISOString(),
        biometricEnrolled: enrolled
      })
    );
  } catch (e) {
    // Storage unavailable — the app still works this session, it just won't
    // survive the next reload. Nothing to recover from.
  }
}

// Returns { user, phoneNumber, biometricEnrolled } for a valid, unexpired
// session, else null. Anything partial or corrupt counts as no session.
function gloobalSessionLoad() {
  const parsed = gloobalSessionReadRaw();
  if (parsed && parsed.user && parsed.user.symbolId) {
    // savedAt is absent on blobs written before it existed; those are
    // treated as fresh rather than expired — dropping someone mid-use over
    // a field they never had is the worse failure.
    const age = parsed.savedAt ? Date.now() - parsed.savedAt : 0;
    if (age > GLOOBAL_SESSION_MAX_AGE_MS) {
      gloobalSessionClear();
      return null;
    }
    return {
      user: parsed.user,
      phoneNumber: parsed.phoneNumber || "",
      biometricEnrolled: Boolean(parsed.biometricEnrolled),
      token: parsed.token || null
    };
  }
  if (parsed) gloobalSessionClear();
  return null;
}

// --- The bearer token --------------------------------------------------
//
// Read on every request by gloobalApiRequest (httpClient.js, emitted above
// this file — these are function declarations, which hoist across the whole
// concatenated scope, so the earlier module can call them).
//
// Deliberately read from storage rather than cached in a variable: the token
// changes on login, on registration, on a PIN reset and on a passkey sign-in,
// and a stale copy in a module-level variable would send the previous
// account's credential after a switch.

// Stored inside the session blob rather than under a key of its own, so
// signing out cannot clear one and leave the other behind.
function gloobalAuthTokenSave(token) {
  const parsed = gloobalSessionReadRaw();
  try {
    window.localStorage.setItem(
      GLOOBAL_SESSION_KEY,
      JSON.stringify(Object.assign({ savedAt: Date.now() }, parsed || {}, { token: token || null }))
    );
  } catch (e) {
    // No storage. The app still works for this page view — gloobalApiRequest
    // reads the token per call and will simply find none after a reload,
    // which surfaces as being asked to sign in again.
  }
}

function gloobalAuthToken() {
  const parsed = gloobalSessionReadRaw();
  return (parsed && parsed.token) || null;
}

function gloobalAuthTokenClear() {
  gloobalAuthTokenSave(null);
}

// Flip the biometric-enrolment flag on its own, without needing the user
// object to hand. The enrolment and verification paths both learn the
// truth at moments where they only know the symbolId (see
// frontend/hooks/useBiometric.js), and a no-op when there is no stored
// session is correct: with nothing persisted there is nothing to correct,
// and the next gloobalSessionSave writes the flag from scratch.
function gloobalSessionMarkBiometricEnrolled(enrolled) {
  const parsed = gloobalSessionReadRaw();
  if (!parsed || !parsed.user) return;
  try {
    window.localStorage.setItem(
      GLOOBAL_SESSION_KEY,
      JSON.stringify(Object.assign({}, parsed, { biometricEnrolled: Boolean(enrolled) }))
    );
  } catch (e) {
    // Same reasoning as gloobalSessionSave — a storage failure costs this
    // device its shortcut, not its ability to sign in.
  }
}

// --- The current Gloobal ID: one source of truth -----------------------
//
// Every screen that shows "your Gloobal ID" reads it from here. Before
// this, each one reached for whatever it happened to have: the Receive QR
// and the share card used the Dashboard's local `gloobalIdOverride`, while
// Personal Details and the profile header used the `myGloobalId` prop
// threaded down from App — so the moment somebody changed their ID, the
// same account showed two different IDs on two different screens.
//
// The stored session is that source rather than a new dedicated key. It is
// already where the signed-in identity lives, already written on
// registration, login and ID change, and already the thing the biometric
// gate and every API call key off. A second key holding the same value
// would just be a second thing to keep in sync — which is the bug, not
// the fix.
function gloobalCurrentSymbolId() {
  const session = gloobalSessionLoad();
  return (session && session.user && session.user.symbolId) || null;
}

// Fired whenever the stored ID changes, so screens already on screen
// update without a reload. Listeners: useCurrentSymbolId (see
// frontend/hooks/useCurrentSymbolId.js).
var GLOOBAL_SYMBOL_ID_EVENT = "gloobal:symbolIdChanged";

function gloobalSessionSetSymbolId(newSymbolId) {
  if (!newSymbolId) return;
  const parsed = gloobalSessionReadRaw();
  if (!parsed || !parsed.user) return;
  if (parsed.user.symbolId === newSymbolId) return;
  try {
    window.localStorage.setItem(
      GLOOBAL_SESSION_KEY,
      JSON.stringify(
        Object.assign({}, parsed, {
          user: Object.assign({}, parsed.user, { symbolId: newSymbolId }),
          savedAt: Date.now()
        })
      )
    );
  } catch (e) {
    // Storage unavailable. The in-memory React state still carries the new
    // ID for this session; only persistence across a reload is lost.
  }
  gloobalNotifySymbolIdChanged(newSymbolId);
}

function gloobalNotifySymbolIdChanged(newSymbolId) {
  try {
    window.dispatchEvent(new CustomEvent(GLOOBAL_SYMBOL_ID_EVENT, { detail: { symbolId: newSymbolId } }));
  } catch (e) {
    // No window (SSR probes) or no CustomEvent — nothing is listening
    // there either, so there is nothing to fall back to.
  }
}

function gloobalSessionClear() {
  try {
    window.localStorage.removeItem(GLOOBAL_SESSION_KEY);
  } catch (e) {
    // A stale blob is harmless — gloobalSessionLoad re-validates shape on
    // every read.
  }
}
