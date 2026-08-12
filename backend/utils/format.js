// src/utils/format.js
function fmt(n) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function formatClockTime(d) {
  return d.toLocaleTimeString("en-GB", { hour12: false });
}
function receiptAmountFontSize(text, base) {
  const len = text.length;
  if (len <= 9) return base;
  if (len <= 12) return base - 3;
  if (len <= 15) return base - 6;
  if (len <= 19) return Math.max(base - 9, 12);
  return Math.max(base - 12, 11);
}
function fmtCompact(v) {
  const abs = Math.abs(v);
  if (abs >= 1e3) {
    const kValue = v / 1e3;
    const kRounded = Number.isInteger(kValue) ? kValue.toFixed(0) : kValue.toFixed(1);
    if (Math.abs(parseFloat(kRounded)) >= 1e3) {
      const mValue = v / 1e6;
      return `${Number.isInteger(mValue) ? mValue.toFixed(0) : mValue.toFixed(1)}M`;
    }
    return `${kRounded}K`;
  }
  return v.toFixed(2);
}

