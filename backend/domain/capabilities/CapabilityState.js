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
// `locked` and `live` are different questions, and conflating them is what
// let Gloobal Coin be three things at once: unlocked here, "isn't live yet"
// in the two toasts that quietly reroute a Coin payment to Bank, and a
// product with four ticked services on its own screen.
//
//   locked — you cannot open this yet (a gate on the person)
//   live   — this does not work yet (a fact about the product)
//
// Coin is open to look at and not built. That is `locked: false, live:
// false`, which the old shape had no way to say.
function deriveCapabilityStates({ hasOpenedGloobalBank = false } = {}) {
  return {
    [CAPABILITY_KEY.GLOOBAL_BANK]: { locked: false, live: true, reason: null },
    // Coin is live: it can be minted, held, sent to another Gloobal ID and
    // redeemed, against a reserve the server keeps equal to what it has
    // issued. It was `live: false` for as long as that was untrue.
    //
    // Note what this does NOT claim. Paying a merchant with coin is still not
    // built — Scan & Pay and Pay a Business remain fiat, and both still say so
    // when a coin payment is chosen. "Live" here means the currency works, not
    // that every payment surface accepts it.
    //
    // `payments` is a third question, and it exists because `live` stopped
    // answering it. While Coin did nothing, "is it live" and "can you pay with
    // it" had the same answer, and the pay sheets could read either. They have
    // different answers now: the coin works, and Scan & Pay / Pay a Business
    // still settle in fiat through /api/transactions/send. A sheet that let
    // "Gloobal Coin" through on `live` alone would debit rupees and label the
    // result coin — the exact class of lie this file exists to prevent.
    [CAPABILITY_KEY.GLOOBAL_COIN]: { locked: false, live: true, payments: false, reason: null },
    [CAPABILITY_KEY.PAYLATER]: { locked: false, live: true, reason: null },
    [CAPABILITY_KEY.MY_ASSETS]: { locked: false, live: true, reason: null },
    // First-time-user gate: Essentials stays locked until the person
    // has opened Gloobal Bank at least once. Everyone else derives
    // their lock state from this same object, so this is the only
    // spot that rule is expressed.
    [CAPABILITY_KEY.MY_ESSENTIALS]: {
      locked: !hasOpenedGloobalBank,
      live: true,
      reason: hasOpenedGloobalBank ? null : "Unlock Gloobal Bank first"
    }
  };
}

// The "Our Services" rows on the Gloobal Bank and Gloobal Coin screens.
//
// Every row on both screens carried a green check, unconditionally. That
// made four promises read as four shipped features — on Coin, for a
// product whose payments get rerouted to Bank, and on Bank for two things
// that genuinely do not exist yet. A list where every row is ticked
// carries no information; it is decoration wearing the costume of status.
//
// Each row now states which of the two it is, and says why in the same
// breath. `status` is the only thing the screen renders differently:
//
//   live    — works today, and this file can point at what does it
//   planned — not built; the note says what is missing
var SERVICE_STATUS = { LIVE: "live", PLANNED: "planned" };
var PRODUCT_SERVICES = {
  [CAPABILITY_KEY.GLOOBAL_BANK]: [
    // Every payment in the app moves digitally end to end — no cash leg
    // anywhere in Send Money, Scan & Pay, or Pay a Business.
    { label: "Cashless", status: SERVICE_STATUS.LIVE, note: "Every transfer settles digitally" },
    // Send Money resolves recipients in any supported country and converts
    // between their currency and yours on the way.
    { label: "Borderless", status: SERVICE_STATUS.LIVE, note: "Send across currencies today" },
    // There is no tax handling anywhere in this codebase — no rate table,
    // no withholding, no reporting. Claiming it is shipped is claiming a
    // feature nobody has written.
    { label: "Taxless", status: SERVICE_STATUS.PLANNED, note: "No tax handling is built yet" },
    // The backend caps a single prototype transaction
    // (PROTOTYPE_TRANSACTION_MAX_AMOUNT). A ceiling and "Limitless" cannot
    // both be true.
    { label: "Limitless", status: SERVICE_STATUS.PLANNED, note: "Transfers are still capped per payment" }
  ],
  // Three of Coin's four became true when the coin shipped, and each points at
  // something in the code rather than at an intention. deriveProductServices
  // still holds the guard below, so if Coin is ever marked not-live again these
  // revert to planned on their own.
  [CAPABILITY_KEY.GLOOBAL_COIN]: [
    // Minted and redeemed 1:1 against the reserve currency, both directions,
    // at the same rate — /api/coin/mint and /api/coin/redeem.
    { label: "Stable", status: SERVICE_STATUS.LIVE, note: "Pegged 1:1 and redeemable from reserve" },
    // A coin transfer commits inside one Mongo transaction. There is no
    // pending state for one to sit in.
    { label: "Instant", status: SERVICE_STATUS.LIVE, note: "Transfers settle immediately" },
    // Still not true, and for a more specific reason than before: the reserve
    // is denominated in a single currency, so coin cannot be minted against or
    // redeemed into another one. Crossing a border is not what is missing.
    { label: "Borderless", status: SERVICE_STATUS.PLANNED, note: "The reserve is single-currency for now" },
    // The reserve holds fiat equal to every coin issued, and /api/coin/supply
    // reports that comparison rather than asserting the result.
    { label: "Backed", status: SERVICE_STATUS.LIVE, note: "Every coin is backed 1:1 in reserve" }
  ]
};

// A service cannot be live inside a product that isn't. This is the guard
// that keeps the table above from drifting back into decoration: mark a
// Coin row `live` by hand and it is still rendered as planned, because the
// product it belongs to does not work.
function deriveProductServices(capabilityKey, capabilities) {
  const rows = PRODUCT_SERVICES[capabilityKey] || [];
  const productLive = Boolean(capabilities && capabilities[capabilityKey] && capabilities[capabilityKey].live);
  if (productLive) return rows;
  return rows.map((row) => ({
    ...row,
    status: SERVICE_STATUS.PLANNED,
    note: row.status === SERVICE_STATUS.LIVE ? "Waiting on this product going live" : row.note
  }));
}

