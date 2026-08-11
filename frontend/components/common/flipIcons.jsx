// src/components/common/flipIcons.jsx
import { useState as useState9, useEffect as useEffect9 } from "react";
function FlippingMenuIcon({ Icon, size = 92 }) {
  const [step, setStep] = useState9(() => Math.floor(Math.random() * 4));
  const [symbolChar, setSymbolChar] = useState9(() => DIAL_SYMBOLS[Math.floor(Math.random() * DIAL_SYMBOLS.length)]);
  useEffect9(() => {
    const isSymbolStep = step % 2 === 1;
    const duration = isSymbolStep ? 850 : 1700;
    const timer = setTimeout(() => {
      const nextIsSymbolStep = (step + 1) % 2 === 1;
      if (nextIsSymbolStep) {
        setSymbolChar(DIAL_SYMBOLS[Math.floor(Math.random() * DIAL_SYMBOLS.length)]);
      }
      setStep((s) => s + 1);
    }, duration);
    return () => clearTimeout(timer);
  }, [step]);
  const flipped = step % 2 === 1;
  const frontType = ["icon", "logo"][Math.floor(step / 2) % 2];
  const frontColor = LOGO_FLIP_COLORS[step % LOGO_FLIP_COLORS.length];
  const backColor = LOGO_FLIP_COLORS[(step + 1) % LOGO_FLIP_COLORS.length];
  return <div style={{ width: size, height: size, flexShrink: 0, perspective: 600 }}><div
    style={{
      position: "relative",
      width: "100%",
      height: "100%",
      transformStyle: "preserve-3d",
      transition: "transform 0.6s cubic-bezier(.4,.15,.2,1)",
      transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
    }}
  ><span
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      backfaceVisibility: "hidden",
      background: frontColor,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 6px 18px ${frontColor}40`,
      transition: "background 0.3s ease"
    }}
  >{frontType === "logo" ? <img src={G_LOGO_DATA_URI} alt="" style={{ width: "68%", height: "68%", objectFit: "contain", filter: "brightness(0) invert(1)" }} /> : <Icon size={size * 0.42} color="#fff" />}</span><span
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      backfaceVisibility: "hidden",
      transform: "rotateY(180deg)",
      background: backColor,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 6px 18px ${backColor}40`,
      transition: "background 0.3s ease"
    }}
  ><span style={{ fontSize: size * 0.34, fontWeight: 800, color: "#fff", fontFamily: T.fontDisplay }}>{symbolChar}</span></span></div></div>;
}
function SyncedFlipIcon({ Icon, size, flipInfo, frontBackground }) {
  const { flipped, content, symbol, color } = flipInfo;
  return <div style={{ width: "100%", height: "100%", perspective: 600 }}><div
    style={{
      position: "relative",
      width: "100%",
      height: "100%",
      transformStyle: "preserve-3d",
      transition: "transform 0.55s cubic-bezier(.4,.15,.2,1)",
      transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
    }}
  ><span
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: T.radiusLg,
      backfaceVisibility: "hidden",
      background: frontBackground,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}
  ><Icon size={size} /></span><span
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: T.radiusLg,
      backfaceVisibility: "hidden",
      transform: "rotateY(180deg)",
      background: color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.3s ease"
    }}
  >{content === "logo" ? <img src={G_LOGO_DATA_URI} alt="" style={{ width: "62%", height: "62%", objectFit: "contain", filter: "brightness(0) invert(1)" }} /> : <span style={{ fontSize: size * 0.7, fontWeight: 800, color: "#fff", fontFamily: T.fontDisplay }}>{symbol}</span>}</span></div></div>;
}
function GH2HFlipCircle({ size = 40 }) {
  const LETTERS = ["G", "H", "2", "H"];
  const LETTER_COLORS = ["#3B82F6", "#9333EA", "#059669", "#EC4899"];
  const [step, setStep] = useState9(0);
  const [symbolChar, setSymbolChar] = useState9(() => DIAL_SYMBOLS[Math.floor(Math.random() * DIAL_SYMBOLS.length)]);
  useEffect9(() => {
    const isSymbolStep = step % 2 === 1;
    const duration = isSymbolStep ? 700 : 1400;
    const timer = setTimeout(() => {
      const nextIsSymbolStep = (step + 1) % 2 === 1;
      if (nextIsSymbolStep) {
        setSymbolChar(DIAL_SYMBOLS[Math.floor(Math.random() * DIAL_SYMBOLS.length)]);
      }
      setStep((s) => s + 1);
    }, duration);
    return () => clearTimeout(timer);
  }, [step]);
  const flipped = step % 2 === 1;
  const letterIndex = Math.floor(step / 2) % LETTERS.length;
  const letter = LETTERS[letterIndex];
  const frontColor = LETTER_COLORS[letterIndex];
  const backColor = LETTER_COLORS[(letterIndex + 1) % LETTER_COLORS.length];
  return <div style={{ width: size, height: size, flexShrink: 0, perspective: 400 }}><div
    style={{
      position: "relative",
      width: "100%",
      height: "100%",
      transformStyle: "preserve-3d",
      transition: "transform 0.5s cubic-bezier(.4,.15,.2,1)",
      transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
    }}
  ><span
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      backfaceVisibility: "hidden",
      background: T.surface,
      border: `2px solid ${frontColor}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "border-color 0.3s ease"
    }}
  ><span style={{ fontSize: size * 0.5, fontWeight: 800, color: frontColor, fontFamily: T.fontDisplay }}>{letter}</span></span><span
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      backfaceVisibility: "hidden",
      transform: "rotateY(180deg)",
      background: backColor,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.3s ease"
    }}
  ><span style={{ fontSize: size * 0.42, fontWeight: 800, color: "#fff", fontFamily: T.fontDisplay }}>{symbolChar}</span></span></div></div>;
}
function FlipSymbolCircle({ size = 34 }) {
  const DOT_COLORS = ["#2563EB", "#DC2626", "#EA580C", "#059669", "#9333EA", "#DB2777"];
  const randomColor = (exclude) => {
    let c = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
    while (c === exclude) c = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
    return c;
  };
  const [color, setColor] = useState9(() => randomColor());
  const [symbol, setSymbol] = useState9(() => DIAL_SYMBOLS[Math.floor(Math.random() * DIAL_SYMBOLS.length)]);
  const [flipped, setFlipped] = useState9(false);
  useEffect9(() => {
    const interval = setInterval(() => {
      setFlipped((f) => !f);
      setSymbol(DIAL_SYMBOLS[Math.floor(Math.random() * DIAL_SYMBOLS.length)]);
      setColor((prev) => randomColor(prev));
    }, 1600);
    return () => clearInterval(interval);
  }, []);
  return <span style={{ display: "inline-block", perspective: 200, flexShrink: 0 }}><span
    aria-hidden="true"
    style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      transformStyle: "preserve-3d",
      transition: "transform 0.5s cubic-bezier(.4,.15,.2,1), background 0.4s ease",
      transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
    }}
  ><span style={{ fontSize: size * 0.42, fontWeight: 800, color: "#fff", transform: flipped ? "rotateY(180deg)" : "none" }}>{symbol}</span></span></span>;
}

