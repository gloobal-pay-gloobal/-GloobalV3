// src/utils/date.js
function parseDemoDate(dateStr) {
  const now = /* @__PURE__ */ new Date();
  const parsed = /* @__PURE__ */ new Date(`${dateStr}, ${now.getFullYear()}`);
  if (parsed > now) parsed.setFullYear(parsed.getFullYear() - 1);
  return parsed;
}
function ghTodayKey() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function ghDailySeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = h * 31 + str.charCodeAt(i) >>> 0;
  return h;
}

