// src/__artifactEntry.jsx
import { useState as useState21 } from "react";


// src/__artifactEntry.jsx
function GloobalArtifactRoot() {
  const [showSplash, setShowSplash] = useState21(true);
  // Bug fix: <LedgerProvider> used to create its local FinancialCore
  // exactly once (a useRef that's never reset — see
  // frontend/adapters/ledger/LedgerProvider.jsx) for the entire page
  // lifetime, and GloobalId's own send/received-history state
  // (App.jsx's sendMoneyHistory/receivedMoneyHistory) was never cleared
  // on logout or a fresh registration either. So a second account
  // signing in during the same tab/page session — including a genuinely
  // new registration — kept reading and posting against the FIRST
  // account's local balance and transaction history. That is what
  // produced "my new account already has someone else's spending
  // history" and the local balance flip-flopping between the ledger's
  // hardcoded 5,000 default and whatever the previous account's figure
  // had drifted to.
  //
  // The fix is a React `key`: `accountKey` changes exactly when the
  // signed-in account's identity changes (a fresh login, a fresh
  // registration finishing, an account switch, or a sign-out — see
  // sessionStore.js's gloobalSessionSave/gloobalSessionClear, which now
  // both fire GLOOBAL_SYMBOL_ID_EVENT for exactly this reason, not just
  // an in-place ID rename). Changing a component's key forces React to
  // fully unmount the old instance and mount a brand new one, which
  // resets EVERY piece of state under it in one place — the local
  // ledger, the send/received history arrays, and anything else
  // account-scoped living inside GloobalId — rather than requiring every
  // individual piece of state to be found and cleared by hand.
  const symbolId = useCurrentSymbolId();
  const accountKey = symbolId || "signed-out";
  // The registration flow lives inside GloobalId, so the boundary goes
  // here: a throw in any stage now shows a message instead of a blank
  // page, and the real error still reaches the console.
  return <>{showSplash && <LaunchSplash onFinish={() => setShowSplash(false)} />}<LedgerProvider key={accountKey}><ScreenErrorBoundary name="Gloobal ID"><GloobalId /></ScreenErrorBoundary></LedgerProvider></>;
}
export {
  GloobalArtifactRoot as default
};

