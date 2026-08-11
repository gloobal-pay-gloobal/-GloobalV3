// src/domain/capabilities/CapabilityState.js
// Single source of truth for which services are locked/unlocked.
// Before this, each Account-tab tile carried its own hardcoded
// `locked: false` literal — five independent booleans that happened
// to agree, with nothing stopping them from drifting apart. Now every
// tile's lock state is *derived* here, from one small set of real
// inputs, so a rule like "Essentials needs Bank first" lives in
// exactly one place instead of being re-implemented (or forgotten) at
// every call site that renders a lock icon.
var CAPABILITY_KEY = {
  GLOOBAL_BANK: "gbank",
  GLOOBAL_COIN: "gcoin",
  PAYLATER: "gpaylater",
  MY_ASSETS: "myassets",
  MY_ESSENTIALS: "myessentials"
};
function deriveCapabilityStates({ hasOpenedGloobalBank = false } = {}) {
  return {
    [CAPABILITY_KEY.GLOOBAL_BANK]: { locked: false, reason: null },
    [CAPABILITY_KEY.GLOOBAL_COIN]: { locked: false, reason: null },
    [CAPABILITY_KEY.PAYLATER]: { locked: false, reason: null },
    [CAPABILITY_KEY.MY_ASSETS]: { locked: false, reason: null },
    // First-time-user gate: Essentials stays locked until the person
    // has opened Gloobal Bank at least once. Everyone else derives
    // their lock state from this same object, so this is the only
    // spot that rule is expressed.
    [CAPABILITY_KEY.MY_ESSENTIALS]: {
      locked: !hasOpenedGloobalBank,
      reason: hasOpenedGloobalBank ? null : "Unlock Gloobal Bank first"
    }
  };
}

