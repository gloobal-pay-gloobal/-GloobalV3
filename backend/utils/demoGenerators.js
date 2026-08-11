// src/utils/demoGenerators.js
import {
  History as History4
} from "lucide-react";


// src/utils/demoGenerators.js
function randomName() {
  const first = DEMO_FIRST_NAMES[Math.floor(Math.random() * DEMO_FIRST_NAMES.length)];
  const last = DEMO_LAST_NAMES[Math.floor(Math.random() * DEMO_LAST_NAMES.length)];
  return `${first} ${last}`;
}
function randomLocalPhone(iso) {
  const [minLen, maxLen] = mobileDigitRange(iso);
  const len = minLen === maxLen ? minLen : minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
  let digits = "";
  for (let i = 0; i < len; i++) digits += Math.floor(Math.random() * 10);
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ");
}
function generateReferralNetwork() {
  return [];
}
function generateDailySpending(sendHistory, receiveHistory) {
  const entries = [
    ...sendHistory.map((t) => ({ date: parseDemoDate(t.date), amount: t.amount, direction: "paid" })),
    ...receiveHistory.map((t) => ({ date: parseDemoDate(t.date), amount: t.amount, direction: "received" }))
  ];
  const anchor = entries.length ? entries.reduce((max, t) => t.date > max ? t.date : max, entries[0].date) : /* @__PURE__ */ new Date();
  const thisWeekStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  const weeks = [0, 1].map((weekOffset) => {
    const weekStart = new Date(thisWeekStart);
    weekStart.setDate(weekStart.getDate() - weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      const dayEntries = entries.filter(
        (t) => t.date.getFullYear() === day.getFullYear() && t.date.getMonth() === day.getMonth() && t.date.getDate() === day.getDate()
      );
      const paid = dayEntries.filter((t) => t.direction === "paid").reduce((s, t) => s + t.amount, 0);
      const received = dayEntries.filter((t) => t.direction === "received").reduce((s, t) => s + t.amount, 0);
      return { paid: Math.round(paid * 100) / 100, received: Math.round(received * 100) / 100 };
    });
  });
  const totals = weeks.map((week) => ({
    paid: Math.round(week.reduce((s, d) => s + d.paid, 0) * 100) / 100,
    received: Math.round(week.reduce((s, d) => s + d.received, 0) * 100) / 100
  }));
  return { weeks, totals };
}
function computeRealCountrySpend(sendHistory) {
  return dedupeByTxnId(sendHistory).reduce((map, t) => {
    const iso = ALL_COUNTRIES.find((c) => c.flag === t.flag)?.iso;
    if (!iso) return map;
    map[iso] = (map[iso] || 0) + t.amount;
    return map;
  }, {});
}
function buildGloobalBank(country) {
  return {
    id: "gloobal-bank",
    name: "Gloobal Bank",
    initials: "GB",
    color: "linear-gradient(135deg,#3b6ef5,#7b5bf0)",
    logo: null,
    isGloobal: true,
    phone: `${country.dialCode} \u2022\u2022\u2022\u2022 \u2022\u2022 01`
  };
}
function computeRealActiveUsers(sendHistory, iso, isFullyRegistered) {
  if (!iso) return isFullyRegistered ? 1 : 0;
  if (!isFullyRegistered) return 0;
  return sendHistory.some((t) => ALL_COUNTRIES.find((c) => c.flag === t.flag)?.iso === iso) ? 1 : 0;
}
function computeRealTxnsLastHour(sendHistory, iso, now = /* @__PURE__ */ new Date()) {
  return dedupeByTxnId(sendHistory).filter((t) => {
    if (iso) {
      const rowIso = ALL_COUNTRIES.find((c) => c.flag === t.flag)?.iso;
      if (rowIso !== iso) return false;
    }
    if (!t.time) return false;
    const parsed = /* @__PURE__ */ new Date(`${t.date} ${now.getFullYear()} ${t.time}`);
    if (isNaN(parsed.getTime())) return false;
    const diff = now - parsed;
    return diff >= 0 && diff <= 60 * 60 * 1e3;
  }).length;
}
function dedupeByTxnId(sendHistory) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const t of sendHistory) {
    const key = t.txnId || `${t.flag}-${t.amount}-${t.date}-${t.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(t);
  }
  return result;
}

