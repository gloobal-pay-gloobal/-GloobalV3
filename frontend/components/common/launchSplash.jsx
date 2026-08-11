// src/components/common/launchSplash.jsx
import { useState as useState20, useEffect as useEffect16, useRef as useRef14 } from "react";
var HOLD_LOGO_MS = 650;
var FLIP_MS = 550;
var HOLD_SYMBOL_MS = 500;
var FADE_MS = 400;
var REDUCED_MOTION_HOLD_MS = 500;
var BOX_SIZE = "52vw";
var BOX_MAX = 240;
var BOX_RADIUS = "22%";
var CONTENT_FILL = "66%";
function LaunchSplash({ onFinish }) {
  const [phase, setPhase] = useState20("logo");
  const symbolRef = useRef14(DIAL_SYMBOLS[Math.floor(Math.random() * DIAL_SYMBOLS.length)]);
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
  }<div style={{ perspective: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}><div
    style={{
      width: BOX_SIZE,
      height: BOX_SIZE,
      maxWidth: BOX_MAX,
      maxHeight: BOX_MAX,
      borderRadius: BOX_RADIUS,
      background: "linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)",
      boxShadow: "0 2px 0 rgba(76,29,149,0.55), 0 12px 22px rgba(76,29,149,0.38), 0 30px 58px rgba(76,29,149,0.26)",
      transform: "rotateX(10deg) rotateY(-10deg)",
      transition: "transform 0.6s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      position: "relative",
      perspective: 800
    }}
  ><div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 32%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.2) 100%)", pointerEvents: "none" }} />{prefersReducedMotion.current ? <img
    src={G_LOGO_DATA_URI}
    alt=""
    style={{ width: CONTENT_FILL, height: CONTENT_FILL, objectFit: "contain", filter: "brightness(0) invert(1)" }}
  /> : <div
    style={{
      position: "relative",
      width: CONTENT_FILL,
      height: CONTENT_FILL,
      transformStyle: "preserve-3d",
      transition: `transform ${FLIP_MS}ms cubic-bezier(.4,.15,.2,1)`,
      transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
    }}
  ><span style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}><img
    src={G_LOGO_DATA_URI}
    alt=""
    style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }}
  /></span><span
    style={{
      position: "absolute",
      inset: 0,
      backfaceVisibility: "hidden",
      transform: "rotateY(180deg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}
  ><span style={{ fontSize: "33vw", maxWidth: 158, fontWeight: 800, color: "#fff", fontFamily: T.fontDisplay, lineHeight: 1 }}>{symbolRef.current}</span></span></div>}</div></div></div>;
}

