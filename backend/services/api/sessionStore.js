// src/services/api/sessionStore.js
//
// Client-side session persistence. Ported from the original Gloobal
// frontend's services/session.js.
//
// The backend issues no token and no cookie, so the signed-in identity is
// just the user object the API returned, held in React state — and that
// state is lost on every remount: a refresh, a PWA relaunch, or the OS
// restoring a backgrounded tab all drop the person back at the phone
// screen, which reads as "it logged me out by itself".
//
// This stores the minimum needed to re-enter on the next load. It is NOT a
// security token: there is no server session to validate it against and
// anyone can read or edit it in devtools. It only restores *whose* account
// to re-authenticate against — reaching the dashboard from a restored
// session still costs a PIN or biometric check, and every real action still
// hits the backend with symbolId exactly as before.

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
  // undefined keeps whatever was already stored, so a save on every render
  // can't wipe a flag the enrolment step just set.
  const enrolled = biometricEnrolled === void 0 ? Boolean(previous && previous.biometricEnrolled) : Boolean(biometricEnrolled);
  try {
    window.localStorage.setItem(
      GLOOBAL_SESSION_KEY,
      JSON.stringify({
        user,
        phoneNumber: phoneNumber || "",
        savedAt: Date.now(),
        loggedInAt: (previous && previous.loggedInAt) || new Date().toISOString(),
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
      biometricEnrolled: Boolean(parsed.biometricEnrolled)
    };
  }
  if (parsed) gloobalSessionClear();
  return null;
}

function gloobalSessionClear() {
  try {
    window.localStorage.removeItem(GLOOBAL_SESSION_KEY);
  } catch (e) {
    // A stale blob is harmless — gloobalSessionLoad re-validates shape on
    // every read.
  }
}
