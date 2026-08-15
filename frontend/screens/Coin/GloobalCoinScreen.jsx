// src/screens/Coin/GloobalCoinScreen.jsx

// Gloobal Coin — a currency that does not exist yet, said plainly.
//
// Lifted out of DashboardScreen alongside Bank and About Us. The one
// thing added in the move is the balance line, and it is worth being
// careful about what that line is: 0.00 GC is not a balance being read
// from somewhere, it is the arithmetic result of a coin with no reserve,
// no ledger and no settlement rail. Every service row on this screen is
// already marked Planned by the capability layer (deriveProductServices
// downgrades them all, because the product itself isn't live) — a balance
// figure that looked like it came from an account would be the one thing
// on the screen claiming otherwise, so it says where it comes from.
//
// "I am IN" is the waitlist. It posts to /api/interest, the route the
// Bank screen's button already uses, keyed by product — the same
// "notify me when this is real" signal, on the endpoint that exists,
// rather than a second waitlist collection meaning the same thing.
function GloobalCoinScreen({
  onBack,
  onOpenStats,
  heroColor,
  services,
  interested,
  interestBusy,
  onRegisterInterest
}) {
  return <div style={{ position: "fixed", inset: 0, zIndex: 300, background: T.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}><ProductScreenHeader
    title={<SingleOMark before="" after="NE CURRENCY" />}
    onBack={onBack}
    onAction={onOpenStats}
    actionLabel="Interest stats"
  /><div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 18px 30px", display: "flex", flexDirection: "column", gap: 20 }}><ProductScreenHero color={heroColor} /><div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
      padding: "18px 20px",
      borderRadius: T.radiusLg,
      background: T.surface,
      border: `1px solid ${T.line}`,
      boxShadow: T.shadowCard
    }}
  ><span style={{ fontSize: 11, fontWeight: 800, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.6 }}>Your Gloobal Coin</span><span style={{ fontSize: 28, fontWeight: 800, color: T.inkSoft, fontFamily: T.fontDisplay, letterSpacing: 0.2 }}>0.00 GC</span><span style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.45, marginTop: 2 }}>
        Nobody holds any yet. There is no reserve behind Gloobal Coin and no rail to settle it on, so this is the whole supply, not your share of one.
      </span></div><GloobalTaglineCard accentColor={heroColor} /><GloobalIamInButton
    interested={interested}
    busy={interestBusy}
    onClick={onRegisterInterest}
  /><ProductServicesCard services={services} /></div></div>;
}
