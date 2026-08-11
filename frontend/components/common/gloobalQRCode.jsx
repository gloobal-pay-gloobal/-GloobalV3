// src/components/common/gloobalQRCode.jsx
import { useState as useState3, useEffect as useEffect3, useMemo as useMemoQr } from "react";

// Renders the matrix as plain SVG rects — a real, camera-scannable QR
// code, drawn with no external dependency at all. The previous
// version here was purely decorative brand art (finder-pattern-shaped
// corners, floating symbols, a glowing circle) that never actually
// encoded `code` in any scannable way. This renders the exact same
// `code` string encodeGloobalQR/decodeGloobalQR already produce/
// parse — only how it's drawn changed, not the app's QR payload
// format. The 60-second countdown (onSecondsLeftChange) is kept
// as-is, a separate concern from whether the code itself scans.
function GloobalQRCode({ code, size = 200, onSecondsLeftChange }) {
  const [secondsLeft, setSecondsLeft] = useState3(60);
  useEffect3(() => {
    if (onSecondsLeftChange) onSecondsLeftChange(secondsLeft);
  }, [secondsLeft, onSecondsLeftChange]);
  useEffect3(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => s <= 1 ? 60 : s - 1);
    }, 1e3);
    return () => clearInterval(interval);
  }, []);
  const matrix = useMemoQr(() => {
    try {
      return qrBuildMatrix(code || " ");
    } catch {
      return null;
    }
  }, [code]);
  const margin = 2;
  const totalModules = QR_SIZE + margin * 2;
  const moduleSize = size / totalModules;
  return <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>{matrix ? <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Gloobal QR code"><rect width={size} height={size} fill="#fff" />{matrix.map((row, r) => row.map((v, c) => v === 1 ? <rect
    key={`${r}-${c}`}
    x={(c + margin) * moduleSize}
    y={(r + margin) * moduleSize}
    width={moduleSize}
    height={moduleSize}
    fill={T.ink}
  /> : null))}<image
    href={G_LOGO_DATA_URI}
    x={size * 0.42}
    y={size * 0.42}
    width={size * 0.16}
    height={size * 0.16}
  /></svg> : null}</div>;
}

