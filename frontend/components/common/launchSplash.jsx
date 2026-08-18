// src/components/common/launchSplash.jsx
import { useState as useState20, useEffect as useEffect16, useRef as useRef14 } from "react";
// Bug fix / feature: this used to hold on the logo, flip once to a
// single random dial symbol, then fade — a fixed two-face reveal on
// every launch. What was actually wanted is the same "living rotating
// logo" the biometric flip screen already does (see
// components/common/flipIcons.jsx and screens' BiometricVerifyScreen):
// the real mark and the app's 8 dial-pad symbols treated as nine faces
// of the one card, flipping through them so it reads as nine different
// logos even though it is always the same one. A full pass through all
// nine at a comfortable read speed is ~18s (2s/face) — far too long
// for a screen that blocks getting into the app — so this keeps the
// launch window short (~4s total) and only plays the FIRST flip of a
// freshly shuffled nine-face sequence: the logo, then one dial symbol,
// a different one most launches. Same flip mechanic, same "it's
// actually one logo" trick, just caught for one beat instead of run to
// completion.
var HOLD_LOGO_MS = 2000;
var FLIP_MS = 500;
var HOLD_SYMBOL_MS = 1100;
var FADE_MS = 400;
var REDUCED_MOTION_HOLD_MS = 900;
var BOX_SIZE = "52vw";
var BOX_MAX = 240;
var BOX_RADIUS = "22%";
var CONTENT_FILL = "66%";
// Fisher-Yates on a copy of the dial pad's own 8 symbols (constants/
// theme.js), so which one shows up as the splash's second face is a
// different one most app launches rather than the same fixed symbol
// every time.
function shuffledDialSymbols() {
  const symbols = DIAL_SYMBOLS.slice();
  for (let i = symbols.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = symbols[i];
    symbols[i] = symbols[j];
    symbols[j] = tmp;
  }
  return symbols;
}
function LaunchSplash({ onFinish }) {
  const [phase, setPhase] = useState20("logo");
  // The full nine-face sequence — real logo first, then all 8 dial
  // symbols in a fresh shuffle — built once per mount (not per render)
  // so the order is stable for the lifetime of this splash. Only faces
  // [0] (the logo) and [1] (the first shuffled symbol) are ever actually
  // shown given the short fixed window below; the rest of the sequence
  // exists so extending HOLD_SYMBOL_MS later to run the full nine-face
  // cycle needs no further changes here.
  const sequenceRef = useRef14(null);
  if (!sequenceRef.current) {
    sequenceRef.current = [{ type: "logo" }, ...shuffledDialSymbols().map((symbol) => ({ type: "symbol", symbol }))];
  }
  const prefersReducedMotion = useRef14(
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  useEffect16(() => {
    const timers = [];
    if (prefersReducedMotion.current) {
      timers.push(setTimeout(() => setPhase("fading"), REDUCED_MOTION_HOLD_MS));
      timers.push(setTimeout(() => onFinish?.(), REDUCED_MOTION_HOLD_MS + FADE_MS));
    } else {
      timers.push(setTimeout(() => setPhase("symbol"), HOLD_LOGO_MS));
      timers.push(setTimeout(() => setPhase("fading"), HOLD_LOGO_MS + FLIP_MS + HOLD_SYMBOL_MS));
      timers.push(setTimeout(() => onFinish?.(), HOLD_LOGO_MS + FLIP_MS + HOLD_SYMBOL_MS + FADE_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, []);
  const flipped = phase === "symbol" || phase === "fading";
  return <div
    role="presentation"
    aria-hidden="true"
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: T.bg || T.surface || "#F6F5FC",
      opacity: phase === "fading" ? 0 : 1,
      transition: `opacity ${FADE_MS}ms ease`,
      pointerEvents: phase === "fading" ? "none" : "auto"
    }}
  >{
    /* The box itself — rounded square, brand gradient — is the "app
       icon" reference point. Given real 3D depth via a perspective
       tilt, a layered shadow (tight + diffuse, the way a raised
       object actually casts light) instead of one flat drop shadow,
       and a diagonal bevel overlay (light top-left, dark bottom-
       right) for a glossy, extruded look. Everything inside it
       (logo/symbol) just flips; the box's shape, tilt, and fill never
       change. */
  }{prefersReducedMotion.current ? <div style={{ perspective: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}><div
    style={{
      width: BOX_SIZE,
      height: BOX_SIZE,
      maxWidth: BOX_MAX,
      maxHeight: BOX_MAX,
      borderRadius: BOX_RADIUS,
      background: "linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)",
      boxShadow: "0 2px 0 rgba(76,29,149,0.55), 0 12px 22px rgba(76,29,149,0.38), 0 30px 58px rgba(76,29,149,0.26)",
      transform: "rotateX(10deg) rotateY(-10deg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      position: "relative"
    }}
  ><div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 32%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.2) 100%)", pointerEvents: "none" }} /><img
    src={G_LOGO_DATA_URI}
    alt=""
    style={{ width: CONTENT_FILL, height: CONTENT_FILL, objectFit: "contain", filter: "brightness(0) invert(1)" }}
  /></div></div> : (
    // Same box the Bank/Coin hero renders (LivingLogoBoxVisual, in
    // flipIcons.jsx) — the splash and "the app logo" everywhere else are
    // now literally the same component, not just similar-looking copies.
    <LivingLogoBoxVisual
      front={sequenceRef.current[0]}
      back={sequenceRef.current[1]}
      flipped={flipped}
      size={BOX_SIZE}
      maxSize={BOX_MAX}
      contentFill={CONTENT_FILL}
      borderRadius={BOX_RADIUS}
      flipMs={FLIP_MS}
    />
  )}</div>;
}

