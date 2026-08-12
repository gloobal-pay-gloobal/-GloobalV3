// src/hooks/useCurrentSymbolId.js
import { useState as useStateSymbolId, useEffect as useEffectSymbolId } from "react";
//
// The one way a component asks "what is this account's Gloobal ID right
// now". Reads the stored session (see gloobalCurrentSymbolId in
// backend/services/api/sessionStore.js) and re-renders whenever that ID
// changes, so a rename lands on every screen at once instead of only the
// one that performed it.
//
// It takes a fallback because the ID exists in React state before it is
// ever persisted: during registration nothing is written to the session
// until the biometric step. Passing the caller's own value keeps those
// pre-session screens correct while still deferring to the stored ID the
// moment there is one.
//
// Three things can change the answer, and all three are subscribed:
//   - gloobal:symbolIdChanged, dispatched by gloobalSessionSetSymbolId
//     after a successful PATCH /api/profile/change-symbol-id;
//   - `storage`, for the same account open in another tab;
//   - the fallback prop, for the pre-session case above.
function useCurrentSymbolId(fallback) {
  const read = () => gloobalCurrentSymbolId() || fallback || null;
  const [symbolId, setSymbolId] = useStateSymbolId(read);

  useEffectSymbolId(() => {
    // Re-read on mount as well as on every event: the session can have
    // been written between the initial useState call and this effect
    // (React 18 double-invokes the initializer under StrictMode).
    setSymbolId(read());
    const onChange = () => setSymbolId(read());
    if (typeof window === "undefined") return undefined;
    window.addEventListener(GLOOBAL_SYMBOL_ID_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(GLOOBAL_SYMBOL_ID_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [fallback]);

  return symbolId;
}
