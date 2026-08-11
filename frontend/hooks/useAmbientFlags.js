// src/hooks/useAmbientFlags.js
import { useMemo as useMemo7 } from "react";
var AMBIENT_FLAG_CODES = ["US", "BR", "IN", "JP", "FR", "DE", "GB", "AU", "CA", "ZA", "MX", "KR", "ES", "AE"];
function useAmbientFlags() {
  return useMemo7(
    () => AMBIENT_FLAG_CODES.map((code, i) => ({
      code,
      flag: COUNTRY_BY_ISO[code]?.flag || isoToFlag(code),
      top: i * 37 % 92 + 2,
      left: i * 53 % 90 + 2,
      size: 24 + i * 7 % 5 * 6,
      duration: 24 + i * 5 % 6 * 3,
      delay: -(i * 11 % 20),
      dx: (i % 2 === 0 ? 1 : -1) * (18 + i % 4 * 6),
      dy: (i % 3 === 0 ? -1 : 1) * (14 + i % 5 * 5)
    })),
    []
  );
}

