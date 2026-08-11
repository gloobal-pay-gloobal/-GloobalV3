// src/__artifactEntry.jsx
import { useState as useState21 } from "react";


// src/__artifactEntry.jsx
function GloobalArtifactRoot() {
  const [showSplash, setShowSplash] = useState21(true);
  // The registration flow lives inside GloobalId, so the boundary goes
  // here: a throw in any stage now shows a message instead of a blank
  // page, and the real error still reaches the console.
  return <>{showSplash && <LaunchSplash onFinish={() => setShowSplash(false)} />}<LedgerProvider><ScreenErrorBoundary name="Gloobal ID"><GloobalId /></ScreenErrorBoundary></LedgerProvider></>;
}
export {
  GloobalArtifactRoot as default
};

