// src/components/inputs/codeInputs.jsx
import React, { useState as useState7, useEffect as useEffect7, useRef as useRef5 } from "react";
import { RefreshCw } from "lucide-react";
function SuggestedIdRow({ id, onPick }) {
  const [picking, setPicking] = useState7(false);
  const [dotColor, setDotColor] = useState7(() => randomLogoFlipColor());
  const [currentId, setCurrentId] = useState7(id);
  useEffect7(() => {
    setCurrentId(id);
  }, [id]);
  useEffect7(() => {
    const interval = setInterval(() => {
      setDotColor((c) => randomLogoFlipColor(c));
    }, 1400);
    return () => clearInterval(interval);
  }, []);
  useEffect7(() => {
    const refreshInterval = setInterval(() => {
      if (picking) return;
      setCurrentId(genSuggestedId(currentId?.length || 12));
    }, 1e4);
    return () => clearInterval(refreshInterval);
  }, [picking, currentId]);
  const handleManualRefresh = () => {
    if (picking) return;
    setCurrentId(genSuggestedId(currentId?.length || 12));
  };
  const handlePick = () => {
    if (picking) return;
    setPicking(true);
    setTimeout(() => {
      onPick(currentId);
      setPicking(false);
    }, 280);
  };
  return <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}><span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: T.inkFaint, textAlign: "center" }}>
        Suggested for you
      </span><div style={{ borderRadius: T.radiusLg, background: T.surface, boxShadow: T.shadowCard, overflow: "hidden", display: "flex", alignItems: "center" }}><button
    onClick={handlePick}
    disabled={picking}
    aria-label="Use this suggested Gloobal ID"
    className="v2-tap"
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flex: 1,
      minWidth: 0,
      padding: "13px 14px",
      border: "none",
      background: "none",
      cursor: picking ? "default" : "pointer",
      boxSizing: "border-box",
      textAlign: "left"
    }}
  ><span
    style={{
      flex: 1,
      minWidth: 0,
      display: "flex",
      gap: 5,
      // Same reason as SymbolChipRow: an `auto` track drew a dark line
      // across the bottom of the suggested-ID row. Clip instead.
      overflowX: "hidden",
      overflowY: "hidden",
      fontSize: 15,
      fontWeight: 800,
      letterSpacing: 1,
      color: T.ink,
      fontFamily: T.fontDisplay
    }}
  ><ColoredGloobalId id={currentId} /></span><span
    aria-hidden="true"
    style={{
      flexShrink: 0,
      width: 26,
      height: 26,
      borderRadius: "50%",
      background: dotColor,
      boxShadow: `0 2px 8px ${dotColor}55`,
      opacity: picking ? 0.6 : 1,
      transition: "background 0.6s ease, box-shadow 0.6s ease"
    }}
  /></button><button
    onClick={handleManualRefresh}
    disabled={picking}
    aria-label="Get a new suggested ID"
    className="v2-tap"
    style={{
      flexShrink: 0,
      width: 40,
      height: 40,
      marginRight: 8,
      borderRadius: "50%",
      border: "none",
      background: T.surfaceAlt,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: picking ? "default" : "pointer"
    }}
  ><RefreshCw size={15} color={T.inkSoft} /></button></div></div>;
}

