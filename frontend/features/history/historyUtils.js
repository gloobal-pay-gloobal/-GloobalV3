// src/features/history/historyUtils.js
// Today / This Week / This Month, the three periods the History screen
// filters by. `days` counts back INCLUSIVE of today, so "Today" is a
// single day rather than a day and a bit, and "This Week" is the last
// seven calendar days rather than the calendar week — someone looking at
// their history on a Monday wants the week behind them, not the two days
// since Sunday.
var HISTORY_PERIODS = [
  { key: "today", label: "Today", emptyLabel: "today", days: 1, weekPages: 1 },
  { key: "week", label: "This Week", emptyLabel: "this week", days: 7, weekPages: 2 },
  { key: "month", label: "This Month", emptyLabel: "this month", days: 30, weekPages: 5 }
];
function historyPeriodMeta(period) {
  return HISTORY_PERIODS.find((p) => p.key === period) || HISTORY_PERIODS[1];
}
function historyPeriodStart(period, now) {
  const ref = now || /* @__PURE__ */ new Date();
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  start.setDate(start.getDate() - (historyPeriodMeta(period).days - 1));
  return start;
}
// History rows carry a display date ("Aug 13"), not a timestamp, so the
// comparison goes through parseDemoDate — the same reader the daily
// spending chart already uses, which resolves a month/day into the most
// recent year it can have been. A row whose date won't parse is dropped
// from the filtered view rather than silently counted in every period.
function filterHistoryByPeriod(rows, period, now) {
  if (!Array.isArray(rows)) return [];
  const start = historyPeriodStart(period, now);
  return rows.filter((t) => {
    const parsed = parseDemoDate(t.date);
    return !isNaN(parsed.getTime()) && parsed >= start;
  });
}
function sumHistoryAmount(rows) {
  return Math.round(rows.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) * 100) / 100;
}
function buildHistoryReceipt(t, direction, dialCountry, ccy) {
  const localCurrency = COUNTRY_CURRENCY[dialCountry.iso] || "USD";
  const counterpartyCountry = ALL_COUNTRIES.find((c) => c.flag === t.flag);
  const counterpartyCurrency = counterpartyCountry ? COUNTRY_CURRENCY[counterpartyCountry.iso] : null;
  const converted = counterpartyCurrency && counterpartyCurrency !== localCurrency ? convert(t.amount, localCurrency, counterpartyCurrency) : null;
  return {
    direction,
    // 'sent' | 'received'
    name: t.name,
    flag: t.flag,
    // Real captured value when present (every row saved since the
    // receipt-determinism fix); falls back to a fresh one only for
    // "sent" rows that predate it, so old demo data doesn't crash —
    // but a transaction that already has its own shareRate/time/txnId
    // must never have it regenerated, or the same transaction would
    // show different numbers on every reopen. A "received" row (the
    // Creator Share side of some earlier payment) always carries its
    // own real shareRate now — never a random fallback, and never a
    // fabricated 0%, since it isn't a new transaction of its own to
    // guess a rate for; it's the same original payment's Creator
    // Share tab, read from the receiving side.
    shareRate: t.shareRate ?? (direction === "sent" ? randomShareRate() : null),
    amount: t.amount,
    currencySymbol: ccy,
    currencyCode: localCurrency,
    convertedAmount: converted,
    convertedCurrency: converted != null ? counterpartyCurrency : null,
    method: HISTORY_METHOD_META[t.method]?.label,
    date: t.date,
    time: t.time || formatClockTime(/* @__PURE__ */ new Date()),
    status: t.status === "completed" || t.status === "received" ? "completed" : t.status,
    txnId: t.txnId || genTxnId(),
    // Present on rows saved from a real payment (see onSendComplete in
    // Send Money); older/seed-less rows simply won't have these, same
    // as before.
    id: t.id,
    phone: t.phone
  };
}

