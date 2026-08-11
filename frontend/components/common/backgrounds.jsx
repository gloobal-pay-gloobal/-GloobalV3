// src/components/common/backgrounds.jsx
import { useMemo } from "react";
function DashboardAmbientBg() {
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}><FinGeoField /><FinDotField count={22} /><FinSymbolField count={16} sizeMin={14} sizeMax={28} driftMin={60} driftMax={150} brandChance={0.1} glowChance={0.12} /></div>;
}
function SendMoneyAmbientBg() {
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}><FinGeoField /><FinSymbolField
    count={20}
    sizeMin={13}
    sizeMax={38}
    driftMin={45}
    driftMax={140}
    glowChance={0.22}
    symbols={DIAL_PAD_SYMBOLS}
    colors={DIAL_PAD_COLORS}
    opacityMin={0.16}
    opacityMax={0.4}
  /></div>;
}
function FinSymbolField({
  count = 8,
  sizeMin = 12,
  sizeMax = 20,
  driftMin = 30,
  driftMax = 90,
  brandChance = 0.12,
  glowChance = 0.14,
  symbols = FIN_SYMBOLS,
  opacityMin = 0.06,
  opacityMax = 0.2,
  colors
}) {
  const particles = useMemo(
    () => Array.from(
      { length: count },
      (_, i) => makeFinSymbolParticle(i, { brandChance, glowChance, sizeMin, sizeMax, driftMin, driftMax, symbols, opacityMin, opacityMax, colors })
    ),
    [count, sizeMin, sizeMax, driftMin, driftMax, brandChance, glowChance, symbols, opacityMin, opacityMax, colors]
  );
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>{particles.map((p) => {
    const edgeStyle = p.edge === "top" ? { top: "-10%", left: `${p.along}%` } : p.edge === "bottom" ? { bottom: "-10%", left: `${p.along}%` } : p.edge === "left" ? { left: "-10%", top: `${p.along}%` } : { right: "-10%", top: `${p.along}%` };
    return <span
      key={p.id}
      style={{
        position: "absolute",
        ...edgeStyle,
        fontSize: p.size,
        fontWeight: 700,
        color: p.color,
        fontFamily: T.fontDisplay,
        lineHeight: 1,
        userSelect: "none",
        pointerEvents: "none",
        willChange: "transform, opacity",
        animation: `finDrift ${p.duration}s linear ${p.delay}s infinite${p.glow ? `, finGlow ${p.glowDuration}s ease-in-out ${p.glowDelay}s infinite` : ""}`,
        "--dx": `${p.dx}px`,
        "--dy": `${p.dy}px`,
        "--r0": `${p.rotateStart}deg`,
        "--r1": `${p.rotateEnd}deg`,
        "--peak-op": p.peakOpacity
      }}
    >{p.symbol}</span>;
  })}</div>;
}
function FinDotField({ count = 24 }) {
  const dots = useMemo(() => Array.from({ length: count }, (_, i) => makeFinDotParticle(i)), [count]);
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>{dots.map((d) => <span
    key={d.id}
    style={{
      position: "absolute",
      left: `${d.x}%`,
      top: `${d.y}%`,
      width: d.size,
      height: d.size,
      borderRadius: "50%",
      background: d.color,
      pointerEvents: "none",
      willChange: "transform, opacity",
      animation: `finDotPulse ${d.duration}s ease-in-out ${d.delay}s infinite${d.glow ? `, finGlow ${d.glowDuration}s ease-in-out ${d.glowDelay}s infinite` : ""}`,
      "--peak-op": d.peakOpacity
    }}
  />)}</div>;
}
function FinGeoField() {
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>{FIN_GEO_SHAPES.map((s) => <div
    key={s.id}
    style={{
      position: "absolute",
      left: `${s.x}%`,
      top: `${s.y}%`,
      width: s.size,
      height: s.size,
      border: `1px solid ${s.color}`,
      borderRadius: s.type === "circle" ? "50%" : 18,
      opacity: 0.05,
      pointerEvents: "none",
      willChange: "transform",
      animation: `finGeoSpin ${s.duration}s linear infinite`
    }}
  />)}</div>;
}

