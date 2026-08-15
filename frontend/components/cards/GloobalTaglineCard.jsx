// src/components/cards/GloobalTaglineCard.jsx
import {
  ArrowLeft as ServiceArrowLeft,
  Check as ServiceCheck,
  CreditCard as ServiceCreditCard,
  Globe2 as ServiceGlobe,
  Landmark as ServiceLandmark,
  Shield as ServiceShield,
  TrendingUp as ServiceTrendingUp,
  Users2 as ServiceUsers,
  Zap as ServiceZap
} from "lucide-react";

// The "0.00% / HOOMAN TO HOOMAN" card shared by the Gloobal Bank and
// Gloobal Coin screens. It was written out twice — same padding, same
// corner badge, same two marks — which is exactly the kind of duplication
// that lets one copy drift a pixel or a word away from the other. One
// component, one definition, both screens.
//
// `accentColor` is the hero circle's current colour, passed in so the
// percentage tracks the circle above it rather than picking its own.
//
// The 0.00% is not a placeholder standing in for a rate that exists
// elsewhere: there is no interest anywhere in this codebase. It is the
// literal rate, and it stays literal until a rate is actually paid.
function GloobalTaglineCard({ accentColor }) {
  return <div
    style={{
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: "22px 18px",
      borderRadius: T.radiusLg,
      background: T.surface,
      border: `1px solid ${T.line}`,
      boxShadow: T.shadowCard,
      textAlign: "center"
    }}
  ><span style={{ position: "absolute", top: 10, right: 10, zIndex: 1 }}><GH2HFlipCircle size={22} /></span><span style={{ marginBottom: 4 }}><ZeroPercentMark size={38} color={accentColor} /></span><span style={{ fontSize: 14.5, color: T.ink }}><HoomanMark /></span></div>;
}

// The "I am IN" button, likewise identical on both product screens. It is
// the one thing those screens exist to collect, so the confirmed state
// ("You're on the list") is only ever reached after the server has
// accepted — the caller owns that rule; this component only draws it.
function GloobalIamInButton({ interested, busy, onClick }) {
  return <button
    onClick={onClick}
    disabled={interested || busy}
    className="v2-tap"
    style={{
      width: "100%",
      border: "none",
      borderRadius: T.radiusMd,
      padding: "16px 0",
      cursor: interested ? "default" : "pointer",
      background: interested ? T.positiveSoft : T.gradButton,
      color: interested ? T.positive : "#fff",
      fontSize: 14,
      fontWeight: 800,
      boxShadow: interested ? "none" : "0 10px 24px rgba(124,58,237,0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8
    }}
  >{interested ? <><ServiceCheck size={16} /> You're on the list</> : busy ? "Adding you…" : "I am IN"}</button>;
}

// Icons for the "Our Services" rows. Keyed by the label the capability
// layer hands back (see PRODUCT_SERVICES in CapabilityState.js), so a row
// the server adds that this map has never heard of still renders — it
// falls back to the shield rather than throwing on an undefined component.
var SERVICE_ROW_ICONS = {
  Cashless: ServiceCreditCard,
  Borderless: ServiceGlobe,
  Taxless: ServiceShield,
  Limitless: ServiceTrendingUp,
  Stable: ServiceShield,
  Instant: ServiceZap,
  Backed: ServiceLandmark
};

// The boxed "OUR SERVICES" list, shared by Bank and Coin so the two can't
// drift into showing the same status two different ways.
//
// `services` arrives already resolved — server rows when the backend
// answered, the bundled table otherwise — and already downgraded for a
// product that isn't live. This renders what it is given and decides
// nothing about truth.
function ProductServicesCard({ services }) {
  return <div style={{ position: "relative", borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden", marginTop: 14 }}><span
    style={{
      position: "absolute",
      top: 0,
      left: 16,
      transform: "translateY(-50%)",
      background: T.surface,
      padding: "0 6px",
      borderRadius: 999,
      fontSize: 10.5,
      fontWeight: 800,
      color: T.inkFaint,
      textTransform: "uppercase",
      letterSpacing: 0.4
    }}
  >Our Services</span>{(services || []).map((item, i) => {
    const Icon = SERVICE_ROW_ICONS[item.label] || ServiceShield;
    const live = item.status === "live";
    return <div
      key={item.label}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderTop: i === 0 ? "none" : `1px solid ${T.line}`, marginTop: i === 0 ? 6 : 0 }}
    ><span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: live ? T.accentSoft : T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={17} color={live ? T.accent : T.inkFaint} /></span><span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 700, color: live ? T.ink : T.inkSoft }}>{item.label}</span><span style={{ fontSize: 11, color: T.inkFaint, lineHeight: 1.35 }}>{item.note}</span></span>{live ? <ServiceCheck size={17} color={T.positive} style={{ flexShrink: 0 }} /> : <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: T.inkFaint, background: T.surfaceAlt, border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 9px" }}>Planned</span>}</div>;
  })}</div>;
}

// Header shared by Bank, Coin and About Us: back control, title, and an
// optional right-hand action. Identical markup in all three before this,
// down to the safe-area padding.
function ProductScreenHeader({ title, onBack, onAction, actionLabel }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px 14px", flexShrink: 0 }}><button
    onClick={onBack}
    aria-label="Back"
    className="v2-tap"
    style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, boxShadow: T.shadowCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
  ><ServiceArrowLeft size={18} color={T.ink} /></button><span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay, flex: 1 }}>{title}</span>{onAction && <button
    onClick={onAction}
    aria-label={actionLabel || "More"}
    className="v2-tap"
    style={{
      width: 40,
      height: 40,
      borderRadius: "50%",
      border: "none",
      background: T.surface,
      boxShadow: T.shadowCard,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer"
    }}
  ><ServiceUsers size={17} color={T.accent} /></button>}</div>;
}

// The hero: the Gloobal logo in white on a large coloured circle. The
// colour is the app-wide flip colour the caller is already cycling (the
// same one behind the dial pad and GH Score's corner circle), passed in
// rather than picked here so all of them change together.
function ProductScreenHero({ color }) {
  return <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}><div
    style={{
      width: 168,
      height: 168,
      borderRadius: "50%",
      background: color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 10px 28px ${color}40`,
      transition: "background 0.4s ease, box-shadow 0.4s ease"
    }}
  ><img src={G_LOGO_DATA_URI} alt="" style={{ width: 138, height: 138, objectFit: "contain", filter: "brightness(0) invert(1)" }} /></div></div>;
}
